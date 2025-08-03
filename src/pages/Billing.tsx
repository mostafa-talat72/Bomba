import { useEffect, useState } from 'react';
import { Receipt, QrCode, Printer, DollarSign, CreditCard, Calendar, User, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, Bill, Order, OrderItem } from '../services/api';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';

// Type for interval
type Interval = ReturnType<typeof setInterval>;

const Billing = () => {
  const { bills, fetchBills, cancelBill, addPartialPayment, showNotification } = useApp();
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [showSessionEndModal, setShowSessionEndModal] = useState(false);
  const [sessionToEnd, setSessionToEnd] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: boolean }>({});
  const [itemQuantities, setItemQuantities] = useState<{ [key: string]: number }>({});
  const [partialPaymentMethod, setPartialPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<string>('');
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
      case 'draft': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
      case 'partial': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'paid': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'overdue': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'cancelled': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
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
      case 'draft': return <Receipt className="h-4 w-4" />;
      case 'partial': return <DollarSign className="h-4 w-4" />;
      case 'paid': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      default: return <Receipt className="h-4 w-4" />;
    }
  };

  const safe = (val: unknown, fallback = '-') => (val !== undefined && val !== null && val !== '' ? String(val) : fallback);

  const handlePaymentClick = async (bill: Bill) => {
    setSelectedBill(bill);
    setPaymentAmount(bill.totalAmount.toString());
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedBill) return;

    try {
      const response = await api.payBill(selectedBill._id || selectedBill.id, {
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        reference: paymentReference
      });

      if (response.success) {
        showNotification('تم دفع الفاتورة بنجاح', 'success');
        setShowPaymentModal(false);
        setPaymentAmount('');
        setPaymentMethod('cash');
        setPaymentReference('');
        setSelectedBill(null);
        await fetchBills();
      } else {
        showNotification(response.message || 'حدث خطأ أثناء دفع الفاتورة', 'error');
      }
    } catch (error) {
      console.error('Error paying bill:', error);
      showNotification('حدث خطأ أثناء دفع الفاتورة', 'error');
    }
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount);
  };

  const getCustomerDisplay = (bill: Bill) => {
    if (bill.customerName) {
      return bill.customerName;
    }
    if (bill.customerPhone) {
      return `عميل - ${bill.customerPhone}`;
    }
    if (bill.customerId) {
      return `عميل - ${bill.customerId}`;
    }
    return 'عميل بدون اسم';
  };

  const hasUnpreparedItems = (bill: Bill) => {
    return bill.orders.some(order =>
      order.items.some(item => item.status === 'pending' || item.status === 'preparing')
    );
  };

  const handlePartialPayment = async (bill: Bill) => {
    setSelectedBill(bill);
    setPaymentAmount('');
    setPartialPaymentMethod('cash');
    setPaymentReference('');
    setShowPartialPaymentModal(true);
  };

  const updateBillStatus = async (billId: string) => {
    try {
      const response = await api.getBill(billId);
      if (response.success && response.data) {
        const updatedBill = response.data;
        setSelectedBill(updatedBill);

        // تحديث قائمة الفواتير
        const updatedBills = bills.map(bill =>
          (bill._id === billId || bill.id === billId) ? updatedBill : bill
        );
        // يمكن إضافة دالة لتحديث قائمة الفواتير في context إذا كانت متاحة
      }
    } catch (error) {
      console.error('Error updating bill status:', error);
    }
  };

  const handlePartialPaymentSubmit = async () => {
    if (!selectedBill || !paymentAmount) return;

    try {
      const amount = parseFloat(paymentAmount);
      if (amount <= 0) {
        showNotification('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

      if (amount >= selectedBill.totalAmount) {
        showNotification('المبلغ المدخل أكبر من أو يساوي المبلغ الإجمالي. استخدم دفع كامل بدلاً من ذلك.', 'error');
      return;
    }

      const response = await addPartialPayment(selectedBill._id || selectedBill.id, {
        amount: amount,
        method: partialPaymentMethod,
        reference: paymentReference
      });

      if (response.success) {
        showNotification('تم إضافة الدفع الجزئي بنجاح', 'success');
        setShowPartialPaymentModal(false);
        setPaymentAmount('');
        setPartialPaymentMethod('cash');
        setPaymentReference('');
        setSelectedBill(null);
        await fetchBills();
      } else {
        showNotification(response.message || 'حدث خطأ أثناء إضافة الدفع الجزئي', 'error');
      }
    } catch (error) {
      console.error('Error adding partial payment:', error);
      showNotification('حدث خطأ أثناء إضافة الدفع الجزئي', 'error');
    }
  };

  const handleEndSession = async (sessionId: string) => {
    setSessionToEnd(sessionId);
    setShowSessionEndModal(true);
  };

  const confirmSessionEnd = async () => {
    if (!sessionToEnd) return;

    try {
      const response = await api.endSession(sessionToEnd);
      if (response.success) {
        showNotification('تم إنهاء الجلسة بنجاح', 'success');
        setShowSessionEndModal(false);
        setSessionToEnd(null);
        await fetchBills();

        // تحديث الفاتورة المختارة إذا كانت تحتوي على الجلسة المنتهية
        if (selectedBill) {
          await updateBillStatus(selectedBill._id || selectedBill.id);
        }
      } else {
        showNotification(response.message || 'حدث خطأ أثناء إنهاء الجلسة', 'error');
      }
    } catch (error) {
      console.error('Error ending session:', error);
      showNotification('حدث خطأ أثناء إنهاء الجلسة', 'error');
    }
  };

  const hasActiveSession = (bill: Bill) => {
    return bill.sessions && bill.sessions.some(session => session.status === 'active');
  };

  function aggregateItemsWithPayments(orders: Order[], partialPayments: Bill['partialPayments']) {
    type AggregatedItem = {
      name: string;
      price: number;
      totalQuantity: number;
      paidQuantity: number;
      remainingQuantity: number;
    };

    const itemMap = new Map<string, AggregatedItem>();

    function getPaidQty(itemName: string) {
      if (!partialPayments || partialPayments.length === 0) return 0;

      let totalPaid = 0;
      partialPayments.forEach(payment => {
        if (payment.items && payment.items.length > 0) {
          const itemPayment = payment.items.find(item => item.name === itemName);
          if (itemPayment) {
            totalPaid += itemPayment.quantity || 0;
          }
        }
      });
      return totalPaid;
    }

    orders.forEach(order => {
      order.items.forEach(item => {
        const key = item.name;
        const existingItem = itemMap.get(key);
          const paidQty = getPaidQty(item.name);

        if (existingItem) {
          existingItem.totalQuantity += item.quantity;
          existingItem.paidQuantity = Math.max(existingItem.paidQuantity, paidQty);
        } else {
          itemMap.set(key, {
            name: item.name,
          price: item.price,
          totalQuantity: item.quantity,
          paidQuantity: paidQty,
            remainingQuantity: item.quantity - paidQty
        });
      }
      });
    });

    return Array.from(itemMap.values());
  }

  const filteredBills = bills.filter(bill => {
    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
    const matchesDate = !dateFilter || bill.createdAt?.includes(dateFilter);
    return matchesStatus && matchesDate;
  });

  return (
    <div className="space-y-6 min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center">
          <Receipt className="h-8 w-8 text-orange-600 dark:text-orange-400 ml-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة الفواتير</h1>
            <p className="text-gray-600 dark:text-gray-400">متابعة وإدارة الفواتير والمدفوعات</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">حالة الفاتورة</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
              <option value="all">جميع الحالات</option>
                <option value="draft">مسودة</option>
                <option value="partial">مدفوع جزئياً</option>
                <option value="paid">مدفوع بالكامل</option>
                <option value="overdue">متأخر</option>
                <option value="cancelled">ملغية</option>
              </select>
            </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">التاريخ</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
      </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter('all');
                setDateFilter('');
              }}
              className="w-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg transition-colors duration-200 font-medium"
            >
              إعادة تعيين
            </button>
                </div>
              </div>
              </div>

      {/* Bills List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">قائمة الفواتير</h3>
              </div>
        <div className="p-6">
          {filteredBills.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">لا توجد فواتير</p>
          ) : (
            <div className="space-y-4">
              {filteredBills.map((bill) => (
                <div key={bill._id || bill.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4 space-x-reverse">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(bill.status)}`}>
                          {getStatusText(bill.status)}
                  </span>
                    {hasActiveSession(bill) && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            جلسة نشطة
                  </span>
                )}
              </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(bill.createdAt).toLocaleDateString('ar-EG')}
                      </span>
            </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(bill.totalAmount)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {getCustomerDisplay(bill)}
          </p>
        </div>
            </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {bill.orders.length} طلب
                        </span>
                      {hasUnpreparedItems(bill) && (
                        <span className="text-sm text-yellow-600 dark:text-yellow-400">
                          • تحتوي على عناصر غير جاهزة
                              </span>
                              )}
                            </div>

                    <div className="flex space-x-2 space-x-reverse">
                      {bill.status === 'draft' && (
                              <button
                          onClick={() => handlePaymentClick(bill)}
                          className="px-3 py-1 bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600 text-white text-sm rounded font-medium transition-colors duration-200"
                              >
                          دفع كامل
                              </button>
                      )}

                      {bill.status === 'partial' && (
                          <button
                          onClick={() => handlePartialPayment(bill)}
                          className="px-3 py-1 bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600 text-white text-sm rounded font-medium transition-colors duration-200"
                        >
                          دفع جزئي
                          </button>
                      )}

                          <button
                        onClick={() => setSelectedBill(bill)}
                        className="px-3 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 text-sm rounded font-medium transition-colors duration-200"
                      >
                        عرض التفاصيل
                          </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
                        </div>
                      </div>

      {/* Bill Details Modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">تفاصيل الفاتورة</h2>
              <button
                onClick={() => setSelectedBill(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
                          </div>

            <div className="space-y-6">
              {/* Bill Header */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">رقم الفاتورة</p>
                    <p className="font-medium text-gray-900 dark:text-white">{safe(selectedBill.billNumber)}</p>
                          </div>
                              <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">التاريخ</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(selectedBill.createdAt).toLocaleDateString('ar-EG')}
                                </p>
                              </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">الحالة</p>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedBill.status)}`}>
                      {getStatusText(selectedBill.status)}
                    </span>
                            </div>
                          </div>
                        </div>

              {/* Customer Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">معلومات العميل</h3>
                <p className="text-gray-600 dark:text-gray-400">{getCustomerDisplay(selectedBill)}</p>
                        </div>

              {/* Orders */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 dark:text-white">الطلبات</h3>
                {selectedBill.orders.map((order, orderIndex) => (
                  <div key={order._id || order.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">طلب #{orderIndex + 1}</h4>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(order.createdAt).toLocaleTimeString('ar-EG')}
                      </span>
                      </div>

                    <div className="space-y-2">
                      {order.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                          <div className="flex items-center space-x-3 space-x-reverse">
                            <span className="text-gray-900 dark:text-white">{item.name}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {item.quantity} × {formatCurrency(item.price)}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {formatCurrency(item.quantity * item.price)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {item.status === 'ready' ? 'جاهز' : item.status === 'preparing' ? 'قيد التحضير' : 'في الانتظار'}
                            </p>
                        </div>
                        </div>
                      ))}
                        </div>
                      </div>
                ))}
                </div>

              {/* Sessions */}
              {selectedBill.sessions && selectedBill.sessions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">الجلسات</h3>
                  {selectedBill.sessions.map((session) => (
                    <div key={session._id || session.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {session.deviceName || session.deviceId}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {session.startTime ? new Date(session.startTime).toLocaleString('ar-EG') : 'بدون وقت بداية'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(session.cost || 0)}
                          </p>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            session.status === 'active'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}>
                            {session.status === 'active' ? 'نشطة' : 'منتهية'}
                          </span>
                                        </div>
                                      </div>

                      {session.status === 'active' && (
                          <button
                          onClick={() => handleEndSession(session._id || session.id)}
                          className="mt-2 px-3 py-1 bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 text-white text-sm rounded font-medium transition-colors duration-200"
                        >
                          إنهاء الجلسة
                          </button>
                      )}
                        </div>
                  ))}
                      </div>
                    )}

              {/* Partial Payments */}
              {selectedBill.partialPayments && selectedBill.partialPayments.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">المدفوعات الجزئية</h3>
                  {selectedBill.partialPayments.map((payment, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {payment.method === 'cash' ? 'نقداً' : payment.method === 'card' ? 'بطاقة' : 'تحويل'}
                          </p>
                      </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {payment.createdAt ? new Date(payment.createdAt).toLocaleString('ar-EG') : 'بدون تاريخ'}
                          </p>
                          {payment.reference && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              مرجع: {payment.reference}
                            </p>
                          )}
                      </div>
                      </div>
                    </div>
                  ))}
                      </div>
                    )}

              {/* Total */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium text-gray-900 dark:text-white">الإجمالي</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(selectedBill.totalAmount)}
                  </span>
                  </div>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-4 text-center text-gray-900 dark:text-white">دفع الفاتورة</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المبلغ</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">طريقة الدفع</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'transfer')}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="cash">نقداً</option>
                  <option value="card">بطاقة ائتمان</option>
                  <option value="transfer">تحويل بنكي</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المرجع (اختياري)</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="رقم المرجع"
                />
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <button
                  onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded font-medium transition-colors duration-200"
                >
                إلغاء
                </button>
                  <button
                    onClick={handlePaymentSubmit}
                className="px-6 py-2 bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600 text-white rounded font-medium transition-colors duration-200"
              >
                تأكيد الدفع
                  </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Payment Modal */}
      {showPartialPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-4 text-center text-gray-900 dark:text-white">دفع جزئي</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المبلغ</label>
                                  <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00"
                  min="0"
                  max={selectedBill.totalAmount}
                  step="0.01"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  المتبقي: {formatCurrency(selectedBill.totalAmount - (parseFloat(paymentAmount) || 0))}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">طريقة الدفع</label>
                <select
                  value={partialPaymentMethod}
                  onChange={(e) => setPartialPaymentMethod(e.target.value as 'cash' | 'card' | 'transfer')}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="cash">نقداً</option>
                  <option value="card">بطاقة ائتمان</option>
                  <option value="transfer">تحويل بنكي</option>
                </select>
                  </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المرجع (اختياري)</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="رقم المرجع"
                />
                          </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setShowPartialPaymentModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded font-medium transition-colors duration-200"
              >
                إلغاء
              </button>
              <button
                onClick={handlePartialPaymentSubmit}
                className="px-6 py-2 bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600 text-white rounded font-medium transition-colors duration-200"
              >
                تأكيد الدفع الجزئي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session End Confirmation Modal */}
      {showSessionEndModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-4 text-center text-gray-900 dark:text-white">تأكيد إنهاء الجلسة</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              هل أنت متأكد من إنهاء هذه الجلسة؟ هذا الإجراء لا يمكن التراجع عنه.
            </p>

            <div className="flex justify-between">
              <button
                onClick={() => setShowSessionEndModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded font-medium transition-colors duration-200"
              >
                إلغاء
              </button>
              <button
                onClick={confirmSessionEnd}
                className="px-6 py-2 bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 text-white rounded font-medium transition-colors duration-200"
              >
                إنهاء الجلسة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
