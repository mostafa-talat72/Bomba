import { useEffect, useState } from 'react';
import { Receipt, QrCode, Printer, DollarSign, CreditCard, Calendar, User, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, Bill, BillItem } from '../services/api';

const Billing = () => {
  const { bills, fetchBills, cancelBill, getBillItems, addPartialPayment } = useApp();
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: boolean }>({});
  const [itemQuantities, setItemQuantities] = useState<{ [key: string]: number }>({});
  const [partialPaymentMethod, setPartialPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentReference, setPaymentReference] = useState('');

  useEffect(() => {
    fetchBills();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'مسودة';
      case 'partial': return 'مدفوع جزئياً';
      case 'paid': return 'مدفوع بالكامل';
      case 'overdue': return 'متأخر';
      case 'cancelled': return 'ملغية';
      default: return 'غير معروف';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return '📄';
      case 'partial': return '💰';
      case 'paid': return '✅';
      case 'overdue': return '⚠️';
      case 'cancelled': return '❌';
      default: return '📄';
    }
  };

  // Helper: Safely get field or fallback
  const safe = (val: any, fallback = '-') => (val !== undefined && val !== null && val !== '' ? val : fallback);

  const handlePaymentClick = (bill: any) => {
    setSelectedBill(bill);
    setPaymentAmount('');
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedBill) return;

    try {
      const result = await api.updatePayment(selectedBill.id || selectedBill._id, {
        paid: selectedBill.paid || 0,
        remaining: selectedBill.remaining || 0,
        status: selectedBill.status || 'draft',
        paymentAmount: parseFloat(paymentAmount),
        method: paymentMethod,
        reference: paymentReference
      });

      if (result && result.data) {
        setSelectedBill(result.data);
        setShowPaymentModal(false);
        setPaymentAmount('');
        setPaymentMethod('cash');
        setPaymentReference('');
        fetchBills(); // إعادة تحميل قائمة الفواتير
        alert('تم تسجيل الدفع بنجاح!');
      }
    } catch (error) {
      console.error('Failed to update payment:', error);
      alert('فشل في تسجيل الدفع');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: 'EGP'
    }).format(amount);
  };

  const getCustomerDisplay = (bill: any) => {
    if (bill.billType === 'playstation') {
      let psNum = '';
      if (typeof bill.tableNumber === 'number') {
        psNum = bill.tableNumber.toString();
      } else if (bill.tableNumber) {
        psNum = String(bill.tableNumber).replace(/[^0-9]/g, '');
      }
      return `عميل بلايستيشن${psNum ? ' (' + psNum + ')' : ''}`;
    } else if (bill.billType === 'cafe') {
      return bill.customerName || 'عميل كافيه';
    } else {
      return bill.customerName || 'عميل';
    }
  };

  const filteredBills = bills.filter(bill => statusFilter === 'all' || bill.status === statusFilter);

  // Helper: Check if bill has any unprepared items
  const hasUnpreparedItems = (bill: any) => {
    if (!bill.orders) return false;
    for (const order of bill.orders) {
      if (!order.items) continue;
      for (const item of order.items) {
        if ((item.preparedCount || 0) < (item.quantity || 0)) {
          return true;
        }
      }
    }
    return false;
  };

  const handlePartialPayment = async (bill: Bill) => {
    setSelectedBill(bill);
    setShowPartialPaymentModal(true);

    try {
      const items = await getBillItems(bill.id || bill._id);
      setBillItems(items);
      setSelectedItems({});
      setItemQuantities({});
    } catch (error) {
      console.error('Failed to load bill items:', error);
    }
  };

  const handlePartialPaymentSubmit = async () => {
    if (!selectedBill) return;

    const selectedItemIds = Object.keys(selectedItems).filter(id => selectedItems[id]);
    if (selectedItemIds.length === 0) {
      alert('يرجى تحديد العناصر المطلوب دفعها');
      return;
    }

    const itemsToPay = billItems.filter(item => {
      const itemKey = item.orderId + '-' + item.itemName;
      return selectedItemIds.includes(itemKey) && itemQuantities[itemKey] > 0;
    }).map(item => {
      const itemKey = item.orderId + '-' + item.itemName;
      const quantity = itemQuantities[itemKey] || 0;
      return {
        ...item,
        quantity: Math.min(quantity, item.quantity) // لا يمكن دفع أكثر من الكمية المتاحة
      };
    });

    if (itemsToPay.length === 0) {
      alert('يرجى تحديد الكميات المطلوب دفعها');
      return;
    }

    try {
      const result = await addPartialPayment(selectedBill.id || selectedBill._id, {
        orderId: itemsToPay[0].orderId,
        items: itemsToPay.map(item => ({
          itemName: item.itemName,
          price: item.price,
          quantity: item.quantity
        })),
        paymentMethod: partialPaymentMethod
      });

      if (result) {
        // تحديث بيانات الفاتورة المحلية
        setSelectedBill(result);

        // إعادة تحميل عناصر الفاتورة لتحديث القائمة
        const updatedItems = await getBillItems(selectedBill.id || selectedBill._id);
        setBillItems(updatedItems);

        // إعادة تعيين العناصر المحددة
        setSelectedItems({});
        setItemQuantities({});

        // إظهار رسالة نجاح
        alert('تم تسجيل الدفع الجزئي بنجاح!');
      }
    } catch (error) {
      console.error('Failed to add partial payment:', error);
      alert('فشل في تسجيل الدفع الجزئي');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Receipt className="h-8 w-8 text-primary-600 ml-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إدارة الفواتير</h1>
            <p className="text-gray-600">إنشاء وإدارة فواتير العملاء</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Receipt className="h-6 w-6 text-blue-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">إجمالي الفواتير</p>
              <p className="text-2xl font-bold text-blue-600">{bills.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">المبلغ المحصل</p>
              <p className="text-2xl font-bold text-green-600">
                {bills.reduce((sum, bill) => sum + (bill.paid || 0), 0)} ج.م
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">المبلغ المتبقي</p>
              <p className="text-2xl font-bold text-yellow-600">
                {bills.reduce((sum, bill) => sum + (bill.remaining || 0), 0)} ج.م
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Receipt className="h-6 w-6 text-purple-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">فواتير جزئية</p>
              <p className="text-2xl font-bold text-purple-600">
                {bills.filter(b => b.status === 'partial').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">الفواتير الحالية</h3>
          <div className="flex items-center space-x-4 space-x-reverse">
            <label className="text-sm font-medium text-gray-700">فلترة حسب الحالة:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">جميع الفواتير</option>
              <option value="draft">مسودة</option>
              <option value="partial">مدفوع جزئياً</option>
              <option value="paid">مدفوع بالكامل</option>
              <option value="overdue">متأخر</option>
              <option value="cancelled">ملغية</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bills Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredBills.map((bill) => (
          <div
            key={bill.id || bill._id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 cursor-pointer relative"
            onClick={() => handlePaymentClick(bill)}
          >
            {/* Unprepared Items Badge */}
            {hasUnpreparedItems(bill) && (
              <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
                طلبات غير جاهزة
              </span>
            )}
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <span className="text-2xl mr-2">{getStatusIcon(bill.status)}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(bill.status)}`}>
                    {getStatusText(bill.status)}
                  </span>
                </div>
                <span className="text-xs text-gray-500">#{safe(bill.billNumber, bill.id || bill._id)}</span>
              </div>

              <div className="flex items-center text-sm text-gray-600 mb-1">
                <User className="h-4 w-4 mr-1" />
                <span className="truncate">{getCustomerDisplay(bill)}</span>
              </div>

              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-1" />
                <span>{bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('ar-EG') : '-'}</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">المبلغ الكلي:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(bill.total || 0)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">المدفوع:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(bill.paid || 0)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">المتبقي:</span>
                  <span className={`font-semibold ${(bill.remaining || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(bill.remaining || 0)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>الطلبات: {bill.orders?.length || 0}</span>
                  <span>الجلسات: {bill.sessions?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`p-4 border-t border-gray-100 rounded-b-lg ${bill.status === 'paid' ? 'bg-green-50' : 'bg-gray-50'
              }`}>
              <div className={`flex items-center justify-center text-sm font-medium ${bill.status === 'paid' ? 'text-green-600' : 'text-primary-600'
                }`}>
                {bill.status === 'paid' ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    مدفوع بالكامل
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-1" />
                    انقر لإدارة الفاتورة
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredBills.length === 0 && (
        <div className="text-center py-12">
          <Receipt className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد فواتير</h3>
          <p className="text-gray-600">
            {statusFilter === 'all'
              ? 'لم يتم إنشاء أي فواتير بعد'
              : `لا توجد فواتير بحالة "${getStatusText(statusFilter)}"`
            }
          </p>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">إدارة الدفع - فاتورة #{selectedBill?.billNumber || selectedBill?.id || selectedBill?._id}</h3>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Payment Section */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">معلومات الدفع</h4>

                  {/* معلومات الفاتورة */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <h5 className="font-medium text-gray-900 mb-3">معلومات الفاتورة</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">رقم الفاتورة:</span>
                        <span className="font-medium mr-2">#{selectedBill?.billNumber || selectedBill?.id || selectedBill?._id}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">العميل:</span>
                        <span className="font-medium mr-2">{getCustomerDisplay(selectedBill)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">المبلغ الكلي:</span>
                        <span className="font-medium text-green-600 mr-2">{formatCurrency(selectedBill?.total || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">المدفوع مسبقاً:</span>
                        <span className="font-medium text-blue-600 mr-2">{formatCurrency(selectedBill?.paid || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">المتبقي:</span>
                        <span className="font-medium text-red-600 mr-2">{formatCurrency(selectedBill?.remaining || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">الحالة:</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full mr-2 ${getStatusColor(selectedBill?.status || 'draft')}`}>
                          {getStatusText(selectedBill?.status || 'draft')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* المدفوعات الجزئية */}
                  {selectedBill?.partialPayments && selectedBill.partialPayments.length > 0 && (
                    <div className="bg-blue-50 p-4 rounded-lg mb-6">
                      <h5 className="font-medium text-blue-900 mb-3">المدفوعات الجزئية السابقة</h5>
                      <div className="space-y-2">
                        {selectedBill.partialPayments.map((payment: any, index: number) => (
                          <div key={index} className="bg-white p-3 rounded-lg border border-blue-100">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-medium text-blue-900">طلب #{payment.orderNumber}</span>
                              <span className="text-sm text-blue-600 font-medium">
                                {formatCurrency(payment.totalPaid)}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {payment.items.map((item: any, itemIndex: number) => (
                                <div key={itemIndex} className="flex justify-between text-sm">
                                  <span className="text-blue-800">
                                    {item.itemName} × {item.quantity}
                                  </span>
                                  <span className="text-blue-700 font-medium">
                                    {formatCurrency(item.price * item.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-blue-100 text-xs text-blue-600">
                              تم الدفع: {new Date(payment.items[0]?.paidAt).toLocaleDateString('ar-EG')} - {payment.items[0]?.paymentMethod === 'cash' ? 'نقداً' : payment.items[0]?.paymentMethod === 'card' ? 'بطاقة' : 'تحويل'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* إدخال الدفع - يظهر فقط إذا لم تكن الفاتورة مدفوعة بالكامل */}
                  {selectedBill?.status !== 'paid' && (
                    <>
                      {/* أزرار الدفع */}
                      <div className="mb-6">
                        <h5 className="font-medium text-gray-900 mb-3">خيارات الدفع</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <button
                            onClick={() => {
                              if (selectedBill?.remaining && selectedBill.remaining > 0) {
                                setPaymentAmount(selectedBill.remaining.toString());
                              }
                              setPaymentMethod('cash');
                            }}
                            className="p-4 border-2 border-gray-200 hover:border-gray-300 rounded-lg text-center transition-colors duration-200"
                          >
                            <div className="text-2xl mb-2">💰</div>
                            <div className="font-medium">دفع الفاتورة بالكامل</div>
                            <div className="text-sm text-gray-600">دفع المبلغ المتبقي بالكامل</div>
                          </button>

                          <button
                            onClick={() => selectedBill && handlePartialPayment(selectedBill)}
                            className="p-4 border-2 border-gray-200 hover:border-gray-300 rounded-lg text-center transition-colors duration-200"
                          >
                            <div className="text-2xl mb-2">🍹</div>
                            <div className="font-medium">دفع مشروب معين</div>
                            <div className="text-sm text-gray-600">اختيار مشروبات محددة للدفع</div>
                          </button>
                        </div>
                      </div>

                      {/* إدخال الدفع - يظهر فقط إذا تم اختيار دفع الفاتورة بالكامل */}
                      {paymentAmount && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">مبلغ الدفع</label>
                            <input
                              type="text"
                              value={formatCurrency(parseFloat(paymentAmount))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                              disabled
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">المبلغ المتبقي بعد الدفع</label>
                            <input
                              type="text"
                              value={formatCurrency(Math.max(0, (selectedBill?.remaining || 0) - parseFloat(paymentAmount)))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                              disabled
                            />
                          </div>

                          {/* مؤشر حالة الدفع */}
                          <div className="p-3 rounded-lg border bg-green-50 border-green-200">
                            <div className="flex items-center">
                              <span className="text-lg mr-2 text-green-600">✅</span>
                              <div>
                                <p className="font-medium text-green-800">
                                  ستصبح الفاتورة مدفوعة بالكامل!
                                </p>
                                <p className="text-sm text-green-600">
                                  المبلغ المتبقي سيكون صفر
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ملاحظات */}
                      <div className="mt-6">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h5 className="font-medium text-blue-900 mb-2">ملاحظات مهمة:</h5>
                          <ul className="text-sm text-blue-800 space-y-1">
                            <li>• سيتم تحديث حالة الفاتورة تلقائياً بناءً على المبلغ المدفوع</li>
                            <li>• إذا كان المبلغ المتبقي صفر، ستتحول الحالة إلى "مدفوع بالكامل"</li>
                            <li>• إذا كان هناك مبلغ متبقي، ستتحول الحالة إلى "مدفوع جزئياً"</li>
                          </ul>
                        </div>
                      </div>
                    </>
                  )}

                  {/* رسالة للفواتير المدفوعة بالكامل */}
                  {selectedBill?.status === 'paid' && (
                    <div className="bg-green-50 p-6 rounded-lg text-center">
                      <div className="text-6xl mb-4">✅</div>
                      <h5 className="font-medium text-green-900 mb-2">الفاتورة مدفوعة بالكامل!</h5>
                      <p className="text-green-700 mb-4">
                        تم دفع جميع المبالغ المطلوبة لهذه الفاتورة
                      </p>
                      <div className="bg-white p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600">المبلغ الكلي:</span>
                          <span className="font-semibold text-green-600">{formatCurrency(selectedBill?.total || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">المدفوع:</span>
                          <span className="font-semibold text-green-600">{formatCurrency(selectedBill?.paid || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t">
                          <span className="text-gray-600">المتبقي:</span>
                          <span className="font-semibold text-green-600">0.00 ج.م</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* QR Code Section */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">رمز QR للعميل</h4>

                  <div className="bg-gray-50 p-6 rounded-lg text-center">
                    {selectedBill?.qrCode ? (
                      <div>
                        <img
                          src={selectedBill.qrCode}
                          alt="QR Code"
                          className="mx-auto mb-4 w-48 h-48 border-4 border-white shadow-lg"
                        />
                        <p className="text-sm text-gray-600 mb-2">
                          يمكن للعميل مسح هذا الرمز لمعرفة تفاصيل فاتورته
                        </p>
                        <div className="text-xs text-gray-500 space-y-1 mb-4">
                          <p>• عرض جميع الطلبات والجلسات</p>
                          <p>• معرفة المبلغ المدفوع والمتبقي</p>
                          <p>• مراقبة حالة الفاتورة</p>
                        </div>
                        <div className="flex justify-center space-x-2 space-x-reverse">
                          <button
                            onClick={() => {
                              const newWindow = window.open();
                              if (newWindow) {
                                newWindow.document.write(`
                                  <html dir="rtl">
                                    <head>
                                      <title>QR Code - فاتورة #${selectedBill?.billNumber}</title>
                                      <style>
                                        body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                                        .qr-container { margin: 20px auto; max-width: 400px; }
                                        .qr-code { width: 300px; height: 300px; border: 2px solid #333; }
                                        .info { margin: 20px 0; }
                                        .bill-number { font-size: 18px; font-weight: bold; margin: 10px 0; }
                                        .instructions { font-size: 14px; color: #666; }
                                      </style>
                                    </head>
                                    <body>
                                      <div class="qr-container">
                                        <h2>رمز QR للفاتورة</h2>
                                        <div class="bill-number">فاتورة #${selectedBill?.billNumber}</div>
                                        <img src="${selectedBill?.qrCode}" alt="QR Code" class="qr-code" />
                                        <div class="info">
                                          <p>يمكن للعميل مسح هذا الرمز لمعرفة تفاصيل فاتورته</p>
                                          <p class="instructions">• عرض جميع الطلبات والجلسات</p>
                                          <p class="instructions">• معرفة المبلغ المدفوع والمتبقي</p>
                                          <p class="instructions">• مراقبة حالة الفاتورة</p>
                                        </div>
                                      </div>
                                    </body>
                                  </html>
                                `);
                                newWindow.document.close();
                                newWindow.print();
                              }
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors duration-200"
                          >
                            <Printer className="h-4 w-4 ml-1 inline" />
                            طباعة QR
                          </button>
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = selectedBill?.qrCode || '';
                              link.download = `qr-code-${selectedBill?.billNumber}.png`;
                              link.click();
                            }}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors duration-200"
                          >
                            تحميل QR
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8">
                        <QrCode className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">سيتم إنشاء رمز QR تلقائياً عند حفظ الفاتورة</p>
                      </div>
                    )}
                  </div>

                  {/* Bill Summary */}
                  <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-3">ملخص الفاتورة</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">عدد الطلبات:</span>
                        <span className="font-medium">{selectedBill?.orders?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">عدد الجلسات:</span>
                        <span className="font-medium">{selectedBill?.sessions?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">تاريخ الإنشاء:</span>
                        <span className="font-medium">
                          {selectedBill?.createdAt ? new Date(selectedBill.createdAt).toLocaleDateString('ar-EG') : '-'}
                        </span>
                      </div>
                    </div>

                    {selectedBill?.qrCodeUrl && (
                      <div className="mt-4 pt-4 border-t">
                        <h6 className="font-medium text-gray-900 mb-2">رابط الفاتورة للعميل:</h6>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <input
                            type="text"
                            value={selectedBill.qrCodeUrl}
                            readOnly
                            className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1"
                          />
                          <button
                            onClick={() => {
                              const url = selectedBill?.qrCodeUrl;
                              if (url) {
                                navigator.clipboard.writeText(url);
                                alert('تم نسخ الرابط إلى الحافظة');
                              }
                            }}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors duration-200"
                          >
                            نسخ
                          </button>
                          <button
                            onClick={() => window.open(selectedBill.qrCodeUrl, '_blank')}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors duration-200"
                          >
                            فتح
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-between">
              {/* زر إلغاء الفاتورة - يظهر فقط إذا لم تكن مدفوعة بالكامل */}
              {selectedBill?.status !== 'paid' && (
                <button
                  onClick={async () => {
                    if (!selectedBill) return;

                    console.log('🔄 Billing: Cancel button clicked for bill:', selectedBill._id || selectedBill.id);
                    console.log('📄 Billing: Selected bill details:', {
                      id: selectedBill._id || selectedBill.id,
                      billNumber: selectedBill.billNumber,
                      status: selectedBill.status,
                      paid: selectedBill.paid,
                      total: selectedBill.total
                    });

                    if (confirm('هل أنت متأكد من إلغاء هذه الفاتورة؟')) {
                      try {
                        console.log('✅ Billing: User confirmed cancellation');
                        const result = await cancelBill(selectedBill._id || selectedBill.id);
                        console.log('📥 Billing: Cancel result:', result);

                        if (result) {
                          alert('تم إلغاء الفاتورة بنجاح');
                          setShowPaymentModal(false);
                        } else {
                          alert('فشل في إلغاء الفاتورة');
                        }
                      } catch (error) {
                        console.error('❌ Billing: Error cancelling bill:', error);
                        alert('حدث خطأ في إلغاء الفاتورة');
                      }
                    } else {
                      console.log('❌ Billing: User cancelled the operation');
                    }
                  }}
                  className="px-4 py-2 text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors duration-200"
                >
                  إلغاء الفاتورة
                </button>
              )}

              {/* رسالة للفواتير المدفوعة */}
              {selectedBill?.status === 'paid' && (
                <div className="flex items-center text-green-700">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">الفاتورة مدفوعة بالكامل</span>
                </div>
              )}

              <div className="flex space-x-3 space-x-reverse">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                >
                  إغلاق
                </button>

                {/* زر دفع الفاتورة بالكامل - يظهر فقط إذا لم تكن الفاتورة مدفوعة بالكامل */}
                {selectedBill?.status !== 'paid' && paymentAmount && (
                  <button
                    onClick={handlePaymentSubmit}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors duration-200"
                  >
                    دفع الفاتورة بالكامل
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Partial Payment Modal */}
      {showPartialPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">دفع مشروبات محددة - فاتورة #{selectedBill?.billNumber}</h3>
              <p className="text-sm text-gray-600 mt-1">اختر المشروبات المطلوب دفعها من هذه الفاتورة</p>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-4">اختر المشروبات المطلوب دفعها</h4>

                {billItems.length > 0 ? (
                  <div className="space-y-4">
                    {billItems.map((item, index) => {
                      const itemKey = item.orderId + '-' + item.itemName;
                      const isSelected = selectedItems[itemKey] || false;
                      const selectedQuantity = itemQuantities[itemKey] || 0;
                      const maxQuantity = item.quantity || 0;
                      const originalQuantity = item.originalQuantity || item.quantity || 0;
                      const paidQuantity = item.paidQuantity || 0;

                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id={`item-${index}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  setSelectedItems(prev => ({
                                    ...prev,
                                    [itemKey]: e.target.checked
                                  }));
                                  if (e.target.checked && !itemQuantities[itemKey]) {
                                    setItemQuantities(prev => ({
                                      ...prev,
                                      [itemKey]: 1
                                    }));
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                              />
                              <label htmlFor={`item-${index}`} className="mr-3 text-sm font-medium text-gray-900 cursor-pointer">
                                {item.itemName}
                              </label>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-semibold text-gray-900">{formatCurrency(item.price)}</div>
                              <div className="text-sm text-gray-500">
                                {paidQuantity > 0 && (
                                  <span className="text-blue-600">مدفوع: {paidQuantity}</span>
                                )}
                                {paidQuantity > 0 && maxQuantity > 0 && (
                                  <span className="mx-1">•</span>
                                )}
                                <span className="text-green-600">متبقي: {maxQuantity}</span>
                                {originalQuantity > maxQuantity && (
                                  <>
                                    <span className="mx-1">•</span>
                                    <span className="text-gray-500">إجمالي: {originalQuantity}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3 space-x-reverse">
                                <span className="text-sm text-gray-600">الكمية:</span>
                                <div className="flex items-center space-x-2 space-x-reverse">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (selectedQuantity > 0) {
                                        setItemQuantities(prev => ({
                                          ...prev,
                                          [itemKey]: selectedQuantity - 1
                                        }));
                                      }
                                    }}
                                    disabled={selectedQuantity <= 0}
                                    className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg flex items-center justify-center transition-colors duration-200"
                                  >
                                    -
                                  </button>
                                  <span className="w-12 text-center font-medium text-blue-900">
                                    {selectedQuantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (selectedQuantity < maxQuantity) {
                                        setItemQuantities(prev => ({
                                          ...prev,
                                          [itemKey]: selectedQuantity + 1
                                        }));
                                      }
                                    }}
                                    disabled={selectedQuantity >= maxQuantity}
                                    className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg flex items-center justify-center transition-colors duration-200"
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="text-sm text-blue-700">
                                  = {formatCurrency(item.price * selectedQuantity)}
                                </span>
                              </div>

                              {selectedQuantity < maxQuantity && (
                                <div className="text-xs text-blue-600">
                                  سيبقى {maxQuantity - selectedQuantity} {item.itemName} في الفاتورة
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🍹</div>
                    <p className="text-gray-500">لا توجد مشروبات في هذه الفاتورة</p>
                  </div>
                )}
              </div>

              {billItems.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-4">طريقة الدفع</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setPartialPaymentMethod('cash')}
                      className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${partialPaymentMethod === 'cash' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="text-2xl mb-1">💵</div>
                      <div className="text-sm font-medium">نقداً</div>
                    </button>
                    <button
                      onClick={() => setPartialPaymentMethod('card')}
                      className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${partialPaymentMethod === 'card' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="text-2xl mb-1">💳</div>
                      <div className="text-sm font-medium">بطاقة</div>
                    </button>
                    <button
                      onClick={() => setPartialPaymentMethod('transfer')}
                      className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${partialPaymentMethod === 'transfer' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="text-2xl mb-1">📱</div>
                      <div className="text-sm font-medium">تحويل</div>
                    </button>
                  </div>
                </div>
              )}

              {/* ملخص الدفع */}
              {Object.keys(selectedItems).some(id => selectedItems[id]) && (
                <div className="mb-6 bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">ملخص الدفع</h4>
                  <div className="space-y-2">
                    {billItems
                      .filter(item => {
                        const itemKey = item.orderId + '-' + item.itemName;
                        return selectedItems[itemKey] && itemQuantities[itemKey] > 0;
                      })
                      .map((item, index) => {
                        const itemKey = item.orderId + '-' + item.itemName;
                        const quantity = itemQuantities[itemKey] || 0;
                        return (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="text-blue-800">{item.itemName} × {quantity}</span>
                            <span className="font-medium text-blue-900">{formatCurrency(item.price * quantity)}</span>
                          </div>
                        );
                      })}
                    <div className="border-t border-blue-200 pt-2 mt-2">
                      <div className="flex justify-between font-medium text-blue-900">
                        <span>المجموع:</span>
                        <span>
                          {formatCurrency(
                            billItems
                              .filter(item => {
                                const itemKey = item.orderId + '-' + item.itemName;
                                return selectedItems[itemKey] && itemQuantities[itemKey] > 0;
                              })
                              .reduce((sum, item) => {
                                const itemKey = item.orderId + '-' + item.itemName;
                                const quantity = itemQuantities[itemKey] || 0;
                                return sum + (item.price * quantity);
                              }, 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => {
                  setShowPartialPaymentModal(false);
                  setSelectedItems({});
                  setBillItems([]);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              >
                إلغاء
              </button>

              <button
                onClick={handlePartialPaymentSubmit}
                disabled={!Object.keys(selectedItems).some(id => selectedItems[id] && itemQuantities[id] > 0)}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
              >
                تأكيد الدفع الجزئي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
