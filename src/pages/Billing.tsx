import { useEffect, useState } from 'react';
import { Receipt, QrCode, Printer, DollarSign, CreditCard, Calendar, User, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, Bill, Order, OrderItem } from '../services/api';
import { formatCurrency as formatCurrencyUtil } from '../utils/formatters';

// Type for interval
type Interval = ReturnType<typeof setInterval>;

const Billing = () => {
  const { bills, fetchBills, cancelBill, addPartialPayment, showNotification } = useApp();
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: boolean }>({});
  const [itemQuantities, setItemQuantities] = useState<{ [key: string]: number }>({});
  const [partialPaymentMethod, setPartialPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentReference, setPaymentReference] = useState('');

  useEffect(() => {
    fetchBills();
  }, []);

  // مراقبة تغييرات bills وتحديث selectedBill تلقائياً
  useEffect(() => {
    if (selectedBill && bills.length > 0) {
      const updatedBill = bills.find((bill: Bill) =>
        bill.id === selectedBill.id || bill._id === selectedBill._id
      );
      if (updatedBill && JSON.stringify(updatedBill) !== JSON.stringify(selectedBill)) {
        setSelectedBill(updatedBill);
      }
    }
  }, [bills, selectedBill]);

  // تحديث تلقائي لمبالغ الجلسات والفواتير كل دقيقة إذا كان هناك جلسة نشطة
  useEffect(() => {
    let interval: Interval | null = null;

    const updateActiveSessionsAndBills = async () => {
      const activeSessionBills = bills.filter(bill => hasActiveSession(bill));
      if (activeSessionBills.length === 0) return;
      await Promise.all(
        activeSessionBills.flatMap(bill =>
          bill.sessions
            .filter(session => session.status === 'active')
            .map(async session => {
              await api.updateSessionCost(session._id || session.id);
              // تحديث الفاتورة المختارة إذا كانت هي نفسها
              if (selectedBill && (selectedBill._id === bill._id || selectedBill.id === bill.id)) {
                const billRes = await api.getBill(bill._id || bill.id);
                if (billRes.success && billRes.data) {
                  setSelectedBill(billRes.data);
                }
              }
            })
        )
      );
      await fetchBills();
    };

    // دالة لفحص وجود جلسة نشطة
    const hasAnyActiveSession = () => bills.some(bill => hasActiveSession(bill));

    if (hasAnyActiveSession()) {
      interval = setInterval(updateActiveSessionsAndBills, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
    // الاعتماد فقط على وجود جلسة نشطة
  }, [bills.length, bills.map(b => b.sessions.map(s => s.status).join(',')).join(',')]);

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
  const safe = (val: unknown, fallback = '-') => (val !== undefined && val !== null && val !== '' ? String(val) : fallback);

  const handlePaymentClick = async (bill: Bill) => {
    setSelectedBill(bill);
    setPaymentAmount('');
    setShowPaymentModal(true);

    // تحديث حالة الفاتورة بناءً على الأصناف والجلسات
    await updateBillStatus(bill.id || bill._id);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedBill) return;

    // التحقق من وجود جلسات نشطة
    if (selectedBill && hasActiveSession(selectedBill)) {
      showNotification('لا يمكن الدفع - هذه الفاتورة تحتوي على جلسة نشطة. يرجى إنهاء الجلسة أولاً.');
      return;
    }

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

        // تحديث حالة الفاتورة بناءً على الأصناف والجلسات
        await updateBillStatus(selectedBill.id || selectedBill._id);

        showNotification('تم تسجيل الدفع بنجاح!');
      }
    } catch (error) {
      console.error('Failed to update payment:', error);
      showNotification('فشل في تسجيل الدفع');
    }
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount);
  };

  const getCustomerDisplay = (bill: Bill) => {
      return bill.customerName || 'عميل';
  };

  const filteredBills = bills.filter(bill => statusFilter === 'all' || bill.status === statusFilter);

  // Helper: Check if bill has any unprepared items
  const hasUnpreparedItems = (bill: Bill) => {
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
      setSelectedItems({});
      setItemQuantities({});

      // تحديث حالة الفاتورة بناءً على الأصناف والجلسات
      await updateBillStatus(bill.id || bill._id);
    } catch (error) {
      console.error('Failed to load bill items:', error);
    }
  };

  // دالة لتحديث حالة الفاتورة بناءً على الأصناف والجلسات
  const updateBillStatus = async (billId: string) => {
    try {
      // الحصول على عناصر الفاتورة
      const aggItems = aggregateItemsWithPayments(selectedBill?.orders || [], selectedBill?.partialPayments || []);

      // التحقق من وجود جلسات نشطة
      const hasActive = selectedBill ? hasActiveSession(selectedBill) : false;

      // التحقق من أن جميع الأصناف مدفوعة بالكامل
      const allItemsPaid = aggItems.every(item => item.remainingQuantity === 0);

      // تحديد الحالة الجديدة
      let newStatus: 'draft' | 'partial' | 'paid' | 'cancelled' | 'overdue';

      if (allItemsPaid && !hasActive) {
        // جميع الأصناف مدفوعة ولا توجد جلسات نشطة
        newStatus = 'paid';
      } else if (hasActive) {
        // توجد جلسات نشطة (حتى لو كانت جميع الأصناف مدفوعة)
        newStatus = 'partial';
      } else {
        // بعض الأصناف غير مدفوعة ولا توجد جلسات نشطة
        newStatus = 'partial';
      }

      // تحديث حالة الفاتورة في الباكند
      const result = await api.updateBill(billId, { status: newStatus });

      if (result && result.data) {
        // تحديث الفاتورة المحلية
        setSelectedBill(result.data);
        // إعادة تحميل قائمة الفواتير
        fetchBills();
      }
    } catch (error) {
      console.error('Failed to update bill status:', error);
      showNotification('فشل في تحديث حالة الفاتورة');
    }
  };

  const handlePartialPaymentSubmit = async () => {
    if (!selectedBill) return;

    // استخدم نفس منطق المفاتيح كما في aggregateItemsWithPayments
    const aggItems = aggregateItemsWithPayments(selectedBill?.orders || [], selectedBill?.partialPayments || []);
    const selectedItemIds = Object.keys(selectedItems).filter(id => selectedItems[id]);

    if (selectedItemIds.length === 0) {
      showNotification('يرجى تحديد العناصر المطلوب دفعها');
      return;
    }

    const itemsToPay = aggItems.filter(item => {
      const addonsKey = (item.addons || []).map((a: { name: string; price: number }) => `${a.name}:${a.price}`).sort().join('|');
      const itemKey = `${item.name}|${item.price}|${addonsKey}`;
      const isSelected = selectedItemIds.includes(itemKey);
      const hasQuantity = itemQuantities[itemKey] > 0;

      return isSelected && hasQuantity;
    }).map(item => {
      const addonsKey = (item.addons || []).map((a: { name: string; price: number }) => `${a.name}:${a.price}`).sort().join('|');
      const itemKey = `${item.name}|${item.price}|${addonsKey}`;
      const quantity = itemQuantities[itemKey] || 0;
      // ابحث عن العنصر الأصلي في selectedBill.orders للحصول على orderId وorderNumber
      const original = selectedBill?.orders?.find(order =>
        order.items?.some(orderItem => orderItem.name === item.name && orderItem.price === item.price)
      );

      return {
        itemName: item.name,
        price: item.price,
        quantity: Math.min(quantity, item.remainingQuantity),
        orderId: original?._id,
        orderNumber: original?.orderNumber,
        addons: item.addons || [],
      };
    });

    if (itemsToPay.length === 0) {
      showNotification('يرجى تحديد الكميات المطلوب دفعها');
      return;
    }

    // الحصول على orderId من أول عنصر
    const firstItem = itemsToPay[0];
    if (!firstItem || !firstItem.orderId) {
      showNotification('لم يتم العثور على عناصر صالحة للدفع');
      return;
    }

    try {
      const result = await addPartialPayment(selectedBill.id || selectedBill._id, {
        orderId: firstItem.orderId,
        items: itemsToPay.map(item => ({
          itemName: item.itemName,
          price: item.price,
          quantity: item.quantity,
          orderId: item.orderId,
          orderNumber: item.orderNumber,
          addons: item.addons || [],
        })),
        paymentMethod: partialPaymentMethod
      });

      if (result) {
        // تحديث بيانات الفاتورة المحلية
        setSelectedBill(result);

        // إعادة تعيين العناصر المحددة
        setSelectedItems({});
        setItemQuantities({});

        // تحديث حالة الفاتورة بناءً على الأصناف والجلسات
        await updateBillStatus(selectedBill.id || selectedBill._id);

        // إظهار رسالة نجاح
        showNotification('تم تسجيل الدفع الجزئي بنجاح!');
      }
    } catch (error) {
      console.error('Failed to add partial payment:', error);
      showNotification('فشل في تسجيل الدفع الجزئي');
    }
  };

    // دالة إنهاء الجلسة
  const handleEndSession = async (sessionId: string) => {
    if (!confirm('هل أنت متأكد من إنهاء هذه الجلسة؟')) {
      return;
    }

    try {
      const result = await api.endSession(sessionId);
      if (result && result.success) {
        showNotification('تم إنهاء الجلسة بنجاح!');

        // إعادة تحميل الفواتير لتحديث البيانات
        await fetchBills();

        // إعادة تعيين بيانات الدفع
        setPaymentAmount('');
        setPaymentMethod('cash');
        setPaymentReference('');

        // تحديث حالة الفاتورة بناءً على الأصناف والجلسات
        if (selectedBill) {
          await updateBillStatus(selectedBill.id || selectedBill._id);
        }

      } else {
        console.error('Failed to end session:', result);
        showNotification('فشل في إنهاء الجلسة');
      }
    } catch (error) {
      console.error('Failed to end session:', error);
      showNotification('حدث خطأ في إنهاء الجلسة');
    }
  };

  // دالة لفحص ما إذا كانت هناك جلسة نشطة مرتبطة بالفاتورة
  const hasActiveSession = (bill: Bill) => {
    if (!bill.sessions || bill.sessions.length === 0) {
      return false;
    }

    // استخدام نفس منطق BillView - التحقق من حالة الجلسات في الفاتورة نفسها
    const hasActive = bill.sessions.some(session => {
      const sessionStatus = typeof session === 'object' ? session.status : null;
      const isActive = sessionStatus === 'active';

      return isActive;
    });

    return hasActive;
  };

  // دالة لتجميع الأصناف والإضافات مع حساب الكمية والمدفوع والمتبقي (نفس منطق BillView)
  function aggregateItemsWithPayments(orders: Order[], partialPayments: Bill['partialPayments']) {
    type AggregatedItem = {
      name: string;
      price: number;
      totalQuantity: number;
      paidQuantity: number;
      remainingQuantity: number;
    };
    const map = new Map<string, AggregatedItem>();

    // Helper لحساب المدفوع لصنف رئيسي فقط
    function getPaidQty(itemName: string) {
      let paid = 0;
      partialPayments.forEach(payment => {
        if (!payment.items || !Array.isArray(payment.items)) return;
        payment.items.forEach((item: { itemName: string; quantity: number }) => {
            if (item.itemName === itemName) {
              paid += item.quantity;
          }
        });
      });
      return paid;
    }

    if (!orders || !Array.isArray(orders)) return [];

    orders.forEach(order => {
      if (!order.items) return; // تخطي الطلبات التي لا تحتوي على أصناف
      order.items.forEach((item: OrderItem) => {
        const key = `${item.name}|${item.price}`;
      if (!map.has(key)) {
          const paidQty = getPaidQty(item.name);
        map.set(key, {
            name: item.name,
          price: item.price,
          totalQuantity: item.quantity,
          paidQuantity: paidQty,
          remainingQuantity: item.quantity - paidQty,
        });
      }
      });
    });
    return Array.from(map.values());
  }

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
        {filteredBills.map((bill: Bill) => (
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
                <span className="truncate">{(getCustomerDisplay(bill as Bill) || 'عميل') as string}</span>
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
                  <span className="flex items-center gap-1">
                    الجلسات: {bill.sessions?.length || 0}
                    {hasActiveSession(bill) && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-red-600 font-bold">نشط</span>
                      </div>
                    )}
                  </span>
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
                        <span className="font-medium mr-2">{selectedBill && (getCustomerDisplay(selectedBill) as string)}</span>
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

                  {/* تفاصيل الجهاز النشط */}
                  {selectedBill && hasActiveSession(selectedBill) && (
                    <div className="bg-red-50 p-4 rounded-lg mb-6 border border-red-200">
                      <h5 className="font-medium text-red-900 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        الجهاز النشط
                      </h5>
                      <div className="space-y-2 text-sm">
                        {selectedBill.sessions?.filter(s => s.status === 'active').map((session, index) => (
                          <div key={index} className="bg-white p-3 rounded border border-red-100">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-red-800">{session.deviceName}</span>
                              <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                                {session.deviceType === 'playstation' ? 'بلايستيشن' : 'كمبيوتر'}
                              </span>
                            </div>
                            <div className="text-xs text-red-700 mb-3">
                              <div>وقت البداية: {new Date(session.startTime).toLocaleTimeString('ar-EG')}</div>
                              <div>المدة: {(() => {
                                const start = new Date(session.startTime);
                                const now = new Date();
                                const durationMs = now.getTime() - start.getTime();
                                const hours = Math.floor(durationMs / (1000 * 60 * 60));
                                const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                                return `${hours > 0 ? hours + ' ساعة' : ''} ${minutes > 0 ? minutes + ' دقيقة' : ''}`;
                              })()}</div>
                              {session.deviceType === 'playstation' && (
                                <div>عدد الدراعات: {session.controllers || 1}</div>
                              )}
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={() => handleEndSession(session._id || session.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors duration-200"
                              >
                                إنهاء الجلسة
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* المدفوعات الجزئية */}
                  {selectedBill?.partialPayments && selectedBill.partialPayments.length > 0 && (
                    <div className="bg-blue-50 p-4 rounded-lg mb-6">
                      <h5 className="font-medium text-blue-900 mb-3">المدفوعات الجزئية السابقة</h5>
                      <div className="space-y-2">
                        {/* تجميع الأصناف حسب الاسم والسعر */}
                        {(() => {
                          const itemMap = new Map<string, { itemName: string; price: number; totalQuantity: number; totalAmount: number }>();
                          selectedBill.partialPayments.forEach(payment => {
                            payment.items.forEach(item => {
                              const key = `${item.itemName}|${item.price}`;
                              if (!itemMap.has(key)) {
                                itemMap.set(key, {
                                  itemName: item.itemName,
                                  price: item.price,
                                  totalQuantity: item.quantity,
                                  totalAmount: item.price * item.quantity
                                });
                              } else {
                                const agg = itemMap.get(key)!;
                                agg.totalQuantity += item.quantity;
                                agg.totalAmount += item.price * item.quantity;
                              }
                            });
                          });
                          return Array.from(itemMap.values()).map((agg) => (
                            <div key={agg.itemName + agg.price} className="flex justify-between text-sm bg-white p-3 rounded-lg border border-blue-100 mb-1">
                              <span className="text-blue-800">{agg.itemName} × {agg.totalQuantity}</span>
                              <span className="text-blue-700 font-medium">{formatCurrency(agg.totalAmount)}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* إدخال الدفع - يظهر فقط إذا لم تكن الفاتورة مدفوعة بالكامل */}
                  {selectedBill?.status !== 'paid' && (
                    <>
                      {/* أزرار الدفع - معطل إذا كانت هناك جلسات نشطة */}
                      <div className="mb-6">
                        <h5 className="font-medium text-gray-900 mb-3">خيارات الدفع</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* زر دفع الفاتورة بالكامل */}
                          <button
                            onClick={() => {
                              if (selectedBill?.remaining && selectedBill.remaining > 0) {
                                setPaymentAmount(selectedBill.remaining.toString());
                              }
                              setPaymentMethod('cash');
                            }}
                            disabled={selectedBill ? hasActiveSession(selectedBill) : false}
                            className={`p-4 border-2 rounded-lg text-center transition-colors duration-200 ${
                              selectedBill && hasActiveSession(selectedBill)
                                ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="text-2xl mb-2">💰</div>
                            <div className="font-medium">دفع الفاتورة بالكامل</div>
                            <div className="text-sm text-gray-600">دفع المبلغ المتبقي بالكامل</div>
                            {selectedBill && hasActiveSession(selectedBill) && (
                              <div className="text-xs text-red-500 mt-1">غير متاح - جلسة نشطة</div>
                            )}
                          </button>

                          {/* زر دفع مشروب معين */}
                          <button
                            onClick={async () => {
                              if (selectedBill) {
                                await handlePartialPayment(selectedBill);
                              }
                            }}
                            className={`p-4 border-2 rounded-lg text-center transition-colors duration-200 border-gray-200 hover:border-gray-300`}
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
                              link.href = selectedBill?.qrCodeUrl || '';
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
                        <span className="font-medium flex items-center gap-1">
                          {selectedBill?.sessions?.length || 0}
                          {selectedBill && hasActiveSession(selectedBill) && (
                            <>
                              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-red-600 font-bold">نشط</span>
                            </>
                          )}
                        </span>
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
                                showNotification('تم نسخ الرابط إلى الحافظة');
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



                    if (confirm('هل أنت متأكد من إلغاء هذه الفاتورة؟')) {
                      try {

                        const result = await cancelBill(selectedBill._id || selectedBill.id);


                        if (result) {
                          showNotification('تم إلغاء الفاتورة بنجاح');
                          setShowPaymentModal(false);

                          // تحديث حالة الفاتورة بناءً على الأصناف والجلسات
                          await updateBillStatus(selectedBill._id || selectedBill.id);
                        } else {
                          showNotification('فشل في إلغاء الفاتورة');
                        }
                      } catch (error) {
                        console.error('❌ Billing: Error cancelling bill:', error);
                        showNotification('حدث خطأ في إلغاء الفاتورة');
                      }
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
                    disabled={selectedBill ? hasActiveSession(selectedBill) : false}
                    className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                      selectedBill && hasActiveSession(selectedBill)
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700 text-white'
                    }`}
                  >
                    {selectedBill && hasActiveSession(selectedBill) ? 'لا يمكن الدفع - جلسة نشطة' : 'دفع الفاتورة بالكامل'}
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

                {(() => {
                  const itemsWithRemaining = aggregateItemsWithPayments(selectedBill?.orders || [], selectedBill?.partialPayments || [])
                    .filter(item => item.remainingQuantity > 0);


                  if (itemsWithRemaining.length === 0) {
                    return (
                      <div className="text-center py-8 bg-green-50 rounded-lg border border-green-200">
                        <div className="text-4xl mb-4">✅</div>
                        <h5 className="font-medium text-green-900 mb-2">جميع العناصر مدفوعة بالكامل!</h5>
                        <p className="text-green-700">
                          لا توجد عناصر متبقية للدفع في هذه الفاتورة
                        </p>
                      </div>
                    );
                  }

                  return itemsWithRemaining.map((item) => {
                  // استخدم نفس منطق المفتاح كما في التجميع
                  const addonsKey = (item.addons || [])
                      .map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
                    .sort()
                    .join('|');
                    const itemKey = `${item.name}|${item.price}|${addonsKey}`;
                  return (
                    <div key={itemKey} className="bg-gray-50 rounded-lg p-4 border flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-primary-700">
                            {item.name}
                          {/* زر - للصنف الرئيسي */}
                          <button
                            type="button"
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-lg font-bold bg-white hover:bg-gray-100"
                            onClick={() => {
                              const newQty = Math.max(0, (itemQuantities[itemKey] || 0) - 1);
                              setItemQuantities({ ...itemQuantities, [itemKey]: newQty });
                              setSelectedItems(prev => {
                                const updated = { ...prev };
                                if (newQty > 0) updated[itemKey] = true;
                                else delete updated[itemKey];
                                return updated;
                              });
                            }}
                            disabled={(itemQuantities[itemKey] || 0) <= 0}
                          >-</button>
                          <span className="mx-2 w-6 text-center select-none font-bold text-primary-700">{itemQuantities[itemKey] || 0}</span>
                          {/* زر + للصنف الرئيسي */}
                          <button
                            type="button"
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-lg font-bold bg-white hover:bg-gray-100"
                            onClick={() => {
                              const newQty = Math.min(item.remainingQuantity, (itemQuantities[itemKey] || 0) + 1);
                              setItemQuantities({ ...itemQuantities, [itemKey]: newQty });
                              setSelectedItems(prev => ({ ...prev, [itemKey]: newQty > 0 }));
                            }}
                            disabled={(itemQuantities[itemKey] || 0) >= item.remainingQuantity}
                          >+</button>
                          {/* زر دفع الكمية بالكامل للصنف الرئيسي */}
                          <button
                            type="button"
                            className="ml-2 px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs"
                            onClick={() => {
                              setItemQuantities({ ...itemQuantities, [itemKey]: item.remainingQuantity });
                              setSelectedItems(prev => ({ ...prev, [itemKey]: item.remainingQuantity > 0 }));
                            }}
                            disabled={(itemQuantities[itemKey] || 0) === item.remainingQuantity}
                          >دفع الكمية بالكامل</button>
                        </div>
                        <div className="text-xs text-gray-500">{formatCurrency(item.price)}</div>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div>الكمية: <span className="font-bold">{item.totalQuantity}</span></div>
                        <div>المدفوع: <span className="text-green-700 font-bold">{item.paidQuantity}</span></div>
                        <div>المتبقي: <span className="text-yellow-700 font-bold">{item.remainingQuantity}</span></div>
                      </div>
                      {/* اختيار الكمية للدفع */}
                      {/* تم نقل أزرار التحكم بجانب اسم الصنف في الأعلى ولن تتكرر هنا */}
                      {/* عرض الإضافات */}
                      {item.addons && item.addons.length > 0 && (
                        <div className="mt-2 pl-4 border-r-2 border-yellow-200">
                            {item.addons
                              .filter(addon => addon.remainingQuantity > 0) // عرض الإضافات التي لها كمية متبقية فقط
                              .map((addon) => {
                            const addonKey = itemKey + '|addon|' + addon.name + '|' + addon.price;
                            const isAddonSelected = selectedItems[addonKey] || false;
                            // إذا كانت الإضافة برسوم ثابتة، لا يوجد إدخال كمية
                            return (
                              <div key={addonKey} className="flex flex-col gap-1 mb-2">
                                <div className="flex items-center gap-2 text-sm text-yellow-800">
                                  <span>↳ إضافة: {addon.name}</span>
                                  <span>({formatCurrency(addon.price)})</span>
                                  <span>الكمية: <b>{addon.totalQuantity}</b></span>
                                  <span>المدفوع: <b className="text-green-700">{addon.paidQuantity}</b></span>
                                  <span>المتبقي: <b className="text-yellow-700">{addon.remainingQuantity}</b></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isAddonSelected}
                                    onChange={e => setSelectedItems({ ...selectedItems, [addonKey]: e.target.checked })}
                                  />
                                    <div className="flex items-center justify-between gap-2 mt-2">
                                      <div className="font-bold text-yellow-800 flex-1 text-right">{addon.name}</div>
                                      <div className="text-xs text-gray-500 w-20 text-center">{formatCurrency(addon.price)}</div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-lg font-bold bg-white hover:bg-gray-100"
                                          onClick={() => {
                                            const newQty = Math.max(0, (itemQuantities[addonKey] || 0) - 1);
                                            setItemQuantities({ ...itemQuantities, [addonKey]: newQty });
                                            setSelectedItems(prev => {
                                              const updated = { ...prev };
                                              if (newQty > 0) updated[addonKey] = true;
                                              else delete updated[addonKey];
                                              return updated;
                                            });
                                          }}
                                          disabled={(itemQuantities[addonKey] || 0) <= 0}
                                        >-</button>
                                        <span className="mx-2 w-6 text-center select-none font-bold text-yellow-800">{itemQuantities[addonKey] || 0}</span>
                                        <button
                                          type="button"
                                          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-lg font-bold bg-white hover:bg-gray-100"
                                          onClick={() => {
                                            const newQty = Math.min(addon.remainingQuantity, (itemQuantities[addonKey] || 0) + 1);
                                            setItemQuantities({ ...itemQuantities, [addonKey]: newQty });
                                            setSelectedItems(prev => ({ ...prev, [addonKey]: newQty > 0 }));
                                          }}
                                          disabled={(itemQuantities[addonKey] || 0) >= addon.remainingQuantity}
                                        >+</button>
                                        <button
                                          type="button"
                                          className="ml-2 px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs"
                                          onClick={() => {
                                            setItemQuantities({ ...itemQuantities, [addonKey]: addon.remainingQuantity });
                                            setSelectedItems(prev => ({ ...prev, [addonKey]: addon.remainingQuantity > 0 }));
                                          }}
                                          disabled={(itemQuantities[addonKey] || 0) === addon.remainingQuantity}
                                        >دفع الكمية بالكامل</button>
                                      </div>
                                    </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                  });
                })()}
              </div>

              {(() => {
                const itemsWithRemaining = aggregateItemsWithPayments(selectedBill?.orders || [], selectedBill?.partialPayments || [])
                  .filter(item => item.remainingQuantity > 0);
                return itemsWithRemaining.length > 0;
              })() && (
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
                    {aggregateItemsWithPayments(selectedBill?.orders || [], selectedBill?.partialPayments || [])
                      .filter(item => {
                        const addonsKey = (item.addons || [])
                          .map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
                          .sort()
                          .join('|');
                        const itemKey = `${item.name}|${item.price}|${addonsKey}`;
                        return selectedItems[itemKey] && itemQuantities[itemKey] > 0;
                      })
                      .map((item, index) => {
                        const addonsKey = (item.addons || [])
                          .map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
                          .sort()
                          .join('|');
                        const itemKey = `${item.name}|${item.price}|${addonsKey}`;
                        const quantity = itemQuantities[itemKey] || 0;
                        return (
                          <div key={index} className="flex flex-col text-sm mb-3 p-2 bg-blue-100 rounded">
                            <span className="text-blue-800 font-medium">
                              {item.name}
                              {item.addons && item.addons.length > 0 && (
                                <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                                  إضافات
                                </span>
                              )}
                              {' '}× {quantity}
                            </span>
                            <span className="font-bold text-blue-900 mt-1">
                              المجموع: {formatCurrency(item.price * quantity)}
                            </span>
                          </div>
                        );
                      })}
                    <div className="border-t border-blue-200 pt-2 mt-2">
                      <div className="flex justify-between font-medium text-blue-900">
                        <span>المجموع:</span>
                        <span>
                          {formatCurrency(
                            aggregateItemsWithPayments(selectedBill?.orders || [], selectedBill?.partialPayments || [])
                              .filter(item => {
                                const addonsKey = (item.addons || [])
                                  .map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
                                  .sort()
                                  .join('|');
                                const itemKey = `${item.name}|${item.price}|${addonsKey}`;
                                return selectedItems[itemKey] && itemQuantities[itemKey] > 0;
                              })
                              .reduce((sum, item) => {
                                const addonsKey = (item.addons || [])
                                  .map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
                                  .sort()
                                  .join('|');
                                const itemKey = `${item.name}|${item.price}|${addonsKey}`;
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
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              >
                إلغاء
              </button>

              <button
                onClick={handlePartialPaymentSubmit}
                disabled={
                  !Object.keys(selectedItems).some(id => {
                    // تحقق من الصنف أو الإضافة
                    return selectedItems[id] && (itemQuantities[id] || 0) > 0;
                  })
                }
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
