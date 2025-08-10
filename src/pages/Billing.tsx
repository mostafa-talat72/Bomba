import { useEffect, useState } from 'react';
import { Receipt, QrCode, Printer, DollarSign, CreditCard, Calendar, User, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, Bill, Order, OrderItem } from '../services/api';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';
import ConfirmModal from '../components/ConfirmModal';

// Type for interval
type Interval = ReturnType<typeof setInterval>;

const Billing = () => {
  const { bills, fetchBills, cancelBill, addPartialPayment, showNotification, user } = useApp();

  // دالة للتحقق من نوع المستخدم
  const checkUserRole = () => {
    // التحقق من الدور
    if (user?.role === 'manager' || user?.role === 'owner' || user?.role === 'admin') {
      return true; // مدير
    }

    // التحقق من الصلاحيات
    if (user?.permissions?.includes('view_all_bills') ||
        user?.permissions?.includes('admin') ||
        user?.permissions?.includes('all')) {
      return true; // مدير
    }

    // التحقق من اسم المستخدم (للتجربة)
    if (user?.email === 'admin@example.com' || user?.name === 'Admin') {
      return true; // مدير
    }

    // للتجربة - يمكن تغيير هذه القيمة يدوياً
    // return true; // لجعل الجميع مديرين
    // return false; // لجعل الجميع موظفين

    // افتراضياً - موظف
    return false;
  };

  const isManagerOrOwner = checkUserRole();
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
  const [dateFilter, setDateFilter] = useState<string>(() => {
    if (isManagerOrOwner) {
      // للمديرين وصاحب المنشأة - لا يوجد تاريخ افتراضي (جميع الفواتير)
      return '';
    }
    // للموظفين - تاريخ اليوم الحالي
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // تحديد الحد الأدنى للتاريخ (اليوم السابق للموظفين فقط)
  const minDate = (() => {
    if (isManagerOrOwner) {
      // للمديرين وصاحب المنشأة - لا يوجد حد أدنى
      return '';
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  })();

  // تحديد الحد الأقصى للتاريخ (اليوم الحالي للموظفين فقط)
  const maxDate = (() => {
    if (isManagerOrOwner) {
      // للمديرين وصاحب المنشأة - لا يوجد حد أقصى
      return '';
    }
    const today = new Date();
    return today.toISOString().split('T')[0];
  })();
  const [paymentReference, setPaymentReference] = useState('');
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [isCancelingBill, setIsCancelingBill] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isProcessingPartialPayment, setIsProcessingPartialPayment] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);

  useEffect(() => {
    // تحميل البيانات الأولية
    fetchBills();

    // إعداد التحديث التلقائي كل 5 ثوانٍ
    const intervalId = setInterval(() => {

      fetchBills();
    }, 5000); // 5000 مللي ثانية = 5 ثوانٍ

    // تنظيف المؤقت عند إلغاء تحميل المكون
    return () => {
      clearInterval(intervalId);
    };
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
      case 'unpaid': return 'bg-orange-100 text-orange-800';
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
      case 'unpaid': return 'غير مدفوع';
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
      case 'unpaid': return '💳';
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
      setIsProcessingPayment(true);
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
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount);
  };

  const getCustomerDisplay = (bill: Bill) => {
    return bill.customerName || 'عميل';
  };

  // فلترة الفواتير المتاحة للموظفين
  let availableBills = bills;
  if (!isManagerOrOwner) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    availableBills = bills.filter((bill: Bill) => {
      if (!bill.createdAt) return false;
      const billDate = new Date(bill.createdAt);
      return billDate.toDateString() === today.toDateString() ||
             billDate.toDateString() === yesterday.toDateString();
    });
  }

  const filteredBills = availableBills.filter(bill => {
    // فلترة حسب الحالة
    let statusMatch = false;
    if (statusFilter === 'all') {
      statusMatch = true;
    } else if (statusFilter === 'unpaid') {
      // دمج المسودة والمدفوع جزئياً تحت "غير مدفوع"
      statusMatch = bill.status === 'draft' || bill.status === 'partial';
    } else {
      statusMatch = bill.status === statusFilter;
    }

    // فلترة حسب التاريخ
    let dateMatch = true;
    if (dateFilter) {
      const billDate = new Date(bill.createdAt);
      const filterDate = new Date(dateFilter);

      // مقارنة التاريخ فقط (بدون الوقت)
      const billDateOnly = new Date(billDate.getFullYear(), billDate.getMonth(), billDate.getDate());
      const filterDateOnly = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());

      dateMatch = billDateOnly.getTime() === filterDateOnly.getTime();
    }

    return statusMatch && dateMatch;
  });

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
      setIsProcessingPartialPayment(true);
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
    } finally {
      setIsProcessingPartialPayment(false);
    }
  };

  // دالة إنهاء الجلسة
  const handleEndSession = async (sessionId: string) => {
    setSessionToEnd(sessionId);
    setShowSessionEndModal(true);
  };

  const confirmSessionEnd = async () => {
    if (!sessionToEnd) return;
    
    setIsEndingSession(true);

    try {
      const result = await api.endSession(sessionToEnd);
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
    } finally {
      setIsEndingSession(false);
      setSessionToEnd(null);
      setShowSessionEndModal(false);
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

  const handleCancelBill = async () => {
    if (!selectedBill) return;
    
    try {
      setIsCancelingBill(true);
      const result = await api.cancelBill(selectedBill._id);
      showNotification('تم إلغاء الفاتورة بنجاح', 'success');
      setShowCancelConfirmModal(false);
      setShowPaymentModal(false);
      await fetchBills();
      setSelectedBill(null);
    } catch (error) {
      showNotification('حدث خطأ أثناء إلغاء الفاتورة', 'error');
    } finally {
      setIsCancelingBill(false);
    }
  };

  // دالة لحساب الإحصائيات المفلترة
  const getFilteredStats = () => {
    // للموظفين - فلترة إضافية على التواريخ
    let availableBills = bills;
    if (!isManagerOrOwner) {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      availableBills = bills.filter((bill: Bill) => {
        if (!bill.createdAt) return false;
        const billDate = new Date(bill.createdAt);
        return billDate.toDateString() === today.toDateString() ||
               billDate.toDateString() === yesterday.toDateString();
      });
    }

    const filteredBills = availableBills.filter(bill => {
      // إذا كان الفلتر "غير مدفوع"، نضمّن الحالات التالية:
      if (statusFilter === 'unpaid') {
        if (!['draft', 'partial', 'unpaid'].includes(bill.status)) return false;
      }
      // التصفية العادية للحالات الأخرى
      else if (statusFilter !== 'all' && bill.status !== statusFilter) {
        return false;
      }

      // تصفية التاريخ إذا كان محددًا
      if (dateFilter) {
        const billDate = new Date(bill.createdAt);
        const filterDate = new Date(dateFilter);
        return billDate.toDateString() === filterDate.toDateString();
      }

      return true;
    });

    // حساب الإحصائيات
    const stats = filteredBills.reduce((acc, bill) => {
      const total = Number(bill.total) || 0;
      const paid = Number(bill.paid) || 0;
      const remaining = total - paid;

      return {
        totalBills: acc.totalBills + 1,
        totalPaid: acc.totalPaid + paid,
        totalRemaining: acc.totalRemaining + remaining,
        partialBills: acc.partialBills + (bill.status === 'partial' ? 1 : 0),
        totalAmount: acc.totalAmount + total
      };
    }, {
      totalBills: 0,
      totalPaid: 0,
      totalRemaining: 0,
      partialBills: 0,
      totalAmount: 0
    });

    return stats;
  };

  // دالة لتجميع الأصناف والإضافات مع حساب الكمية والمدفوع والمتبقي (نفس منطق BillView)
  function aggregateItemsWithPayments(orders: Order[], partialPayments: Bill['partialPayments']) {
    type AggregatedItem = {
      name: string;
      price: number;
      totalQuantity: number;
      paidQuantity: number;
      remainingQuantity: number;
      addons?: Array<{
        name: string;
        price: number;
        totalQuantity: number;
        paidQuantity: number;
        remainingQuantity: number;
      }>;
    };
    const map = new Map<string, AggregatedItem>();

    // Helper لحساب المدفوع لصنف رئيسي فقط
    function getPaidQty(itemName: string) {
      let paid = 0;
      if (partialPayments) {
        partialPayments.forEach(payment => {
          if (!payment.items || !Array.isArray(payment.items)) return;
          payment.items.forEach((item: { itemName: string; quantity: number }) => {
              if (item.itemName === itemName) {
                paid += item.quantity;
            }
          });
        });
      }
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
      <div className="flex items-center justify-between flex-wrap xs:flex-col xs:items-start xs:gap-2 xs:space-y-2 xs:w-full">
        <div className="flex items-center xs:w-full xs:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center xs:text-base xs:w-full xs:text-center">
            <Receipt className="h-6 w-6 text-orange-600 dark:text-orange-400 ml-2" />
            إدارة الفواتير
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mr-4 xs:mr-0 xs:w-full xs:text-center">متابعة الفواتير والمدفوعات</p>
        </div>
        <div className="flex items-center gap-2 xs:w-full xs:justify-center xs:mt-2">
          {/* ضع هنا أزرار الإجراءات مثل الفلترة أو إضافة فاتورة */}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mr-3 sm:mr-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">
                إجمالي الفواتير
              </p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatDecimal(getFilteredStats().totalBills)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="mr-3 sm:mr-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">
                المبلغ المحصل
              </p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(getFilteredStats().totalPaid)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="mr-3 sm:mr-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">
                المبلغ المتبقي
              </p>
              <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(getFilteredStats().totalRemaining)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mr-3 sm:mr-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">
                فواتير جزئية
              </p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatDecimal(getFilteredStats().partialBills)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 sm:space-x-reverse">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">الفواتير الحالية</h3>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {formatDecimal(getFilteredStats().totalBills)} {isManagerOrOwner ? `من ${formatDecimal(bills.length)} فاتورة` : 'فاتورة'}
                {dateFilter && (
                  <div className="text-blue-600 dark:text-blue-400 mt-1">
                    التاريخ: {new Date(dateFilter).toLocaleDateString('ar-EG')}
                  </div>
                )}
              </div>
            </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 sm:space-x-reverse">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 sm:space-x-reverse w-full sm:w-auto">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">التاريخ:</label>
              <div className="flex items-center space-x-2 space-x-reverse w-full sm:w-auto">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  min={minDate}
                  max={maxDate}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-full sm:w-auto bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <button
                  onClick={() => {
                    const today = new Date();
                    setDateFilter(today.toISOString().split('T')[0]);
                  }}
                  className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 whitespace-nowrap px-2 py-1 rounded hover:bg-orange-50 dark:hover:bg-orange-900"
                >
                  اليوم الحالي
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 sm:space-x-reverse w-full sm:w-auto">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">فلترة حسب الحالة:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-full sm:w-auto bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">جميع الفواتير</option>
                <option value="unpaid">غير مدفوع</option>
                <option value="paid">مدفوع بالكامل</option>
                <option value="overdue">متأخر</option>
                <option value="cancelled">ملغية</option>
              </select>
            </div>
            {(statusFilter !== 'all' || (isManagerOrOwner ? dateFilter : dateFilter !== maxDate)) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  if (isManagerOrOwner) {
                    // للمديرين - مسح التاريخ تماماً (جميع الفواتير)
                    setDateFilter('');
                  } else {
                    // للموظفين - إعادة إلى اليوم الحالي
                    const today = new Date();
                    setDateFilter(today.toISOString().split('T')[0]);
                  }
                }}
                className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 whitespace-nowrap px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors duration-200"
              >
                إعادة تعيين الفلترة
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bills Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {filteredBills.map((bill: Bill) => (
          <div
            key={bill.id || bill._id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 cursor-pointer relative"
            onClick={() => handlePaymentClick(bill)}
          >
            {/* Unprepared Items Badge */}
            {hasUnpreparedItems(bill) && (
              <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
                طلبات غير جاهزة
              </span>
            )}
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <span className="text-xl sm:text-2xl mr-2">{getStatusIcon(bill.status)}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(bill.status)}`}>
                    {getStatusText(bill.status)}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">#{safe(bill.billNumber, bill.id || bill._id)}</span>
              </div>

              <div className="flex items-center text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-1">
                <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="truncate">{(getCustomerDisplay(bill as Bill) || 'عميل') as string}</span>
              </div>

              <div className="flex items-center text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span>{bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('ar-EG') : '-'}</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-3 sm:p-4">
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">المبلغ الكلي:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">{formatCurrency(bill.total || 0)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">المدفوع:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400 text-sm sm:text-base">{formatCurrency(bill.paid || 0)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">المتبقي:</span>
                  <span className={`font-semibold text-sm sm:text-base ${(bill.remaining || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {formatCurrency(bill.remaining || 0)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                  <span>الطلبات: {formatDecimal(bill.orders?.length || 0)}</span>
                  <span className="flex items-center gap-1">
                    الجلسات: {formatDecimal(bill.sessions?.length || 0)}
                    {hasActiveSession(bill) && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-red-600 dark:text-red-400 font-bold">نشط</span>
                      </div>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`p-3 sm:p-4 border-t border-gray-100 dark:border-gray-700 rounded-b-lg ${bill.status === 'paid' ? 'bg-green-50 dark:bg-green-900' : 'bg-gray-50 dark:bg-gray-700'
              }`}>
              <div className={`flex items-center justify-center text-xs sm:text-sm font-medium ${bill.status === 'paid' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                }`}>
                {bill.status === 'paid' ? (
                  <>
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    مدفوع بالكامل
                  </>
                ) : (
                  <>
                    <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
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
          <Receipt className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">لا توجد فواتير</h3>
          <p className="text-gray-600 dark:text-gray-300">
            {(() => {
              let message = '';
              if (statusFilter === 'all' && !dateFilter) {
                message = 'لم يتم إنشاء أي فواتير بعد';
              } else if (statusFilter !== 'all' && !dateFilter) {
                if (statusFilter === 'unpaid') {
                  message = 'لا توجد فواتير غير مدفوعة (مسودة أو مدفوع جزئياً)';
                } else {
                  message = `لا توجد فواتير بحالة "${getStatusText(statusFilter)}"`;
                }
              } else if (statusFilter === 'all' && dateFilter) {
                message = `لا توجد فواتير بتاريخ ${new Date(dateFilter).toLocaleDateString('ar-EG')}`;
              } else {
                if (statusFilter === 'unpaid') {
                  message = `لا توجد فواتير غير مدفوعة (مسودة أو مدفوع جزئياً) بتاريخ ${new Date(dateFilter).toLocaleDateString('ar-EG')}`;
                } else {
                  message = `لا توجد فواتير بحالة "${getStatusText(statusFilter)}" بتاريخ ${new Date(dateFilter).toLocaleDateString('ar-EG')}`;
                }
              }
              return message;
            })()}
          </p>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">إدارة الدفع - فاتورة #{selectedBill?.billNumber || selectedBill?.id || selectedBill?._id}</h3>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Payment Section */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">معلومات الدفع</h4>

                  {/* معلومات الفاتورة */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                    <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">معلومات الفاتورة</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-300">رقم الفاتورة:</span>
                        <span className="font-medium mr-2 dark:text-gray-100">#{selectedBill?.billNumber || selectedBill?.id || selectedBill?._id}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-300">العميل:</span>
                        <span className="font-medium mr-2 dark:text-gray-100">{selectedBill && (getCustomerDisplay(selectedBill) as string)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-300">المبلغ الكلي:</span>
                        <span className="font-medium text-green-600 dark:text-green-400 mr-2">{formatCurrency(selectedBill?.total || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-300">المدفوع مسبقاً:</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400 mr-2">{formatCurrency(selectedBill?.paid || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-300">المتبقي:</span>
                        <span className="font-medium text-red-600 dark:text-red-400 mr-2">{formatCurrency(selectedBill?.remaining || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-300">الحالة:</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full mr-2 ${getStatusColor(selectedBill?.status || 'draft')}`}>
                          {getStatusText(selectedBill?.status || 'draft')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* تفاصيل الجهاز النشط */}
                  {selectedBill && hasActiveSession(selectedBill) && (
                    <div className="bg-red-50 dark:bg-red-900 p-4 rounded-lg mb-6 border border-red-200 dark:border-red-700">
                      <h5 className="font-medium text-red-900 dark:text-red-100 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        الجهاز النشط
                      </h5>
                      <div className="space-y-2 text-sm">
                        {selectedBill.sessions?.filter(s => s.status === 'active').map((session, index) => (
                          <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded border border-red-100 dark:border-red-700">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-red-800 dark:text-red-200">{session.deviceName}</span>
                              <span className="text-xs text-red-600 dark:text-red-300 bg-red-100 dark:bg-red-800 px-2 py-1 rounded">
                                {session.deviceType === 'playstation' ? 'بلايستيشن' : 'كمبيوتر'}
                              </span>
                            </div>
                            <div className="text-xs text-red-700 dark:text-red-300 mb-3">
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
                    <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg mb-6">
                      <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-3">المدفوعات الجزئية السابقة</h5>
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
                            <div key={agg.itemName + agg.price} className="flex justify-between text-sm bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-100 dark:border-blue-700 mb-1">
                              <span className="text-blue-800 dark:text-blue-200">{agg.itemName} × {formatDecimal(agg.totalQuantity)}</span>
                              <span className="text-blue-700 dark:text-blue-300 font-medium">{formatCurrency(agg.totalAmount)}</span>
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
                        <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">خيارات الدفع</h5>
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
                                ? 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                          >
                            <div className="text-2xl mb-2">💰</div>
                            <div className="font-medium dark:text-gray-100">دفع الفاتورة بالكامل</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">دفع المبلغ المتبقي بالكامل</div>
                            {selectedBill && hasActiveSession(selectedBill) && (
                              <div className="text-xs text-red-500 dark:text-red-400 mt-1">غير متاح - جلسة نشطة</div>
                            )}
                          </button>

                          {/* زر دفع مشروب معين */}
                          <button
                            onClick={async () => {
                              if (selectedBill) {
                                await handlePartialPayment(selectedBill);
                              }
                            }}
                            className={`p-4 border-2 rounded-lg text-center transition-colors duration-200 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500`}
                          >
                            <div className="text-2xl mb-2">🍹</div>
                            <div className="font-medium dark:text-gray-100">دفع مشروب معين</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">اختيار مشروبات محددة للدفع</div>
                          </button>
                        </div>
                      </div>

                      {/* إدخال الدفع - يظهر فقط إذا تم اختيار دفع الفاتورة بالكامل */}
                      {paymentAmount && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">مبلغ الدفع</label>
                            <input
                              type="text"
                              value={formatCurrency(parseFloat(paymentAmount))}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              disabled
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">المبلغ المتبقي بعد الدفع</label>
                            <input
                              type="text"
                              value={formatCurrency(Math.max(0, (selectedBill?.remaining || 0) - parseFloat(paymentAmount)))}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              disabled
                            />
                          </div>

                          {/* مؤشر حالة الدفع */}
                          <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700">
                            <div className="flex items-center">
                              <span className="text-lg mr-2 text-green-600 dark:text-green-400">✅</span>
                              <div>
                                <p className="font-medium text-green-800 dark:text-green-200">
                                  ستصبح الفاتورة مدفوعة بالكامل!
                                </p>
                                <p className="text-sm text-green-600 dark:text-green-300">
                                  المبلغ المتبقي سيكون صفر
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}


                    </>
                  )}

                  {/* رسالة للفواتير المدفوعة بالكامل */}
                  {selectedBill?.status === 'paid' && (
                    <div className="bg-green-50 dark:bg-green-900 p-6 rounded-lg text-center">
                      <div className="text-6xl mb-4">✅</div>
                      <h5 className="font-medium text-green-900 dark:text-green-100 mb-2">الفاتورة مدفوعة بالكامل!</h5>
                      <p className="text-green-700 dark:text-green-300 mb-4">
                        تم دفع جميع المبالغ المطلوبة لهذه الفاتورة
                      </p>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600 dark:text-gray-300">المبلغ الكلي:</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(selectedBill?.total || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 dark:text-gray-300">المدفوع:</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(selectedBill?.paid || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-600 dark:text-gray-300">المتبقي:</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(selectedBill?.remaining || 0)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* QR Code Section */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">رمز QR للعميل</h4>

                  <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg text-center">
                    {selectedBill?.qrCode ? (
                      <div>
                        <img
                          src={selectedBill.qrCode}
                          alt="QR Code"
                          className="mx-auto mb-4 w-48 h-48 border-4 border-white dark:border-gray-600 shadow-lg"
                        />
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          يمكن للعميل مسح هذا الرمز لمعرفة تفاصيل فاتورته
                        </p>
                        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-4">
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
                        <QrCode className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">سيتم إنشاء رمز QR تلقائياً عند حفظ الفاتورة</p>
                      </div>
                    )}
                  </div>

                  {/* Bill Summary */}
                  <div className="mt-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">ملخص الفاتورة</h5>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr>
                          <td className="py-2 px-3 text-center border border-gray-200 dark:border-gray-600">
                            <div className="text-gray-600 dark:text-gray-300 font-medium mb-1">عدد الطلبات</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatDecimal(selectedBill?.orders?.length || 0)}</div>
                          </td>
                          <td className="py-2 px-3 text-center border border-gray-200 dark:border-gray-600">
                            <div className="text-gray-600 dark:text-gray-300 font-medium mb-1">عدد الجلسات</div>
                            <div className="text-lg font-bold flex items-center justify-center gap-1 text-gray-900 dark:text-gray-100">
                              {formatDecimal(selectedBill?.sessions?.length || 0)}
                              {selectedBill && hasActiveSession(selectedBill) && (
                                <>
                                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                  <span className="text-xs text-red-600 dark:text-red-400 font-bold">نشط</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center border border-gray-200 dark:border-gray-600">
                            <div className="text-gray-600 dark:text-gray-300 font-medium mb-1">تاريخ الإنشاء</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                              {selectedBill?.createdAt ? new Date(selectedBill.createdAt).toLocaleDateString('ar-EG') : '-'}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {selectedBill?.qrCodeUrl && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <h6 className="font-medium text-gray-900 dark:text-gray-100 mb-2">رابط الفاتورة للعميل:</h6>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <input
                            type="text"
                            value={selectedBill.qrCodeUrl}
                            readOnly
                            className="flex-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100"
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

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              {/* زر إلغاء الفاتورة - يظهر فقط إذا لم تكن مدفوعة بالكامل */}
              {selectedBill?.status !== 'paid' && (
                <button
                  onClick={() => setShowCancelConfirmModal(true)}
                  className="px-4 py-2 text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 rounded-lg transition-colors duration-200"
                >
                  إلغاء الفاتورة
                </button>
              )}

              {/* رسالة للفواتير المدفوعة */}
              {selectedBill?.status === 'paid' && (
                <div className="flex items-center text-green-700 dark:text-green-300">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">الفاتورة مدفوعة بالكامل</span>
                </div>
              )}

              <div className="flex space-x-3 space-x-reverse">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
                >
                  إغلاق
                </button>

                {/* زر دفع الفاتورة بالكامل - يظهر فقط إذا لم تكن الفاتورة مدفوعة بالكامل */}
                {selectedBill?.status !== 'paid' && paymentAmount && (
                  <button
                    onClick={handlePaymentSubmit}
                    disabled={selectedBill ? (hasActiveSession(selectedBill) || isProcessingPayment) : false}
                    className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 min-w-[180px] ${
                      selectedBill && (hasActiveSession(selectedBill) || isProcessingPayment)
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-orange-600 hover:bg-orange-700 text-white'
                    }`}
                  >
                    {isProcessingPayment ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        جاري الدفع...
                      </>
                    ) : selectedBill && hasActiveSession(selectedBill) ? (
                      'لا يمكن الدفع - جلسة نشطة'
                    ) : (
                      'دفع الفاتورة بالكامل'
                    )}
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
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">دفع مشروبات محددة - فاتورة #{selectedBill?.billNumber}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">اختر المشروبات المطلوب دفعها من هذه الفاتورة</p>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">اختر المشروبات المطلوب دفعها</h4>

                {(() => {
                  const itemsWithRemaining = aggregateItemsWithPayments(selectedBill?.orders || [], selectedBill?.partialPayments || [])
                    .filter(item => item.remainingQuantity > 0);


                  if (itemsWithRemaining.length === 0) {
                    return (
                      <div className="text-center py-8 bg-green-50 dark:bg-green-900 rounded-lg border border-green-200 dark:border-green-700">
                        <div className="text-4xl mb-4">✅</div>
                        <h5 className="font-medium text-green-900 dark:text-green-100 mb-2">جميع العناصر مدفوعة بالكامل!</h5>
                        <p className="text-green-700 dark:text-green-300">
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
                    <div key={itemKey} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-orange-700 dark:text-orange-400">
                            {item.name}
                          {/* زر - للصنف الرئيسي */}
                          <button
                            type="button"
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-500 text-lg font-bold bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300"
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
                                                      <span className="mx-2 w-6 text-center select-none font-bold text-orange-700 dark:text-orange-400">{formatDecimal(itemQuantities[itemKey] || 0)}</span>
                          {/* زر + للصنف الرئيسي */}
                          <button
                            type="button"
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-500 text-lg font-bold bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300"
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
                            className="ml-2 px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded text-xs"
                            onClick={() => {
                              setItemQuantities({ ...itemQuantities, [itemKey]: item.remainingQuantity });
                              setSelectedItems(prev => ({ ...prev, [itemKey]: item.remainingQuantity > 0 }));
                            }}
                            disabled={(itemQuantities[itemKey] || 0) === item.remainingQuantity}
                          >دفع الكمية بالكامل</button>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(item.price)}</div>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-300">
                        <div>الكمية: <span className="font-bold text-gray-900 dark:text-gray-100">{formatDecimal(item.totalQuantity)}</span></div>
                        <div>المدفوع: <span className="text-green-700 dark:text-green-400 font-bold">{formatDecimal(item.paidQuantity)}</span></div>
                        <div>المتبقي: <span className="text-yellow-700 dark:text-yellow-400 font-bold">{formatDecimal(item.remainingQuantity)}</span></div>
                      </div>
                      {/* اختيار الكمية للدفع */}
                      {/* تم نقل أزرار التحكم بجانب اسم الصنف في الأعلى ولن تتكرر هنا */}
                      {/* عرض الإضافات */}
                      {item.addons && item.addons.length > 0 && (
                        <div className="mt-2 pl-4 border-r-2 border-yellow-200 dark:border-yellow-700">
                            {item.addons
                              .filter(addon => addon.remainingQuantity > 0) // عرض الإضافات التي لها كمية متبقية فقط
                              .map((addon) => {
                            const addonKey = itemKey + '|addon|' + addon.name + '|' + addon.price;
                            const isAddonSelected = selectedItems[addonKey] || false;
                            // إذا كانت الإضافة برسوم ثابتة، لا يوجد إدخال كمية
                            return (
                              <div key={addonKey} className="flex flex-col gap-1 mb-2">
                                <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-300">
                                  <span>↳ إضافة: {addon.name}</span>
                                  <span>({formatCurrency(addon.price)})</span>
                                  <span>الكمية: <b className="text-gray-900 dark:text-gray-100">{formatDecimal(addon.totalQuantity)}</b></span>
                                  <span>المدفوع: <b className="text-green-700 dark:text-green-400">{formatDecimal(addon.paidQuantity)}</b></span>
                                  <span>المتبقي: <b className="text-yellow-700 dark:text-yellow-400">{formatDecimal(addon.remainingQuantity)}</b></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isAddonSelected}
                                    onChange={e => setSelectedItems({ ...selectedItems, [addonKey]: e.target.checked })}
                                    className="rounded border-gray-300 dark:border-gray-600 text-orange-600 dark:text-orange-400 focus:ring-orange-500 dark:focus:ring-orange-400"
                                  />
                                    <div className="flex items-center justify-between gap-2 mt-2">
                                      <div className="font-bold text-yellow-800 dark:text-yellow-300 flex-1 text-right">{addon.name}</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 w-20 text-center">{formatCurrency(addon.price)}</div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-500 text-lg font-bold bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300"
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
                                        <span className="mx-2 w-6 text-center select-none font-bold text-yellow-800 dark:text-yellow-300">{formatDecimal(itemQuantities[addonKey] || 0)}</span>
                                        <button
                                          type="button"
                                          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-500 text-lg font-bold bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300"
                                          onClick={() => {
                                            const newQty = Math.min(addon.remainingQuantity, (itemQuantities[addonKey] || 0) + 1);
                                            setItemQuantities({ ...itemQuantities, [addonKey]: newQty });
                                            setSelectedItems(prev => ({ ...prev, [addonKey]: newQty > 0 }));
                                          }}
                                          disabled={(itemQuantities[addonKey] || 0) >= addon.remainingQuantity}
                                        >+</button>
                                        <button
                                          type="button"
                                          className="ml-2 px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded text-xs"
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
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">طريقة الدفع</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setPartialPaymentMethod('cash')}
                      className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${partialPaymentMethod === 'cash' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900 text-orange-700 dark:text-orange-300' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                    >
                      <div className="text-2xl mb-1">💵</div>
                      <div className="text-sm font-medium">نقداً</div>
                    </button>
                    <button
                      onClick={() => setPartialPaymentMethod('card')}
                      className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${partialPaymentMethod === 'card' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900 text-orange-700 dark:text-orange-300' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                    >
                      <div className="text-2xl mb-1">💳</div>
                      <div className="text-sm font-medium">بطاقة</div>
                    </button>
                    <button
                      onClick={() => setPartialPaymentMethod('transfer')}
                      className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${partialPaymentMethod === 'transfer' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900 text-orange-700 dark:text-orange-300' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
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
                <div className="mb-6 bg-orange-50 dark:bg-orange-900 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
                  <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">ملخص الدفع</h4>
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
                          <div key={index} className="flex flex-col text-sm mb-3 p-2 bg-orange-100 dark:bg-orange-800 rounded border border-orange-200 dark:border-orange-600">
                            <span className="text-orange-800 dark:text-orange-200 font-medium">
                              {item.name}
                              {item.addons && item.addons.length > 0 && (
                                <span className="ml-2 text-xs bg-orange-200 dark:bg-orange-700 text-orange-800 dark:text-orange-200 px-2 py-1 rounded-full">
                                  إضافات
                                </span>
                              )}
                              {' '}× {formatDecimal(quantity)}
                            </span>
                            <span className="font-bold text-orange-900 dark:text-orange-100 mt-1">
                              المجموع: {formatCurrency(item.price * quantity)}
                            </span>
                          </div>
                        );
                      })}
                    <div className="border-t border-orange-200 dark:border-orange-600 pt-2 mt-2">
                      <div className="flex justify-between font-medium text-orange-900 dark:text-orange-100">
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

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <button
                onClick={() => {
                  setShowPartialPaymentModal(false);
                  setSelectedItems({});
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
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
                className={`px-4 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200`}
              >
                {isProcessingPartialPayment ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري الدفع...
                  </>
                ) : (
                  'تأكيد الدفع الجزئي'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Bill Confirmation Modal */}
      <ConfirmModal
        isOpen={showCancelConfirmModal}
        onClose={() => !isCancelingBill && setShowCancelConfirmModal(false)}
        onConfirm={handleCancelBill}
        title="تأكيد إلغاء الفاتورة"
        message={`هل أنت متأكد من إلغاء فاتورة رقم #${selectedBill?.billNumber}؟\n\n⚠️ هذا الإجراء لا يمكن التراجع عنه.`}
        confirmText={isCancelingBill ? 'جاري الإلغاء...' : 'نعم، إلغاء الفاتورة'}
        cancelText="تراجع"
        confirmColor="bg-red-600 hover:bg-red-700"
        loading={isCancelingBill}
      />

      {/* Session End Confirmation Modal */}
      {showSessionEndModal && sessionToEnd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">تأكيد إنهاء الجلسة</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              هل أنت متأكد من إنهاء هذه الجلسة؟ سيتم حساب التكلفة النهائية وإغلاق الجلسة.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  if (!isEndingSession) {
                    setShowSessionEndModal(false);
                    setSessionToEnd(null);
                  }
                }}
                className={`px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200 ${
                  isEndingSession ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isEndingSession}
              >
                إلغاء
              </button>
              <button
                onClick={confirmSessionEnd}
                className={`px-4 py-2 ${
                  isEndingSession
                    ? 'bg-red-700 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                } text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 min-w-[120px]`}
                disabled={isEndingSession}
              >
                {isEndingSession ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري إنهاء الجلسة...
                  </>
                ) : (
                  'تأكيد الإنهاء'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
