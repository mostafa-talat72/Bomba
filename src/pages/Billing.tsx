import { useEffect, useState, useMemo, memo } from 'react';
import { Receipt, QrCode, Printer, DollarSign, CreditCard, Calendar, User, CheckCircle, Table as TableIcon, Search, X, Eye, Gamepad2, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, Bill, Order, OrderItem, Session } from '../services/api';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';
import ConfirmModal from '../components/ConfirmModal';
import { printBill } from '../utils/printBill';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { aggregateItemsWithPayments } from '../utils/billAggregation';

// Type for interval
type Interval = ReturnType<typeof setInterval>;

interface Table {
  _id: string;
  id: string;
  number: number;
  section?: any;
  isActive: boolean;
}

// Memoized Bill Item Component for PlayStation devices
const PlaystationBillItem = memo(({ 
  bill, 
  onPaymentClick, 
  getStatusColor, 
  getStatusText, 
  formatCurrency 
}: { 
  bill: Bill; 
  onPaymentClick: (bill: Bill) => void;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  formatCurrency: (amount: number) => string;
}) => (
  <div
    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
    onClick={() => onPaymentClick(bill)}
  >
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-gray-900 dark:text-gray-100">
          #{bill.billNumber || bill.id || bill._id}
        </span>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(bill.status)}`}>
          {getStatusText(bill.status)}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        {bill.table?.number ? (
          <span className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
            🪑 طاولة: {bill.table.number}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex items-center text-gray-500 dark:text-gray-400">
              ⚠️ غير مرتبطة بطاولة
            </span>
            {bill.customerName && (
              <span className="flex items-center text-purple-600 dark:text-purple-400 font-medium">
                👤 {bill.customerName}
              </span>
            )}
          </div>
        )}
        <span>{formatCurrency(bill.total || 0)}</span>
      </div>
    </div>
    <div className="text-left">
      <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
        {formatCurrency(bill.remaining || 0)}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">متبقي</div>
    </div>
  </div>
));

// Memoized Bill Item Component for unlinked bills
const UnlinkedBillItem = memo(({ 
  bill, 
  onPaymentClick, 
  getStatusColor, 
  getStatusText, 
  formatCurrency 
}: { 
  bill: Bill; 
  onPaymentClick: (bill: Bill) => void;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  formatCurrency: (amount: number) => string;
}) => (
  <div
    className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors cursor-pointer border border-purple-200 dark:border-purple-700"
    onClick={() => onPaymentClick(bill)}
  >
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-gray-900 dark:text-gray-100">
          #{bill.billNumber || bill.id || bill._id}
        </span>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(bill.status)}`}>
          {getStatusText(bill.status)}
        </span>
        {bill.billType && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            {bill.billType === 'playstation' ? '🎮 بلايستيشن' : bill.billType === 'computer' ? '💻 كمبيوتر' : '☕ كافيه'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        {bill.customerName && (
          <span className="flex items-center text-purple-600 dark:text-purple-400 font-medium">
            👤 {bill.customerName}
          </span>
        )}
        <span>الإجمالي: {formatCurrency(bill.total || 0)}</span>
        <span>المدفوع: {formatCurrency(bill.paid || 0)}</span>
      </div>
    </div>
    <div className="text-left">
      <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
        {formatCurrency(bill.remaining || 0)}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">متبقي</div>
    </div>
  </div>
));

// Memoized Bill Item Component for table bills modal
const TableBillItem = memo(({ 
  bill, 
  onPaymentClick, 
  onViewClick,
  onEditClick,
  getStatusColor, 
  getStatusText, 
  formatCurrency 
}: { 
  bill: Bill; 
  onPaymentClick: (bill: Bill) => void;
  onViewClick: (bill: Bill) => void;
  onEditClick: (bill: Bill) => void;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  formatCurrency: (amount: number) => string;
}) => (
  <div
    className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4 hover:shadow-md transition-shadow cursor-pointer"
    onClick={() => onPaymentClick(bill)}
  >
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            #{bill.billNumber || bill.id || bill._id}
          </span>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(bill.status)}`}>
            {getStatusText(bill.status)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span className="flex items-center">
            <Calendar className="h-4 w-4 ml-1" />
            {bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('ar-EG') : '-'}
          </span>
          {bill.customerName && (
            <span className="flex items-center">
              <User className="h-4 w-4 ml-1" />
              {bill.customerName}
            </span>
          )}
        </div>
      </div>
      <div className="text-left ml-4">
        <div className="text-lg font-bold text-orange-600 dark:text-orange-400 mb-1">
          {formatCurrency(bill.total || 0)}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          مدفوع: <span className="text-green-600 dark:text-green-400">{formatCurrency(bill.paid || 0)}</span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          متبقي: <span className={`font-semibold ${(bill.remaining || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {formatCurrency(bill.remaining || 0)}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 ml-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewClick(bill);
          }}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
          title="فتح الفاتورة في نافذة جديدة"
        >
          <Eye className="h-4 w-4" />
          عرض
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditClick(bill);
          }}
          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors"
        >
          تعديل
        </button>
      </div>
    </div>
  </div>
));

const Billing = () => {
  const { bills, fetchBills, cancelBill, addPartialPayment, showNotification, user, tables, fetchTables, fetchTableSections, tableSections, getTableStatus } = useApp();

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
  const [customerNameForEndSession, setCustomerNameForEndSession] = useState('');
  const [showChangeTableModal, setShowChangeTableModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState<string | null>(null);
  const [isChangingTable, setIsChangingTable] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: boolean }>({});
  const [itemQuantities, setItemQuantities] = useState<{ [key: string]: number }>({});
  const [partialPaymentMethod, setPartialPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [statusFilter, setStatusFilter] = useState('all'); // الافتراضي: جميع الفواتير
  const [playstationStatusFilter, setPlaystationStatusFilter] = useState('unpaid'); // الافتراضي: غير مدفوع
  // تم إزالة فلترة التاريخ - عرض جميع الفواتير بدون قيود تاريخية
  const [dateFilter, setDateFilter] = useState<string>('');
  const minDate = '';
  const maxDate = '';
  const [paymentReference, setPaymentReference] = useState('');
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [isCancelingBill, setIsCancelingBill] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isProcessingPartialPayment, setIsProcessingPartialPayment] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableBillsMap, setTableBillsMap] = useState<Record<number, { hasUnpaid: boolean; bills: Bill[] }>>({});
  const [showTableBillsModal, setShowTableBillsModal] = useState(false);
  const [tableBillsFilter, setTableBillsFilter] = useState('unpaid'); // الافتراضي: غير مدفوع
  const [searchQuery, setSearchQuery] = useState('');
  const [billTypeFilter, setBillTypeFilter] = useState<'all' | 'cafe' | 'playstation' | 'computer'>('all');
  const [playstationSearchQuery, setPlaystationSearchQuery] = useState('');
  const [isPlaystationSectionCollapsed, setIsPlaystationSectionCollapsed] = useState(false);
  const [collapsedDevices, setCollapsedDevices] = useState<Set<string>>(new Set());
  const [showSessionPaymentModal, setShowSessionPaymentModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionPaymentAmount, setSessionPaymentAmount] = useState('');
  const [sessionPaymentMethod, setSessionPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [isProcessingSessionPayment, setIsProcessingSessionPayment] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // تحميل البيانات الأولية
    fetchBills();
    fetchTables();
    fetchTableSections();

    // إعداد التحديث التلقائي كل 5 ثوانٍ
    const intervalId = setInterval(() => {
      fetchBills();
    }, 5000); // 5000 مللي ثانية = 5 ثوانٍ

    // تنظيف المؤقت عند إلغاء تحميل المكون
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Socket.IO listeners for real-time bill updates
  useEffect(() => {
    // Initialize Socket.IO connection
    // Remove /api suffix from VITE_API_URL for Socket.IO connection
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socketUrl = apiUrl.replace(/\/api\/?$/, '');
    
    const socket: Socket = io(socketUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      autoConnect: true,
      forceNew: false,
    });

    // Connection event handlers
    socket.on('connect', () => {
      console.log('Billing: Socket.IO connected');
    });

    socket.on('disconnect', () => {
      console.log('Billing: Socket.IO disconnected');
    });

    socket.on('reconnect', () => {
      console.log('Billing: Socket.IO reconnected');
      // Refresh bills data on reconnection
      fetchBills();
      fetchTables();
    });

    socket.on('connect_error', (error) => {
      console.error('Billing: Socket.IO connection error:', error);
    });

    socket.on('error', (error) => {
      console.error('Billing: Socket.IO error:', error);
    });

    // Listen for bill-update event
    socket.on('bill-update', (data: any) => {
      console.log('Billing: Received bill-update event', data);
      
      if (data.type === 'created' || data.type === 'updated' || data.type === 'deleted') {
        // Refresh bills list when bill is created, updated, or deleted
        fetchBills();
        fetchTables();
      }
    });

    // Listen for payment-received event
    socket.on('payment-received', (data: any) => {
      
      // Refresh bills list and tables when payment is received
      fetchBills();
      fetchTables();
      
      // If the updated bill is currently selected, refresh it
      if (selectedBill && data.bill && (data.bill._id === selectedBill._id || data.bill.id === selectedBill.id)) {
        setSelectedBill(data.bill);
      }
    });

    // Listen for order-update event (affects bills)
    socket.on('order-update', (data: any) => {
      
      if (data.type === 'created' || data.type === 'updated' || data.type === 'deleted') {
        // Refresh bills when orders change
        fetchBills();
      }
    });

    // Listen for table-status-update event
    socket.on('table-status-update', (data: { tableId: string; status: string }) => {
      
      // Refresh tables to update status
      fetchTables();
    });

    // Cleanup on unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect');
      socket.off('connect_error');
      socket.off('error');
      socket.off('bill-update');
      socket.off('payment-received');
      socket.off('order-update');
      socket.off('table-status-update');
      socket.disconnect();
    };
  }, [selectedBill]);

  // تحديث map للطاولات والفواتير
  useEffect(() => {
    if (tables.length > 0) {
      const map: Record<number, { hasUnpaid: boolean; bills: Bill[] }> = {};
      
      tables.forEach((table: Table) => {
        const tableIdStr = (table._id || table.id).toString();
        const tableBills = bills.filter((bill: Bill) => {
          if (!bill.table) return false;
          const billTableId = (bill.table._id || bill.table.id || bill.table).toString();
          return billTableId === tableIdStr;
        });
        const hasUnpaid = tableBills.some((bill: Bill) => 
          bill.status === 'draft' || bill.status === 'partial' || bill.status === 'overdue'
        );
        
        map[table.number] = {
          hasUnpaid,
          bills: tableBills
        };
      });
      
      setTableBillsMap(map);
    }
  }, [bills, tables]);

  // مراقبة تغييرات bills وتحديث selectedBill تلقائياً
  useEffect(() => {
    // Don't update selectedBill from bills array if payment modal is open
    // because bills array doesn't include qrCode field
    if (selectedBill && bills.length > 0 && !showPaymentModal) {
      const updatedBill = bills.find((bill: Bill) =>
        bill.id === selectedBill.id || bill._id === selectedBill._id
      );
      if (updatedBill && JSON.stringify(updatedBill) !== JSON.stringify(selectedBill)) {
        setSelectedBill(updatedBill);
      }
    }
  }, [bills, selectedBill, showPaymentModal]);

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
    // إعادة جلب الفاتورة للتأكد من وجود QR code
    try {
      const updatedBillResult = await api.getBill(bill.id || bill._id);
      if (updatedBillResult && updatedBillResult.data) {
        setSelectedBill(updatedBillResult.data);
        setOriginalAmount(updatedBillResult.data.remaining?.toString() || '0');
        setPaymentAmount(updatedBillResult.data.remaining?.toString() || '0');
      } else {
        setSelectedBill(bill);
        setOriginalAmount(bill.remaining?.toString() || '0');
        setPaymentAmount(bill.remaining?.toString() || '0');
      }
    } catch (error) {
      setSelectedBill(bill);
      setOriginalAmount(bill.remaining?.toString() || '0');
      setPaymentAmount(bill.remaining?.toString() || '0');
    }
    
    setDiscountPercentage('');
    setShowPaymentModal(true);

    // لا حاجة لتحديث حالة الفاتورة هنا - سيتم تحديثها بعد الدفع
  };

  const handlePaymentSubmit = async () => {
    if (!selectedBill) return;

    // التحقق من وجود جلسات نشطة
    if (selectedBill && hasActiveSession(selectedBill)) {
      showNotification('لا يمكن الدفع - هذه الفاتورة تحتوي على جلسة نشطة. يرجى إنهاء الجلسة أولاً.');
      return;
    }

    // Validate discount percentage if provided
    if (discountPercentage && (isNaN(parseFloat(discountPercentage)) || parseFloat(discountPercentage) < 0 || parseFloat(discountPercentage) > 100)) {
      showNotification('يجب أن تكون نسبة الخصم بين 0 و 100', 'error');
      return;
    }

    try {
      setIsProcessingPayment(true);
      
      // Calculate the new paid amount (previous paid + current payment)
      const newPaidAmount = (selectedBill.paid || 0) + parseFloat(paymentAmount);
      const billTotal = selectedBill.total || 0;
      
      // Calculate remaining amount
      const newRemaining = Math.max(0, billTotal - newPaidAmount);
      
      // Determine the new status based on the payment
      let newStatus = selectedBill.status || 'draft';
      if (newPaidAmount >= billTotal) {
        newStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newStatus = 'partial';
      }
      
      const paymentData: any = {
        paid: newPaidAmount,
        remaining: newRemaining,
        status: newStatus,
        paymentAmount: parseFloat(paymentAmount),
        method: paymentMethod,
        reference: paymentReference,
        // Include the total to ensure backend calculates correctly
        total: billTotal
      };

      // Add discount percentage if provided
      if (discountPercentage) {
        paymentData.discountPercentage = parseFloat(discountPercentage);
        // Calculate the discount amount for display
        const discountAmount = (selectedBill.subtotal || 0) * (parseFloat(discountPercentage) / 100);
        paymentData.discount = discountAmount;
      }

      const result = await api.updatePayment(selectedBill.id || selectedBill._id, paymentData);

      if (result && result.data) {
        // إعادة جلب الفاتورة للحصول على QR code المحدث
        const updatedBillResult = await api.getBill(selectedBill.id || selectedBill._id);
        if (updatedBillResult && updatedBillResult.data) {
          setSelectedBill(updatedBillResult.data);
        } else {
          setSelectedBill(result.data);
        }
        
        setShowPaymentModal(false);
        setPaymentAmount('');
        setPaymentMethod('cash');
        setPaymentReference('');

        // تحديث حالة الفاتورة بناءً على الأصناف والجلسات
        await updateBillStatus(selectedBill.id || selectedBill._id);

        // إعادة تحميل البيانات (Tables و Bills معاً)
        await Promise.all([
          fetchTables(),
          fetchBills()
        ]);

        showNotification('تم تسجيل الدفع بنجاح!');
      }
    } catch (error) {
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

  // عرض جميع الفواتير بدون فلترة بالتاريخ
  let availableBills = bills;

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
    
    // إعادة تعيين العناصر المحددة
    setSelectedItems({});
    setItemQuantities({});
  };

  // دالة لتحديث حالة الفاتورة بناءً على الأصناف والجلسات
  const updateBillStatus = async (billId: string) => {
    try {
      // الحصول على عناصر الفاتورة
      const aggItems = aggregateItemsWithPayments(
        selectedBill?.orders || [], 
        selectedBill?.itemPayments || [],
        selectedBill?.status,
        selectedBill?.paid,
        selectedBill?.total
      );

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
        
        // إذا أصبحت الفاتورة مدفوعة بالكامل، تحديث حالة الطاولة
        if (newStatus === 'paid') {
          await fetchTables();
          await fetchBills();
        }
      }
      
      return newStatus;
    } catch (error) {
      showNotification('فشل في تحديث حالة الفاتورة');
      return null;
    }
  };

  const handlePartialPaymentSubmit = async () => {
    if (!selectedBill) return;

    // استخدم نفس منطق المفاتيح كما في aggregateItemsWithPayments
    const aggItems = aggregateItemsWithPayments(
      selectedBill?.orders || [], 
      selectedBill?.itemPayments || [],
      selectedBill?.status,
      selectedBill?.paid,
      selectedBill?.total
    );
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
      
      // تحويل itemsToPay إلى الصيغة المطلوبة للـ API
      // نحتاج إلى إيجاد itemId من bill.itemPayments بناءً على itemName و price
      // ملاحظة: itemPayments لا يحتوي على addons، لذا نبحث فقط بناءً على name و price
      const itemsToPayForAPI: Array<{ itemId: string; quantity: number }> = [];
      
      // نجمع الكميات للعناصر المتشابهة (نفس الاسم والسعر)
      const quantityMap = new Map<string, number>();
      itemsToPay.forEach(item => {
        const key = `${item.itemName}|${item.price}`;
        const currentQty = quantityMap.get(key) || 0;
        quantityMap.set(key, currentQty + item.quantity);
      });

      // الآن نبحث عن itemPayments المطابقة ونوزع الكميات
      quantityMap.forEach((totalQuantity, key) => {
        const [itemName, priceStr] = key.split('|');
        const price = parseFloat(priceStr);
        
        // البحث عن جميع itemPayments المطابقة
        const matchingPayments = selectedBill?.itemPayments?.filter(ip => {
          const nameMatch = ip.itemName.trim() === itemName.trim();
          const priceMatch = ip.pricePerUnit === price;
          const remainingQty = (ip.quantity || 0) - (ip.paidQuantity || 0);
          return nameMatch && priceMatch && remainingQty > 0;
        }) || [];

        if (matchingPayments.length === 0) {
          console.error('لم يتم العثور على itemPayment مطابق للعنصر:', { itemName, price });
          return;
        }

        // توزيع الكمية على itemPayments المتاحة
        let remainingToPay = totalQuantity;
        matchingPayments.forEach(payment => {
          if (remainingToPay <= 0) return;
          
          const availableQty = (payment.quantity || 0) - (payment.paidQuantity || 0);
          const qtyToPay = Math.min(remainingToPay, availableQty);
          
          if (qtyToPay > 0) {
            itemsToPayForAPI.push({
              itemId: payment._id || payment.itemId,
              quantity: qtyToPay
            });
            remainingToPay -= qtyToPay;
          }
        });

        if (remainingToPay > 0) {
          console.warn(`لم يتم دفع ${remainingToPay} من ${itemName} - الكمية المتبقية غير كافية`);
        }
      });

      if (itemsToPayForAPI.length === 0) {
        showNotification('لم يتم العثور على عناصر صالحة للدفع', 'error');
        return;
      }
      const response = await api.payForItems(selectedBill.id || selectedBill._id, {
        items: itemsToPayForAPI,
        paymentMethod: partialPaymentMethod
      });

      if (response.success && response.data) {
        // response.data يحتوي على { bill, paidItems, totalPaid, ... }
        const updatedBill = (response.data as any).bill || response.data;
        
        // إعادة تحميل قائمة الفواتير أولاً
        await fetchBills();

        // إعادة تحميل الفاتورة من الـ API للحصول على أحدث البيانات
        const refreshedBillResponse = await api.getBill(selectedBill.id || selectedBill._id);
        if (refreshedBillResponse.success && refreshedBillResponse.data) {
          setSelectedBill(refreshedBillResponse.data);
        } else {
          // إذا فشل التحديث، استخدم البيانات من الاستجابة
          setSelectedBill(updatedBill);
        }

        // إعادة تعيين العناصر المحددة
        setSelectedItems({});
        setItemQuantities({});

        // إذا كانت الفاتورة أصبحت مدفوعة بالكامل، تحديث حالة الطاولة
        if (updatedBill.status === 'paid') {
          await fetchTables();
          // إغلاق النافذة إذا تم دفع كل شيء
          setShowPartialPaymentModal(false);
        }

        // إظهار رسالة نجاح
        showNotification('تم تسجيل الدفع الجزئي بنجاح!', 'success');
      } else {
        showNotification('فشل في تسجيل الدفع الجزئي', 'error');
      }
    } catch (error) {
      console.error('Error in partial payment:', error);
      showNotification('فشل في تسجيل الدفع الجزئي', 'error');
    } finally {
      setIsProcessingPartialPayment(false);
    }
  };

  // دالة الدفع الجزئي للجلسة
  const handlePaySessionPartial = async () => {
    if (!selectedBill || !selectedSession) return;

    const amount = parseFloat(sessionPaymentAmount);
    
    if (isNaN(amount) || amount <= 0) {
      showNotification('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    // التحقق من أن المبلغ لا يتجاوز المبلغ المتبقي للجلسة
    const sessionRemaining = selectedSession.finalCost - (selectedSession.totalCost || 0);
    if (amount > sessionRemaining) {
      showNotification(`المبلغ المدخل (${formatCurrency(amount)}) أكبر من المبلغ المتبقي (${formatCurrency(sessionRemaining)})`, 'error');
      return;
    }

    try {
      setIsProcessingSessionPayment(true);
      
      const result = await api.paySessionPartial(selectedBill.id || selectedBill._id, {
        sessionId: selectedSession._id || selectedSession.id,
        amount: amount,
        paymentMethod: sessionPaymentMethod
      });

      if (result.success && result.data) {
        // تحديث بيانات الفاتورة المحلية
        setSelectedBill(result.data);

        // إعادة تعيين الحقول
        setSessionPaymentAmount('');
        setSelectedSession(null);
        setShowSessionPaymentModal(false);

        // تحديث حالة الفاتورة بناءً على الأصناف والجلسات
        await updateBillStatus(selectedBill.id || selectedBill._id);

        // إعادة تحميل البيانات
        await Promise.all([
          fetchTables(),
          fetchBills()
        ]);

        // إظهار رسالة نجاح
        showNotification('تم تسجيل الدفع الجزئي للجلسة بنجاح!', 'success');
      } else {
        showNotification(result.message || 'فشل في تسجيل الدفع الجزئي للجلسة', 'error');
      }
    } catch (error) {
      showNotification('فشل في تسجيل الدفع الجزئي للجلسة', 'error');
    } finally {
      setIsProcessingSessionPayment(false);
    }
  };

  // دالة تغيير الطاولة
  const handleChangeTable = async () => {
    if (!selectedBill || newTableNumber === null) return;
    
    setIsChangingTable(true);
    
    try {
      // Find table to get its number for notification
      const targetTable = tables.find((t: any) => t._id === newTableNumber);
      
      const result = await api.updateBill(selectedBill.id || selectedBill._id, {
        table: newTableNumber
      });
      
      if (result && result.success) {
        showNotification(`✅ تم نقل الفاتورة إلى الطاولة ${targetTable?.number || newTableNumber} بنجاح`, 'success');
        
        // تحديث البيانات
        await Promise.all([fetchBills(), fetchTables()]);
        
        // إغلاق النافذة
        setShowChangeTableModal(false);
        setNewTableNumber(null);
      } else {
        showNotification('❌ فشل في تغيير الطاولة', 'error');
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || 'حدث خطأ غير متوقع';
      showNotification(`❌ خطأ في تغيير الطاولة: ${errorMsg}`, 'error');
    } finally {
      setIsChangingTable(false);
    }
  };

  // دالة إنهاء الجلسة
  const handleEndSession = async (sessionId: string) => {
    // Find the session from selected bill
    let session = null;
    if (selectedBill && selectedBill.sessions) {
      session = selectedBill.sessions.find((s: any) => (s.id || s._id) === sessionId);
    }
    
    if (session) {
      const isLinkedToTable = !!(selectedBill?.table);
      
      // If not linked to table, require customer name
      if (!isLinkedToTable) {
        setCustomerNameForEndSession((session as any).customerName || '');
      } else {
        setCustomerNameForEndSession('');
      }
    }
    
    setSessionToEnd(sessionId);
    setShowSessionEndModal(true);
  };

  const confirmSessionEnd = async () => {
    if (!sessionToEnd) return;
    
    // Check if customer name is required
    const isLinkedToTable = !!(selectedBill?.table);
    
    // If not linked to table and no customer name, show error
    if (!isLinkedToTable && !customerNameForEndSession.trim()) {
      showNotification('يرجى إدخال اسم العميل', 'error');
      return;
    }
    
    setIsEndingSession(true);

    try {
      const result = await api.endSession(sessionToEnd, customerNameForEndSession.trim() || undefined);
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
          const updatedStatus = await updateBillStatus(selectedBill.id || selectedBill._id);
          
          // إذا أصبحت الفاتورة مدفوعة بالكامل بعد إنهاء الجلسة، تحديث حالة الطاولة
          if (updatedStatus === 'paid') {
            await fetchTables();
            await fetchBills();
          }
        }

      } else {
        showNotification('فشل في إنهاء الجلسة');
      }
    } catch (error) {
      showNotification('حدث خطأ في إنهاء الجلسة');
    } finally {
      setIsEndingSession(false);
      setSessionToEnd(null);
      setShowSessionEndModal(false);
      setCustomerNameForEndSession('');
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
      const result = await api.deleteBill(selectedBill.id || selectedBill._id);
      if (result && result.success) {
        showNotification('تم حذف الفاتورة بنجاح', 'success');
        setShowCancelConfirmModal(false);
        setShowPaymentModal(false);
        await fetchBills();
        setSelectedBill(null);
      } else {
        showNotification('فشل في حذف الفاتورة', 'error');
      }
    } catch (error) {
      showNotification('حدث خطأ أثناء حذف الفاتورة', 'error');
    } finally {
      setIsCancelingBill(false);
    }
  };

  // Memoized filtered bills - optimized with useMemo
  const filteredBills = useMemo(() => {
    // عرض جميع الفواتير بدون فلترة بالتاريخ
    let availableBills = bills;

    return availableBills.filter(bill => {
      // استبعاد الفواتير الملغاة والمحذوفة من الإحصائيات
      if (bill.status === 'cancelled') {
        return false;
      }

      // فلترة حسب الطاولة المختارة
      if (selectedTable && bill.table?._id !== selectedTable._id) {
        return false;
      }

      // فلترة حسب نوع الفاتورة
      if (billTypeFilter !== 'all') {
        // تحديد نوع الفاتورة بناءً على billType أو الجلسات
        let actualBillType = bill.billType;
        
        // إذا لم يكن هناك billType، حدده بناءً على الجلسات
        if (!actualBillType && bill.sessions && bill.sessions.length > 0) {
          const hasPlaystation = bill.sessions.some((s: any) => s.deviceType === 'playstation');
          const hasComputer = bill.sessions.some((s: any) => s.deviceType === 'computer');
          
          if (hasPlaystation) actualBillType = 'playstation';
          else if (hasComputer) actualBillType = 'computer';
        }
        
        // إذا لم يكن هناك نوع محدد وهناك طلبات، اعتبرها كافيه
        if (!actualBillType && bill.orders && bill.orders.length > 0) {
          actualBillType = 'cafe';
        }
        
        if (actualBillType !== billTypeFilter) {
          return false;
        }
      }

      // إذا كان الفلتر "غير مدفوع"، نضمّن الحالات التالية:
      if (statusFilter === 'unpaid') {
        if (!['draft', 'partial', 'overdue'].includes(bill.status)) return false;
      }
      // التصفية العادية للحالات الأخرى
      else if (statusFilter !== 'all' && bill.status !== statusFilter) {
        return false;
      }

      // تم إزالة فلترة التاريخ - عرض جميع الفواتير بدون قيود تاريخية

      return true;
    });
  }, [bills, isManagerOrOwner, selectedTable, billTypeFilter, statusFilter]);

  // Memoized bill statistics - optimized with useMemo
  const billStats = useMemo(() => {
    return filteredBills.reduce((acc, bill) => {
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
  }, [filteredBills]);

  // Note: aggregateItemsWithPayments is now imported from utils/billAggregation.ts

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
          {/* Bill Type Filter */}
          <select
            value={billTypeFilter}
            onChange={(e) => setBillTypeFilter(e.target.value as 'all' | 'cafe' | 'playstation' | 'computer')}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="all">جميع الفواتير</option>
            <option value="cafe">فواتير الكافيه</option>
            <option value="playstation">فواتير البلايستيشن</option>
            <option value="computer">فواتير الكمبيوتر</option>
          </select>
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
                {formatDecimal(billStats.totalBills)}
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
                {formatCurrency(billStats.totalPaid)}
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
                {formatCurrency(billStats.totalRemaining)}
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
                {formatDecimal(billStats.partialBills)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PlayStation Devices Section */}
      {(billTypeFilter === 'all' || billTypeFilter === 'playstation') && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => setIsPlaystationSectionCollapsed(!isPlaystationSectionCollapsed)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {isPlaystationSectionCollapsed ? (
                  <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                <Gamepad2 className="h-5 w-5 ml-2 text-blue-600 dark:text-blue-400" />
                أجهزة البلايستيشن
              </h2>
            </div>
            {!isPlaystationSectionCollapsed && (
              <div className="flex items-center gap-3">
                {/* Filter buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setPlaystationStatusFilter('unpaid')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      playstationStatusFilter === 'unpaid'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    غير مدفوع
                  </button>
                  <button
                    onClick={() => setPlaystationStatusFilter('paid')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      playstationStatusFilter === 'paid'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    مدفوع
                  </button>
                  <button
                    onClick={() => setPlaystationStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      playstationStatusFilter === 'all'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    الكل
                  </button>
                </div>
                
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="بحث عن جهاز..."
                    value={playstationSearchQuery}
                    onChange={(e) => setPlaystationSearchQuery(e.target.value)}
                    className="pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 text-sm"
                  />
                  {playstationSearchQuery && (
                    <button
                      onClick={() => setPlaystationSearchQuery('')}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {!isPlaystationSectionCollapsed && (
            <div className="space-y-4">
              {(() => {
                // تجميع جميع الفواتير التي تحتوي على جلسات بلايستيشن
                const allPlaystationBills = bills.filter((bill: Bill) => 
                  bill.billType === 'playstation' || 
                  (bill.sessions && bill.sessions.some((s: any) => s.deviceType === 'playstation'))
                );

                console.log('🎮 إجمالي فواتير البلايستيشن:', allPlaystationBills.length);
                console.log('🎮 فواتير بلايستيشن غير مرتبطة بطاولة:', 
                  allPlaystationBills.filter(b => !b.table).length
                );

                // تجميع الأجهزة حسب الاسم
                const deviceMap = new Map<string, { 
                  deviceName: string; 
                  hasActiveSession: boolean;
                  linkedToTable: boolean;
                  tableNumber?: string | number;
                  bills: Bill[]; // فقط الفواتير غير المرتبطة بطاولة
                  allBills: Bill[]; // جميع الفواتير (للتحقق من الربط بالطاولة)
                }>();
              
                allPlaystationBills.forEach((bill: Bill) => {
                  const playstationSessions = bill.sessions?.filter((s: any) => 
                    s.deviceType === 'playstation'
                  ) || [];
                  
                  // إذا كانت الفاتورة تحتوي على جلسات بلايستيشن
                  if (playstationSessions.length > 0) {
                    playstationSessions.forEach((session: any) => {
                      const deviceKey = session.deviceName || `جهاز ${session.deviceNumber}` || 'غير معروف';
                      const isLinkedToTable = !!bill.table;
                      const hasActiveSession = session.status === 'active';
                      
                      if (!deviceMap.has(deviceKey)) {
                        deviceMap.set(deviceKey, {
                          deviceName: deviceKey,
                          hasActiveSession: false,
                          linkedToTable: false,
                          bills: [],
                          allBills: []
                        });
                      }
                      
                      const deviceData = deviceMap.get(deviceKey)!;
                      
                      // تحديث حالة الجهاز
                      if (hasActiveSession) {
                        deviceData.hasActiveSession = true;
                      }
                      
                      // إضافة الفاتورة إلى قائمة جميع الفواتير
                      if (!deviceData.allBills.find(b => (b.id || b._id) === (bill.id || bill._id))) {
                        deviceData.allBills.push(bill);
                      }
                      
                      // إضافة الفاتورة إلى قائمة bills إذا لم تكن مرتبطة بطاولة
                      // هذا يضمن ظهور فواتير الجلسات غير المرتبطة بطاولة في قسم أجهزة البلايستيشن
                      if (!isLinkedToTable) {
                        if (!deviceData.bills.find(b => (b.id || b._id) === (bill.id || bill._id))) {
                          console.log(`✅ إضافة فاتورة غير مرتبطة بطاولة للجهاز ${deviceKey}:`, {
                            billId: bill.id || bill._id,
                            billNumber: bill.billNumber,
                            customerName: bill.customerName,
                            status: bill.status
                          });
                          deviceData.bills.push(bill);
                        }
                      }
                    });
                  }
                });
                
                // تحديد ما إذا كان الجهاز مرتبط بطاولة (جميع فواتيره مرتبطة بنفس الطاولة)
                deviceMap.forEach((deviceData) => {
                  if (deviceData.allBills.length > 0) {
                    const firstTable = deviceData.allBills[0].table;
                    const allLinkedToSameTable = firstTable && 
                      deviceData.allBills.every(b => b.table?._id === firstTable._id);
                    
                    if (allLinkedToSameTable) {
                      deviceData.linkedToTable = true;
                      deviceData.tableNumber = firstTable.number;
                    }
                  }
                });

                // إضافة فواتير بلايستيشن بدون جلسات (غير مرتبطة بطاولة)
                const billsWithoutSessions = allPlaystationBills.filter((bill: Bill) => 
                  !bill.table && 
                  (!bill.sessions || bill.sessions.length === 0 || 
                   !bill.sessions.some((s: any) => s.deviceType === 'playstation'))
                );

                if (billsWithoutSessions.length > 0) {
                  const deviceKey = 'فواتير بلايستيشن بدون جلسات';
                  if (!deviceMap.has(deviceKey)) {
                    deviceMap.set(deviceKey, {
                      deviceName: deviceKey,
                      hasActiveSession: false,
                      linkedToTable: false,
                      bills: [],
                      allBills: []
                    });
                  }
                  const deviceData = deviceMap.get(deviceKey)!;
                  billsWithoutSessions.forEach(bill => {
                    if (!deviceData.bills.find(b => (b.id || b._id) === (bill.id || bill._id))) {
                      deviceData.bills.push(bill);
                      deviceData.allBills.push(bill);
                    }
                  });
                }

                // فلترة الأجهزة والفواتير حسب الحالة
                const visibleDevices = Array.from(deviceMap.values())
                  .map(deviceData => {
                    // فلترة الفواتير حسب الحالة المختارة
                    let filteredBills = deviceData.bills;
                    
                    console.log(`📊 الجهاز ${deviceData.deviceName}:`, {
                      totalBills: deviceData.bills.length,
                      unlinkedBills: deviceData.bills.filter(b => !b.table).length,
                      hasActiveSession: deviceData.hasActiveSession
                    });
                    
                    if (playstationStatusFilter === 'unpaid') {
                      // إظهار الفواتير غير المدفوعة فقط
                      filteredBills = deviceData.bills.filter(bill => 
                        ['draft', 'partial', 'overdue'].includes(bill.status)
                      );
                    } else if (playstationStatusFilter === 'paid') {
                      // إظهار الفواتير المدفوعة فقط
                      filteredBills = deviceData.bills.filter(bill => 
                        bill.status === 'paid'
                      );
                    }
                    
                    // إرجاع نسخة من deviceData مع الفواتير المفلترة
                    return {
                      ...deviceData,
                      bills: filteredBills
                    };
                  })
                  .filter(deviceData => {
                    // إظهار الجهاز فقط إذا كان لديه فواتير بعد الفلترة
                    // أو إذا كان لديه جلسة نشطة (في حالة فلتر "الكل")
                    if (playstationStatusFilter === 'all') {
                      return deviceData.hasActiveSession || deviceData.bills.length > 0;
                    }
                    return deviceData.bills.length > 0;
                  });

                // تطبيق البحث
                const filteredDevices = visibleDevices.filter(deviceData => 
                  deviceData.deviceName.toLowerCase().includes(playstationSearchQuery.toLowerCase())
                );

                if (filteredDevices.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      {playstationSearchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد أجهزة بلايستيشن نشطة'}
                    </div>
                  );
                }

                const toggleDeviceCollapse = (deviceName: string) => {
                  setCollapsedDevices(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(deviceName)) {
                      newSet.delete(deviceName);
                    } else {
                      newSet.add(deviceName);
                    }
                    return newSet;
                  });
                };

                return filteredDevices.map((deviceData, index) => {
                  const isDeviceCollapsed = collapsedDevices.has(deviceData.deviceName);
                  
                  return (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 flex-1">
                          <button
                            onClick={() => toggleDeviceCollapse(deviceData.deviceName)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            {isDeviceCollapsed ? (
                              <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                            )}
                          </button>
                          <Gamepad2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{deviceData.deviceName}</h3>
                          {deviceData.hasActiveSession && (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium rounded-full">
                              جلسة نشطة
                            </span>
                          )}
                          {deviceData.linkedToTable && deviceData.hasActiveSession && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full">
                              🪑 طاولة {deviceData.tableNumber}
                            </span>
                          )}
                        </div>
                        {deviceData.bills.length > 0 && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {deviceData.bills.length} {deviceData.bills.length === 1 ? 'فاتورة' : 'فواتير'}
                          </div>
                        )}
                      </div>
                      
                      {!isDeviceCollapsed && (
                        <>
                          {/* عرض الفواتير غير المرتبطة بطاولة */}
                          {deviceData.bills.length > 0 && (
                            <div className="space-y-2">
                              {deviceData.bills.map((bill: Bill) => (
                                <PlaystationBillItem
                                  key={bill.id || bill._id}
                                  bill={bill}
                                  onPaymentClick={handlePaymentClick}
                                  getStatusColor={getStatusColor}
                                  getStatusText={getStatusText}
                                  formatCurrency={formatCurrency}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* Unlinked Bills Section - فواتير غير مرتبطة بطاولة (باستثناء فواتير البلايستيشن والكمبيوتر) */}
      {(() => {
        const unlinkedBills = bills.filter((bill: Bill) => 
          !bill.table && 
          (bill.status === 'draft' || bill.status === 'partial' || bill.status === 'overdue') &&
          // استبعاد فواتير البلايستيشن والكمبيوتر لأنها تظهر في أقسامها الخاصة
          bill.billType !== 'playstation' && 
          bill.billType !== 'computer' &&
          !bill.sessions?.some((s: any) => s.deviceType === 'playstation' || s.deviceType === 'computer')
        );

        console.log('📋 فواتير غير مرتبطة بطاولة (كافيه فقط):', unlinkedBills.length);
        console.log('📋 تفاصيل:', unlinkedBills.map(b => ({
          id: b.billNumber,
          type: b.billType,
          hasSessions: !!b.sessions?.length
        })));

        if (unlinkedBills.length === 0) return null;

        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                <Receipt className="h-5 w-5 ml-2 text-purple-600 dark:text-purple-400" />
                فواتير غير مرتبطة بطاولة
              </h2>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {unlinkedBills.length} {unlinkedBills.length === 1 ? 'فاتورة' : 'فواتير'}
              </span>
            </div>
            <div className="space-y-2">
              {unlinkedBills.map((bill: Bill) => (
                <UnlinkedBillItem
                  key={bill.id || bill._id}
                  bill={bill}
                  onPaymentClick={handlePaymentClick}
                  getStatusColor={getStatusColor}
                  getStatusText={getStatusText}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Tables by Sections */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <TableIcon className="h-5 w-5 ml-2 text-orange-600 dark:text-orange-400" />
            الطاولات
          </h2>
        </div>
        
        {/* Sections */}
        {tableSections.map((section: any) => {
          const sectionTables = tables.filter((table: Table) => {
            const tableSection = typeof table.section === 'string' 
              ? table.section 
              : (table.section as any)?._id || (table.section as any)?.id;
            return tableSection === section.id && table.isActive;
          }).sort((a: Table, b: Table) => a.number - b.number);
          
          if (sectionTables.length === 0) return null;
          
          return (
            <div key={section.id} className="mb-6 last:mb-0">
              <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                {section.name}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {sectionTables.map((table: Table) => {
                  const tableData = tableBillsMap[table.number];
                  const hasUnpaid = tableData?.hasUnpaid || false;
                  
                  return (
                    <button
                      key={table.id || table._id}
                      onClick={() => {
                        setSelectedTable(table);
                        setShowTableBillsModal(true);
                      }}
                      className={`
                        relative p-4 rounded-lg border-2 transition-all duration-200
                        ${hasUnpaid 
                          ? 'border-red-400 bg-red-50 dark:bg-red-900/20 hover:border-red-500' 
                          : 'border-green-300 bg-green-50 dark:bg-green-900/20 hover:border-green-400'
                        }
                      `}
                    >
                      {hasUnpaid && (
                        <span className="absolute top-1 left-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          محجوزة
                        </span>
                      )}
                      {!hasUnpaid && (
                        <span className="absolute top-1 left-1 bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          فارغة
                        </span>
                      )}
                      <div className="flex flex-col items-center justify-center">
                        <TableIcon className={`h-8 w-8 mb-2 ${hasUnpaid ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
                        <span className={`text-lg font-bold ${hasUnpaid ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {table.number}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>


      {/* Table Bills Modal */}
      {showTableBillsModal && selectedTable && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowTableBillsModal(false);
            setSelectedTable(null);
            setTableBillsFilter('unpaid');
            setSearchQuery('');
          }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  فواتير الطاولة رقم {selectedTable.number}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {tableBillsMap[selectedTable.number]?.bills.length || 0} {tableBillsMap[selectedTable.number]?.bills.length === 1 ? 'فاتورة' : 'فواتير'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTableBillsModal(false);
                  setSelectedTable(null);
                  setTableBillsFilter('unpaid');
                  setSearchQuery('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Filter and Search */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">فلترة حسب الحالة:</label>
                <select
                  value={tableBillsFilter}
                  onChange={(e) => setTableBillsFilter(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">جميع الفواتير</option>
                  <option value="unpaid">غير مدفوع</option>
                  <option value="paid">مدفوع بالكامل</option>
                  <option value="partial">مدفوع جزئياً</option>
                  <option value="overdue">متأخر</option>
                  <option value="cancelled">ملغية</option>
                </select>
              </div>
              {/* Search Section */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="بحث عن فاتورة برقمها أو معرفها..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Bills List */}
            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                const tableBills = tableBillsMap[selectedTable.number]?.bills || [];
                let filteredTableBills = tableBills.filter((bill: Bill) => {
                  if (tableBillsFilter === 'all') return true;
                  if (tableBillsFilter === 'unpaid') {
                    return bill.status === 'draft' || bill.status === 'partial' || bill.status === 'overdue';
                  }
                  return bill.status === tableBillsFilter;
                });
                
                // Apply search filter if searchQuery exists
                if (searchQuery) {
                  filteredTableBills = filteredTableBills.filter((bill: Bill) => 
                    bill.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    bill.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    bill._id?.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                }

                if (filteredTableBills.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <Receipt className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">لا توجد فواتير</h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        {tableBillsFilter === 'all' ? 'لا توجد فواتير لهذه الطاولة' : `لا توجد فواتير بحالة "${getStatusText(tableBillsFilter)}"`}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {filteredTableBills.map((bill: Bill) => (
                      <TableBillItem
                        key={bill.id || bill._id}
                        bill={bill}
                        onPaymentClick={handlePaymentClick}
                        onViewClick={(bill) => {
                          const billUrl = `/bill/${bill.id || bill._id}`;
                          window.open(billUrl, '_blank', 'noopener,noreferrer');
                        }}
                        onEditClick={(bill) => {
                          handlePaymentClick(bill);
                          setShowTableBillsModal(false);
                        }}
                        getStatusColor={getStatusColor}
                        getStatusText={getStatusText}
                        formatCurrency={formatCurrency}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
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
                      {selectedBill?.table && (
                        <div className="col-span-2">
                          <span className="text-gray-600 dark:text-gray-300">الطاولة:</span>
                          <span className="font-medium mr-2 dark:text-gray-100">طاولة {selectedBill.table.number}</span>
                          <button
                            onClick={() => {
                              setNewTableNumber(selectedBill.table?._id || selectedBill.table?.id || null);
                              setShowChangeTableModal(true);
                            }}
                            className="mr-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                          >
                            تغيير الطاولة
                          </button>
                        </div>
                      )}
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
                        {selectedBill.sessions?.filter(s => {
                          // عرض الجلسات النشطة فقط التي تنتمي لنفس الطاولة أو بدون طاولة محددة
                          if (s.status !== 'active') return false;
                          // إذا كانت الفاتورة مرتبطة بطاولة، تحقق من أن الجلسة تنتمي لنفس الطاولة
                          if (selectedBill.table) {
                            const billTableId = selectedBill.table._id || selectedBill.table.id || selectedBill.table;
                            const sessionTableId = s.table?._id || s.table?.id || s.table;
                            // إذا كانت الجلسة لها طاولة، تحقق من التطابق
                            if (sessionTableId) {
                              return billTableId.toString() === sessionTableId.toString();
                            }
                          }
                          return true;
                        }).map((session, index) => (
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

                  {/* تفاصيل الأصناف مع الكميات */}
                  {selectedBill && (
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                      <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">تفاصيل الأصناف</h5>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(() => {
                          const items = aggregateItemsWithPayments(
                            selectedBill?.orders || [], 
                            selectedBill?.itemPayments || [],
                            selectedBill?.status,
                            selectedBill?.paid,
                            selectedBill?.total
                          );
                          
                          if (items.length === 0) {
                            return (
                              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                                لا توجد أصناف في هذه الفاتورة
                              </div>
                            );
                          }
                          
                          return items.map((item, index) => (
                            <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">{formatCurrency(item.price)}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="text-center p-2 bg-gray-100 dark:bg-gray-700 rounded">
                                  <div className="text-gray-600 dark:text-gray-400">الكمية الكلية</div>
                                  <div className="font-bold text-gray-900 dark:text-gray-100">{formatDecimal(item.totalQuantity)}</div>
                                </div>
                                <div className="text-center p-2 bg-green-100 dark:bg-green-900 rounded">
                                  <div className="text-green-700 dark:text-green-300">المدفوع</div>
                                  <div className="font-bold text-green-800 dark:text-green-200">{formatDecimal(item.paidQuantity)}</div>
                                </div>
                                <div className="text-center p-2 bg-orange-100 dark:bg-orange-900 rounded">
                                  <div className="text-orange-700 dark:text-orange-300">المتبقي</div>
                                  <div className="font-bold text-orange-800 dark:text-orange-200">{formatDecimal(item.remainingQuantity)}</div>
                                </div>
                              </div>
                              {item.addons && item.addons.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                    {item.addons.map((addon, addonIdx) => (
                                      <div key={addonIdx} className="flex justify-between">
                                        <span>↳ {addon.name}</span>
                                        <span>{formatCurrency(addon.price)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ));
                        })()}
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

                          {/* زر دفع جزئي للجلسة */}
                          {selectedBill?.sessions && selectedBill.sessions.length > 0 && (
                            <button
                              onClick={() => {
                                // اختيار أول جلسة غير مدفوعة بالكامل
                                const unpaidSession = selectedBill.sessions.find(s => 
                                  (s.finalCost - (s.totalCost || 0)) > 0
                                );
                                if (unpaidSession) {
                                  setSelectedSession(unpaidSession);
                                  setSessionPaymentAmount('');
                                  setSessionPaymentMethod('cash');
                                  setShowSessionPaymentModal(true);
                                } else {
                                  showNotification('جميع الجلسات مدفوعة بالكامل', 'info');
                                }
                              }}
                              className={`p-4 border-2 rounded-lg text-center transition-colors duration-200 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500`}
                            >
                              <div className="text-2xl mb-2">🎮</div>
                              <div className="font-medium dark:text-gray-100">دفع جزئي للجلسة</div>
                              <div className="text-sm text-gray-600 dark:text-gray-300">دفع مبلغ جزئي لجلسة البلايستيشن</div>
                            </button>
                          )}
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">نسبة الخصم %</label>
                            <input
                              type="number"
                              value={discountPercentage}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                                  setDiscountPercentage(value);
                                  
                                  // Calculate new payment amount based on discount
                                  if (value && !isNaN(parseFloat(value)) && selectedBill?.remaining) {
                                    const discount = parseFloat(value) / 100;
                                    const original = selectedBill.remaining;
                                    const discountedAmount = original * (1 - discount);
                                    setPaymentAmount(discountedAmount.toFixed(2));
                                  } else if (selectedBill?.remaining) {
                                    setPaymentAmount(selectedBill.remaining.toString());
                                  }
                                }
                              }}
                              min="0"
                              max="100"
                              step="0.01"
                              placeholder="0"
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">أدخل نسبة الخصم من 0 إلى 100%</p>
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
                    <div>
                      {selectedBill?.qrCode ? (
                        <img
                          src={selectedBill.qrCode}
                          alt="QR Code"
                          className="mx-auto mb-4 w-48 h-48 border-4 border-white dark:border-gray-600 shadow-lg"
                        />
                      ) : (
                        <div className="mx-auto mb-4 w-48 h-48 border-4 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                          <QrCode className="h-16 w-16 text-gray-300 dark:text-gray-600" />
                        </div>
                      )}
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
                          <button
                            onClick={() => selectedBill && printBill(selectedBill, user?.organizationName)}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors duration-200 flex items-center"
                          >
                            <Printer className="h-4 w-4 ml-1 inline" />
                            طباعة الفاتورة
                          </button>
                        </div>
                      </div>
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

                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h6 className="font-medium text-gray-900 dark:text-gray-100 mb-2">رابط الفاتورة للعميل:</h6>
                      <div className="flex items-center space-x-2 space-x-reverse mb-3">
                        <input
                          type="text"
                          value={selectedBill?.qrCodeUrl || `http://localhost:3000/bill/${selectedBill?.id || selectedBill?._id}`}
                          readOnly
                          className="flex-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100"
                        />
                        <button
                          onClick={() => {
                            const url = selectedBill?.qrCodeUrl || `http://localhost:3000/bill/${selectedBill?.id || selectedBill?._id}`;
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
                          onClick={() => {
                            const url = selectedBill?.qrCodeUrl || `http://localhost:3000/bill/${selectedBill?.id || selectedBill?._id}`;
                            window.open(url, '_blank');
                          }}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors duration-200"
                        >
                          فتح
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              {/* زر حذف الفاتورة - يظهر فقط إذا لم تكن مدفوعة بالكامل */}
              {selectedBill?.status !== 'paid' && (
                <button
                  onClick={() => setShowCancelConfirmModal(true)}
                  className="px-4 py-2 text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 rounded-lg transition-colors duration-200"
                >
                  حذف الفاتورة
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
                  const itemsWithRemaining = aggregateItemsWithPayments(
                    selectedBill?.orders || [], 
                    selectedBill?.itemPayments || [],
                    selectedBill?.status,
                    selectedBill?.paid,
                    selectedBill?.total
                  ).filter(item => item.remainingQuantity > 0);


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
                            {item.addons.map((addon, addonIdx) => (
                              <div key={addonIdx} className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-300">
                                <span>↳ إضافة: {addon.name}</span>
                                <span>({formatCurrency(addon.price)})</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                  });
                })()}
              </div>

              {(() => {
                const itemsWithRemaining = aggregateItemsWithPayments(
                  selectedBill?.orders || [], 
                  selectedBill?.itemPayments || [],
                  selectedBill?.status,
                  selectedBill?.paid,
                  selectedBill?.total
                ).filter(item => item.remainingQuantity > 0);
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
                    {aggregateItemsWithPayments(
                      selectedBill?.orders || [], 
                      selectedBill?.itemPayments || [],
                      selectedBill?.status,
                      selectedBill?.paid,
                      selectedBill?.total
                    ).filter(item => {
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
                            aggregateItemsWithPayments(
                              selectedBill?.orders || [], 
                              selectedBill?.itemPayments || [],
                              selectedBill?.status,
                              selectedBill?.paid,
                              selectedBill?.total
                            ).filter(item => {
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
        title="تأكيد حذف الفاتورة"
        message={`هل أنت متأكد من حذف فاتورة رقم #${selectedBill?.billNumber}؟\n\n⚠️ هذا الإجراء لا يمكن التراجع عنه.`}
        confirmText={isCancelingBill ? 'جاري الحذف...' : 'نعم، حذف الفاتورة'}
        cancelText="تراجع"
        confirmColor="bg-red-600 hover:bg-red-700"
        loading={isCancelingBill}
      />

      {/* Session End Confirmation Modal */}
      {showSessionEndModal && sessionToEnd && (() => {
        const isLinkedToTable = !!(selectedBill?.table);
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">تأكيد إنهاء الجلسة</h3>
              
              {!isLinkedToTable && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ هذه الجلسة غير مرتبطة بطاولة. يرجى إدخال اسم العميل قبل الإنهاء.
                  </p>
                </div>
              )}
              
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                هل أنت متأكد من إنهاء هذه الجلسة؟ سيتم حساب التكلفة النهائية وإغلاق الجلسة.
              </p>
              
              {!isLinkedToTable && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    اسم العميل <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerNameForEndSession}
                    onChange={(e) => setCustomerNameForEndSession(e.target.value)}
                    placeholder="أدخل اسم العميل"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-gray-100"
                    disabled={isEndingSession}
                  />
                </div>
              )}
              
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
        );
      })()}

      {/* Session Partial Payment Modal */}
      {showSessionPaymentModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                دفع جزئي للجلسة
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {selectedSession.deviceName} - {selectedSession.deviceType === 'playstation' ? 'بلايستيشن' : 'كمبيوتر'}
              </p>
            </div>

            <div className="p-6">
              {/* معلومات الجلسة */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">معلومات الجلسة</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">الجهاز:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{selectedSession.deviceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">النوع:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {selectedSession.deviceType === 'playstation' ? 'بلايستيشن' : 'كمبيوتر'}
                    </span>
                  </div>
                  {selectedSession.deviceType === 'playstation' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">عدد الدراعات:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{selectedSession.controllers || 1}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">التكلفة الإجمالية:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(selectedSession.finalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">المدفوع:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(selectedSession.totalCost || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2">
                    <span className="text-gray-600 dark:text-gray-300">المتبقي:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {formatCurrency(selectedSession.finalCost - (selectedSession.totalCost || 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* إدخال المبلغ */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  المبلغ المطلوب دفعه
                </label>
                <input
                  type="number"
                  value={sessionPaymentAmount}
                  onChange={(e) => setSessionPaymentAmount(e.target.value)}
                  min="0"
                  max={selectedSession.finalCost - (selectedSession.totalCost || 0)}
                  step="0.01"
                  placeholder="أدخل المبلغ"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  الحد الأقصى: {formatCurrency(selectedSession.finalCost - (selectedSession.totalCost || 0))}
                </p>
              </div>

              {/* طريقة الدفع */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  طريقة الدفع
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setSessionPaymentMethod('cash')}
                    className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${
                      sessionPaymentMethod === 'cash'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">💵</div>
                    <div className="text-sm font-medium">نقداً</div>
                  </button>
                  <button
                    onClick={() => setSessionPaymentMethod('card')}
                    className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${
                      sessionPaymentMethod === 'card'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">💳</div>
                    <div className="text-sm font-medium">بطاقة</div>
                  </button>
                  <button
                    onClick={() => setSessionPaymentMethod('transfer')}
                    className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${
                      sessionPaymentMethod === 'transfer'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">📱</div>
                    <div className="text-sm font-medium">تحويل</div>
                  </button>
                </div>
              </div>

              {/* ملخص الدفع */}
              {sessionPaymentAmount && parseFloat(sessionPaymentAmount) > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">ملخص الدفع</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-800 dark:text-blue-200">المبلغ المدفوع:</span>
                      <span className="font-bold text-blue-900 dark:text-blue-100">
                        {formatCurrency(parseFloat(sessionPaymentAmount))}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-blue-200 dark:border-blue-600 pt-2">
                      <span className="text-blue-800 dark:text-blue-200">المتبقي بعد الدفع:</span>
                      <span className="font-bold text-blue-900 dark:text-blue-100">
                        {formatCurrency(
                          selectedSession.finalCost - (selectedSession.totalCost || 0) - parseFloat(sessionPaymentAmount)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <button
                onClick={() => {
                  setShowSessionPaymentModal(false);
                  setSelectedSession(null);
                  setSessionPaymentAmount('');
                }}
                disabled={isProcessingSessionPayment}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                إلغاء
              </button>

              <button
                onClick={handlePaySessionPartial}
                disabled={
                  isProcessingSessionPayment ||
                  !sessionPaymentAmount ||
                  parseFloat(sessionPaymentAmount) <= 0 ||
                  parseFloat(sessionPaymentAmount) > (selectedSession.finalCost - (selectedSession.totalCost || 0))
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
              >
                {isProcessingSessionPayment ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري الدفع...
                  </>
                ) : (
                  'تأكيد الدفع'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Table Modal */}
      {showChangeTableModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              تغيير الطاولة
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                الفاتورة الحالية: #{selectedBill.billNumber}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                الطاولة الحالية: {selectedBill.table?.number}
              </p>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                اختر الطاولة الجديدة
              </label>
              <select
                value={newTableNumber || ''}
                onChange={(e) => setNewTableNumber(e.target.value ? e.target.value : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={isChangingTable}
              >
                <option value="">اختر طاولة...</option>
                {tables
                  .filter((t: any) => t.isActive && t._id !== selectedBill.table?._id)
                  .sort((a: any, b: any) => {
                    return String(a.number).localeCompare(String(b.number), 'ar', { numeric: true });
                  })
                  .map((table: any) => (
                    <option key={table.id || table._id} value={table._id}>
                      طاولة {table.number}
                    </option>
                  ))}
              </select>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ سيتم نقل جميع الطلبات والجلسات المرتبطة بهذه الفاتورة إلى الطاولة الجديدة.
              </p>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowChangeTableModal(false);
                  setNewTableNumber(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors"
                disabled={isChangingTable}
              >
                إلغاء
              </button>
              <button
                onClick={handleChangeTable}
                className={`px-6 py-2 rounded-lg flex items-center justify-center min-w-[120px] transition-all duration-200 ${
                  isChangingTable || !newTableNumber
                    ? 'bg-blue-400 dark:bg-blue-700 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                } text-white`}
                disabled={isChangingTable || !newTableNumber}
              >
                {isChangingTable ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري التغيير...
                  </>
                ) : (
                  'تأكيد التغيير'
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
