import { useEffect, useState, useMemo, memo, useRef } from 'react';
import { Receipt, QrCode, Printer, DollarSign, CreditCard, Calendar, User, CheckCircle, Table as TableIcon, Search, X, Eye, EyeOff, Gamepad2, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, Bill, Order, OrderItem, Session } from '../services/api';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';
import ConfirmModal from '../components/ConfirmModal';
import { printBill } from '../utils/printBill';
import { useNavigate, useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { aggregateItemsWithPayments, getItemIdsForAggregatedItem } from '../utils/billAggregation';
import '../styles/billing-animations.css';
import PartialPaymentModal from '../components/PartialPaymentModal';
import { useBillAggregation } from '../hooks/useBillAggregation';
import React from 'react';

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
  onChangeTableClick,
  getStatusColor, 
  getStatusText, 
  formatCurrency 
}: { 
  bill: Bill; 
  onPaymentClick: (bill: Bill) => void;
  onChangeTableClick?: (bill: Bill) => void;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  formatCurrency: (amount: number) => string;
}) => {
  const isUnpaid = ['draft', 'partial', 'overdue'].includes(bill.status);
  
  return (
    <div className={`
      flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg border-2 gap-3 sm:gap-0
      ${isUnpaid 
        ? 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-300 dark:border-orange-700 hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-orange-200 dark:hover:shadow-orange-900/50' 
        : 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700 hover:border-green-400 dark:hover:border-green-600 hover:shadow-green-200 dark:hover:shadow-green-900/50'
      }
    `}>
      <div 
        className="flex-1 cursor-pointer w-full sm:w-auto"
        onClick={() => onPaymentClick(bill)}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100">
            #{bill.billNumber || bill.id || bill._id}
          </span>
          <span className={`px-2 sm:px-3 py-1 text-xs font-bold rounded-full shadow-sm ${getStatusColor(bill.status)}`}>
            {getStatusText(bill.status)}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          {bill.table?.number ? (
            <span className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
              🪑 طاولة: {bill.table.number}
            </span>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
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
          <span className="font-medium">{formatCurrency(bill.total || 0)}</span>
        </div>
      </div>
      <div className="flex flex-row sm:flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
        <div className="text-center sm:text-left bg-white dark:bg-gray-800 px-2 sm:px-3 py-2 rounded-lg shadow-sm">
          <div className={`text-sm sm:text-base font-bold ${isUnpaid ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
            {formatCurrency(bill.remaining || 0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">متبقي</div>
        </div>
        {onChangeTableClick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChangeTableClick(bill);
            }}
            className="px-2 sm:px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center gap-1 shadow-md hover:shadow-lg whitespace-nowrap"
            title="تغيير الطاولة"
          >
            <TableIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">تغيير</span>
          </button>
        )}
      </div>
    </div>
  );
});

// Memoized Bill Item Component for table bills modal
const TableBillItem = memo(({ 
  bill, 
  onPaymentClick, 
  onViewClick,
  onEditClick,
  onPrintClick,
  getStatusColor, 
  getStatusText, 
  formatCurrency 
}: { 
  bill: Bill; 
  onPaymentClick: (bill: Bill) => void;
  onViewClick: (bill: Bill) => void;
  onEditClick: (bill: Bill) => void;
  onPrintClick: (bill: Bill) => void;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  formatCurrency: (amount: number) => string;
}) => {
  const isUnpaid = ['draft', 'partial', 'overdue'].includes(bill.status);
  
  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border-2 p-3 sm:p-4 transition-all duration-300 transform hover:scale-[1.01] hover:shadow-lg cursor-pointer group
        ${isUnpaid 
          ? 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-300 dark:border-orange-600 hover:border-orange-400 hover:shadow-orange-200/50' 
          : 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-300 dark:border-emerald-600 hover:border-emerald-400 hover:shadow-emerald-200/50'
        }
      `}
      onClick={() => onPaymentClick(bill)}
    >
      {/* شريط علوي رفيع */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${isUnpaid ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-emerald-500 to-green-500'}`}></div>
      
      <div className="flex items-center justify-between gap-3">
        {/* معلومات الفاتورة */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-base text-gray-900 dark:text-gray-100">
              #{bill.billNumber || bill.id || bill._id}
            </span>
            <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusColor(bill.status)}`}>
              {getStatusText(bill.status)}
            </span>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('ar-EG') : '-'}
            </span>
            {bill.customerName && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {bill.customerName}
              </span>
            )}
          </div>
        </div>
        
        {/* المبالغ */}
        <div className="text-center bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg shadow-sm min-w-[120px]">
          <div className={`text-lg font-bold mb-1 ${isUnpaid ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {formatCurrency(bill.total || 0)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
            <div>مدفوع: <span className="text-green-600 font-medium">{formatCurrency(bill.paid || 0)}</span></div>
            <div>متبقي: <span className={`font-medium ${(bill.remaining || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(bill.remaining || 0)}</span></div>
          </div>
        </div>
        
        {/* الأزرار */}
        <div className="flex flex-col gap-1.5 min-w-[100px]">
          <div className="flex gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewClick(bill);
              }}
              className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors flex items-center justify-center gap-1"
              title="عرض الفاتورة"
            >
              <Eye className="h-3 w-3" />
              <span>عرض</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPrintClick(bill);
              }}
              className="flex-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-md transition-colors flex items-center justify-center gap-1"
              title="طباعة"
            >
              <Printer className="h-3 w-3" />
              <span>طباعة</span>
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditClick(bill);
            }}
            className="w-full px-2 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded-md transition-colors flex items-center justify-center gap-1"
            title="إدارة الدفع"
          >
            <DollarSign className="h-3 w-3" />
            <span>إدارة الدفع</span>
          </button>
        </div>
      </div>
    </div>
  );
});

const Billing = () => {
  const location = useLocation();
  const { bills, fetchBills, cancelBill, addPartialPayment, showNotification, user, tables, fetchTables, fetchTableSections, tableSections, getTableStatus } = useApp();

  // Socket.IO reference
  const socketRef = useRef<Socket | null>(null);
  const selectedBillRef = useRef<Bill | null>(null);

  // دالة للتحقق من نوع المستخدم
  const checkUserRole = () => {
    // التحقق من الدور - admin هو المدير الوحيد في النظام
    if (user?.role === 'admin') {
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

    // افتراضياً - موظف (staff, cashier, kitchen)
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
  // Removed old partial payment variables - now handled by PartialPaymentModal component
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
  const [showPaidAmount, setShowPaidAmount] = useState(false);
  const [showRemainingAmount, setShowRemainingAmount] = useState(false);
  const navigate = useNavigate();

  // استخدام Backend aggregation بدلاً من Frontend
  const { 
    aggregatedItems: backendAggregatedItems, 
    loading: aggregationLoading, 
    error: aggregationError,
    refetch: refetchAggregatedItems 
  } = useBillAggregation(selectedBill?.id || selectedBill?._id || null);

  // إعادة جلب العناصر المجمعة عند تغيير الفاتورة أو بعد الدفع
  useEffect(() => {
    if (selectedBill && (selectedBill.id || selectedBill._id)) {
      refetchAggregatedItems();
    }
  }, [selectedBill?.id, selectedBill?._id, selectedBill?.paid, selectedBill?.remaining]);

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

  // Handle navigation from Cafe page to open payment modal
  useEffect(() => {
    const state = location.state as any;
    if (state?.openPaymentModal && state?.billId && bills.length > 0 && !showPaymentModal) {
      // Find the bill by ID
      const targetBill = bills.find((bill: Bill) => 
        (bill._id === state.billId || bill.id === state.billId)
      );
      
      if (targetBill) {
        // Open payment modal for this bill
        handlePaymentClick(targetBill);
        
        // Show notification about which table we're managing
        if (state.tableNumber) {
          showNotification(`تم فتح إدارة الدفع لطاولة ${state.tableNumber}`, 'info');
        }
        
        // Clear the state immediately to prevent reopening
        navigate(location.pathname, { replace: true, state: {} });
      } else {
        showNotification('لم يتم العثور على الفاتورة المطلوبة', 'error');
        // Clear the state even if bill not found
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [bills, location.state, navigate, location.pathname, showPaymentModal]);

  // Socket.IO listeners for real-time bill updates
  useEffect(() => {
    // Update ref when selectedBill changes
    selectedBillRef.current = selectedBill;
  }, [selectedBill]);

  useEffect(() => {
    // Prevent duplicate connections in React Strict Mode
    if (socketRef.current) {
      return;
    }

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

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
    });

    socket.on('disconnect', () => {
    });

    socket.on('reconnect', () => {
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
      
      if (data.type === 'created' || data.type === 'updated' || data.type === 'deleted') {
        // الحذف يتم الآن مباشرة من Local و Atlas
        // لذلك يمكن إعادة جلب الفواتير فوراً
        fetchBills();
        fetchTables();
      }
    });

    // Listen for payment-received event
    socket.on('payment-received', (data: any) => {
      
      // Refresh bills list and tables when payment is received
      fetchBills();
      fetchTables();
      
      // If the updated bill is currently selected, refresh it immediately
      const currentBill = selectedBillRef.current;
      if (currentBill && data.bill && (data.bill._id === currentBill._id || data.bill.id === currentBill.id)) {
        // Update with fresh data from server
        setSelectedBill({ ...data.bill });
        
        // إذا كانت نافذة الدفع مفتوحة، نحدث مبلغ الدفع أيضاً
        if (showPaymentModal) {
          setPaymentAmount(data.bill.remaining?.toString() || '0');
          setOriginalAmount(data.bill.remaining?.toString() || '0');
        }
        
        // Force re-render of components that depend on bill data
        setTimeout(() => {
          setSelectedBill(prev => prev ? { ...prev } : null);
        }, 50);
      }
    });

    // Listen for partial-payment-received event (new)
    socket.on('partial-payment-received', (data: any) => {
      
      // Refresh bills list immediately
      fetchBills();
      fetchTables();
      
      // If the updated bill is currently selected, refresh it
      const currentBill = selectedBillRef.current;
      if (currentBill && data.bill && (data.bill._id === currentBill._id || data.bill.id === currentBill.id)) {
        // Update with fresh data including itemPayments
        setSelectedBill({ ...data.bill });
        
        // إذا كانت نافذة الدفع مفتوحة، نحدث مبلغ الدفع أيضاً
        if (showPaymentModal) {
          setPaymentAmount(data.bill.remaining?.toString() || '0');
          setOriginalAmount(data.bill.remaining?.toString() || '0');
        }
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
      // Don't disconnect in development due to Strict Mode
      if (import.meta.env.DEV) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('reconnect');
        socket.off('connect_error');
        socket.off('error');
        socket.off('bill-update');
        socket.off('payment-received');
        socket.off('order-update');
        socket.off('table-status-update');
      } else {
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
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // تحديث map للطاولات والفواتير
  useEffect(() => {
    if (tables.length > 0) {
      const map: Record<number, { hasUnpaid: boolean; bills: Bill[] }> = {};
      
      tables.forEach((table: Table) => {
        const tableIdStr = table._id.toString();
        const tableBills = bills.filter((bill: Bill) => {
          if (!bill.table) return false;
          const billTableId = (bill.table._id || bill.table).toString();
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
    // Also don't update if partial payment modal is open to prevent bill switching
    if (selectedBill && bills.length > 0 && !showPaymentModal && !showPartialPaymentModal && !showSessionPaymentModal) {
      const updatedBill = bills.find((bill: Bill) =>
        bill.id === selectedBill.id || bill._id === selectedBill._id
      );
      if (updatedBill && JSON.stringify(updatedBill) !== JSON.stringify(selectedBill)) {
        setSelectedBill(updatedBill);
      }
    }
  }, [bills, selectedBill, showPaymentModal, showPartialPaymentModal, showSessionPaymentModal]);

  // تحديث مبلغ الدفع تلقائياً عند تغيير الفاتورة المحددة
  useEffect(() => {
    if (selectedBill && showPaymentModal && selectedBill.remaining !== undefined) {
      // تحديث مبلغ الدفع ليكون المبلغ المتبقي
      setPaymentAmount(selectedBill.remaining.toString());
      setOriginalAmount(selectedBill.remaining.toString());
    }
  }, [selectedBill?.remaining, selectedBill?.paid, selectedBill?.total, showPaymentModal]);

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
              // ولكن فقط إذا لم تكن أي نافذة دفع مفتوحة
              if (selectedBill && 
                  (selectedBill._id === bill._id || selectedBill.id === bill.id) &&
                  !showPaymentModal && 
                  !showPartialPaymentModal && 
                  !showSessionPaymentModal) {
                const billRes = await api.getBill(bill._id || bill.id);
                if (billRes.success && billRes.data) {
                  setSelectedBill(billRes.data);
                }
              }
              // إذا كانت نافذة الدفع مفتوحة، نحدث الفاتورة المحددة مع تحديث مبلغ الدفع
              else if (selectedBill && 
                       (selectedBill._id === bill._id || selectedBill.id === bill.id) &&
                       showPaymentModal) {
                const billRes = await api.getBill(bill._id || bill.id);
                if (billRes.success && billRes.data) {
                  setSelectedBill(billRes.data);
                  // تحديث مبلغ الدفع إذا لم يكن المستخدم قد عدله يدوياً
                  if (paymentAmount === originalAmount) {
                    setPaymentAmount(billRes.data.remaining?.toString() || '0');
                    setOriginalAmount(billRes.data.remaining?.toString() || '0');
                  }
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
    // الاعتماد فقط على وجود جلسة نشطة وحالة النوافذ
  }, [bills.length, bills.map(b => (b.sessions || []).map(s => s.status).join(',')).join(','), showPaymentModal, showPartialPaymentModal, showSessionPaymentModal, selectedBill?._id, selectedBill?.id, paymentAmount, originalAmount]);

  // تحديث تلقائي للجلسات النشطة في نافذة الدفع الجزئي
  useEffect(() => {
    if (!showSessionPaymentModal || !selectedBill) return;
    
    const hasActiveSessions = selectedBill.sessions?.some((s: any) => s.status === 'active');
    if (!hasActiveSessions) return;
    
    const interval = setInterval(async () => {
      try {
        const billRes = await api.getBill(selectedBill._id || selectedBill.id);
        if (billRes.success && billRes.data) {
          setSelectedBill(billRes.data);
        }
      } catch (error) {
        console.error('خطأ في تحديث الجلسات:', error);
      }
    }, 10000); // كل 10 ثواني
    
    return () => clearInterval(interval);
  }, [showSessionPaymentModal, selectedBill?._id, selectedBill?.id]);

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

  // دالة لإغلاق نافذة الدفع مع مسح الـ state
  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedBill(null);
    setPaymentAmount('');
    setOriginalAmount('');
    setPaymentMethod('cash');
    setPaymentReference('');
    setDiscountPercentage('');
    
    // مسح navigation state إذا كان موجود
    const currentState = location.state as any;
    if (currentState?.openPaymentModal) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  };

  // دالة للذهاب إلى صفحة الطلبات وفتح نافذة الطاولة
  const handleGoToTableOrders = () => {
    if (!selectedBill?.table) return;
    
    
    const tableId = selectedBill.table._id || selectedBill.table;
    const tableNumber = selectedBill.table.number;
    
    
    
    // إغلاق نافذة الدفع
    handleClosePaymentModal();
    
    // الانتقال إلى صفحة الطلبات مع معرف الطاولة
    navigate('/cafe', {
      state: {
        openTableModal: true,
        tableId,
        tableNumber
      }
    });
  };

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
    setPaymentMethod('cash');
    setPaymentReference('');
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
      
      // حساب الإجمالي بعد الخصم إذا وُجد
      let effectiveTotal = selectedBill.total || 0;
      let discountAmount = 0;
      
      if (discountPercentage && parseFloat(discountPercentage) > 0) {
        discountAmount = (selectedBill.subtotal || selectedBill.total || 0) * (parseFloat(discountPercentage) / 100);
        effectiveTotal = (selectedBill.total || 0) - discountAmount;
      }
      
      // Calculate the new paid amount (previous paid + current payment)
      const newPaidAmount = (selectedBill.paid || 0) + parseFloat(paymentAmount);
      
      // Calculate remaining amount based on effective total (after discount)
      const newRemaining = Math.max(0, effectiveTotal - newPaidAmount);
      
      // Determine the new status based on the payment
      let newStatus = selectedBill.status || 'draft';
      
      // إذا كان المتبقي = 0 أو المدفوع >= الإجمالي الفعلي (بعد الخصم)، الفاتورة مدفوعة
      if (newRemaining === 0 || newPaidAmount >= effectiveTotal) {
        // التحقق من عدم وجود جلسات نشطة
        if (!hasActiveSession(selectedBill)) {
          newStatus = 'paid';
        } else {
          newStatus = 'partial';
        }
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
        // Include the original total and effective total
        total: selectedBill.total || 0,
        effectiveTotal: effectiveTotal
      };

      // Add discount percentage if provided
      if (discountPercentage && parseFloat(discountPercentage) > 0) {
        paymentData.discountPercentage = parseFloat(discountPercentage);
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
        
        handleClosePaymentModal();

        // لا نستدعي updateBillStatus هنا لأن الـ Backend يتولى ذلك
        // والاستدعاء هنا قد يُعيد حساب الحالة بشكل خاطئ

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
    
    // العناصر المحددة يتم إدارتها الآن داخل PartialPaymentModal
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

      // التحقق من المبلغ المدفوع والمتبقي
      const billPaid = selectedBill?.paid || 0;
      const billRemaining = selectedBill?.remaining || 0;

      // تحديد الحالة الجديدة
      let newStatus: 'draft' | 'partial' | 'paid' | 'cancelled' | 'overdue';

      // الشرط الوحيد للفاتورة المدفوعة بالكامل: المتبقي = 0 ولا توجد جلسات نشطة
      if (billRemaining === 0 && !hasActive) {
        newStatus = 'paid';
      } else if (hasActive) {
        // توجد جلسات نشطة (حتى لو كانت جميع الأصناف مدفوعة)
        newStatus = 'partial';
      } else if (billPaid > 0) {
        // تم دفع جزء من المبلغ
        newStatus = 'partial';
      } else {
        // لم يتم الدفع بعد
        newStatus = 'draft';
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

  const handlePartialPaymentSubmit = async (
    items: Array<{ itemId: string; quantity: number }>,
    paymentMethod: 'cash' | 'card' | 'transfer'
  ) => {
    if (!selectedBill || items.length === 0) return;

    try {
      setIsProcessingPartialPayment(true);
      
      // استخدام Backend aggregation بدلاً من Frontend logic
      const response = await api.addPartialPaymentAggregated(selectedBill.id || selectedBill._id, {
        items,
        paymentMethod
      });

      // التحقق من نجاح الطلب
      if (response.success) {
        // حساب المبلغ المدفوع
        const totalPaid = items.reduce((sum, item) => {
          const aggregatedItem = backendAggregatedItems.find(aggItem => aggItem.id === item.itemId);
          return sum + (aggregatedItem ? aggregatedItem.price * item.quantity : 0);
        }, 0);
        
        // إعادة تحميل البيانات فوراً
        await Promise.all([
          fetchBills(),
          fetchTables()
        ]);

        // تحديث الفاتورة المحددة للحصول على أحدث البيانات
        const refreshedBillResponse = await api.getBill(selectedBill.id || selectedBill._id);
        if (refreshedBillResponse.success && refreshedBillResponse.data) {
          const updatedBill = refreshedBillResponse.data;
          setSelectedBill(updatedBill);
          
          // التحقق من حالة الفاتورة المحدثة
          const updatedAggregatedItems = aggregateItemsWithPayments(
            updatedBill.orders || [],
            updatedBill.itemPayments || [],
            updatedBill.status,
            updatedBill.paid,
            updatedBill.total
          );
          
          const billFullyPaid = updatedBill.remaining === 0 || updatedBill.paid >= updatedBill.total;
          
          if (updatedBill.status === 'paid' && billFullyPaid) {
            setShowPartialPaymentModal(false);
            showNotification(`تم دفع ${formatCurrency(totalPaid)} بنجاح! الفاتورة مكتملة.`, 'success');
          } else {
            showNotification(`تم دفع ${formatCurrency(totalPaid)} بنجاح!`, 'success');
          }
        } else {
          showNotification(`تم دفع ${formatCurrency(totalPaid)} بنجاح!`, 'success');
        }
      } else {
        const errorMessage = response.message || 'فشل في تسجيل الدفع الجزئي';
        showNotification(errorMessage, 'error');
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
    const sessionId = selectedSession._id || selectedSession.id;
    const sessionPayment = selectedBill.sessionPayments?.find(
      sp => sp.sessionId === sessionId
    );
    
    // حساب المتبقي بنفس الطريقة المستخدمة في الـ UI
    const isActive = selectedSession.status === 'active';
    let totalCost = sessionPayment?.sessionCost || selectedSession.finalCost || selectedSession.totalCost || 0;
    
    // إذا كانت الجلسة نشطة ولم يكن هناك سعر، نحسب السعر الحالي
    if (isActive && totalCost === 0 && selectedSession.startTime) {
      const startTime = new Date(selectedSession.startTime);
      const now = new Date();
      const hours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      
      
      if (selectedSession.deviceType === 'playstation') {
        const controllers = selectedSession.controllers || 1;
        let hourlyRate = 20;
        if (controllers >= 4) hourlyRate = 30;
        else if (controllers >= 3) hourlyRate = 25;
        totalCost = Math.round(hours * hourlyRate);
      } else if (selectedSession.deviceType === 'computer') {
        totalCost = Math.round(hours * 15);
      }
    }
    
    const paidAmount = sessionPayment?.paidAmount || 0;
    const sessionRemaining = isActive 
      ? (totalCost - paidAmount) 
      : (sessionPayment?.remainingAmount !== undefined 
          ? sessionPayment.remainingAmount 
          : (totalCost - paidAmount));
    
    
    
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
        // إعادة تحميل البيانات أولاً
        await Promise.all([
          fetchTables(),
          fetchBills()
        ]);

        // جلب الفاتورة المحدثة بكل التفاصيل
        try {
          const fullBillResponse = await api.getBill(selectedBill.id || selectedBill._id);
          if (fullBillResponse && fullBillResponse.success && fullBillResponse.data) {
            setSelectedBill(fullBillResponse.data);
          } else {
            setSelectedBill(result.data);
          }
        } catch (fetchError) {
          console.error('خطأ في جلب تفاصيل الفاتورة:', fetchError);
          setSelectedBill(result.data);
        }

        // إعادة تعيين الحقول فقط (بدون إغلاق النافذة)
        setSessionPaymentAmount('');
        setSelectedSession(null);

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

  // دالة لفتح modal تغيير الطاولة
  const handleOpenChangeTableModal = (bill: Bill) => {
    setSelectedBill(bill);
    setShowChangeTableModal(true);
    setNewTableNumber(null);
  };

  // دالة تغيير الطاولة
  const handleChangeTable = async () => {
    if (!selectedBill || newTableNumber === null) return;
    
    setIsChangingTable(true);
    
    try {
      // Find table to get its number for notification
      const targetTable = tables.find((t: any) => t._id === newTableNumber);
      
      if (!targetTable) {
        showNotification('❌ الطاولة المحددة غير موجودة', 'error');
        return;
      }
      
      const result = await api.updateBill(selectedBill.id || selectedBill._id, {
        table: targetTable._id
      });
      
      if (result && result.success) {
        // تحديث البيانات أولاً
        await Promise.all([fetchBills(), fetchTables()]);
        
        // جلب الفاتورة المحدثة بكل التفاصيل (orders و sessions populated)
        if (result.data && result.data._id) {
          try {
            const fullBillResponse = await api.getBill(result.data._id);
            if (fullBillResponse && fullBillResponse.success && fullBillResponse.data) {
              setSelectedBill(fullBillResponse.data);
            } else {
              setSelectedBill(result.data);
            }
          } catch (fetchError) {
            console.error('خطأ في جلب تفاصيل الفاتورة:', fetchError);
            setSelectedBill(result.data);
          }
          
          // إذا كانت رسالة تشير إلى دمج الفواتير
          if (result.message && result.message.includes('دمج')) {
            showNotification(`✅ ${result.message}`, 'success');
          } else {
            showNotification(`✅ تم نقل الفاتورة إلى الطاولة ${targetTable?.number || newTableNumber} بنجاح`, 'success');
          }
        }
        
        // إغلاق نافذة تغيير الطاولة
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
      const billId = selectedBill.id || selectedBill._id;
      
      const result = await api.deleteBill(billId);
      if (result && result.success) {
        showNotification('تم حذف الفاتورة بنجاح', 'success');
        setShowCancelConfirmModal(false);
        handleClosePaymentModal();
        
        // الحذف يتم الآن مباشرة من Local و Atlas في نفس الوقت
        // لذلك يمكن إعادة جلب الفواتير فوراً بدون تأخير
        await Promise.all([fetchBills(), fetchTables()]);
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
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center truncate">
            <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400 ml-2 flex-shrink-0" />
            إدارة الفواتير
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mr-2 sm:mr-4 text-sm sm:text-base hidden sm:block">متابعة الفواتير والمدفوعات</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Bill Type Filter */}
          <select
            value={billTypeFilter}
            onChange={(e) => setBillTypeFilter(e.target.value as 'all' | 'cafe' | 'playstation' | 'computer')}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="all">جميع الفواتير</option>
            <option value="cafe">فواتير الكافيه</option>
            <option value="playstation">فواتير البلايستيشن</option>
            <option value="computer">فواتير الكمبيوتر</option>
          </select>
        </div>
      </div>

      {/* Stats - إخفاء الكروت المالية عن الموظفين */}
      {user?.role !== 'staff' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl shadow-md border-2 border-blue-200 dark:border-blue-700 p-4 sm:p-6 transition-all duration-300 hover:shadow-xl hover:scale-105 transform">
            <div className="flex items-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Receipt className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <div className="mr-3 sm:mr-4">
                <p className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300">
                  إجمالي الفواتير
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {formatDecimal(billStats.totalBills)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-md border-2 border-green-200 dark:border-green-700 p-4 sm:p-6 transition-all duration-300 hover:shadow-xl hover:scale-105 transform">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <DollarSign className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                </div>
                <div className="mr-3 sm:mr-4">
                  <p className="text-xs sm:text-sm font-semibold text-green-700 dark:text-green-300">
                    المبلغ المحصل
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                    {showPaidAmount ? formatCurrency(billStats.totalPaid) : '••••••'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPaidAmount(!showPaidAmount)}
                className="p-2 hover:bg-green-200 dark:hover:bg-green-800 rounded-lg transition-all duration-200 transform hover:scale-110"
                title={showPaidAmount ? 'إخفاء المبلغ' : 'إظهار المبلغ'}
              >
                {showPaidAmount ? (
                  <EyeOff className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <Eye className="h-5 w-5 text-green-600 dark:text-green-400" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-red-100 dark:from-orange-900/30 dark:to-red-800/20 rounded-xl shadow-md border-2 border-orange-200 dark:border-orange-700 p-4 sm:p-6 transition-all duration-300 hover:shadow-xl hover:scale-105 transform">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <DollarSign className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                </div>
                <div className="mr-3 sm:mr-4">
                  <p className="text-xs sm:text-sm font-semibold text-orange-700 dark:text-orange-300">
                    المبلغ المتبقي
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">
                    {showRemainingAmount ? formatCurrency(billStats.totalRemaining) : '••••••'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRemainingAmount(!showRemainingAmount)}
                className="p-2 hover:bg-orange-200 dark:hover:bg-orange-800 rounded-lg transition-all duration-200 transform hover:scale-110"
                title={showRemainingAmount ? 'إخفاء المبلغ' : 'إظهار المبلغ'}
              >
                {showRemainingAmount ? (
                  <EyeOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                ) : (
                  <Eye className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl shadow-md border-2 border-purple-200 dark:border-purple-700 p-4 sm:p-6 transition-all duration-300 hover:shadow-xl hover:scale-105 transform">
            <div className="flex items-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Receipt className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <div className="mr-3 sm:mr-4">
                <p className="text-xs sm:text-sm font-semibold text-purple-700 dark:text-purple-300">
                  فواتير جزئية
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {formatDecimal(billStats.partialBills)}
                </p>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* PlayStation Devices Section */}
      {(billTypeFilter === 'all' || billTypeFilter === 'playstation') && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-lg border-2 border-blue-200 dark:border-blue-700 p-3 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <button
                onClick={() => setIsPlaystationSectionCollapsed(!isPlaystationSectionCollapsed)}
                className="p-1.5 sm:p-2 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-lg transition-all duration-200 transform hover:scale-110 flex-shrink-0"
              >
                {isPlaystationSectionCollapsed ? (
                  <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                )}
              </button>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center truncate">
                <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6 ml-2 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                أجهزة البلايستيشن
              </h2>
            </div>
            {!isPlaystationSectionCollapsed && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                {/* Filter buttons */}
                <div className="flex gap-1 sm:gap-2 order-2 sm:order-1">
                  <button
                    onClick={() => setPlaystationStatusFilter('unpaid')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      playstationStatusFilter === 'unpaid'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    غير مدفوع
                  </button>
                  <button
                    onClick={() => setPlaystationStatusFilter('paid')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      playstationStatusFilter === 'paid'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    مدفوع
                  </button>
                  <button
                    onClick={() => setPlaystationStatusFilter('all')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      playstationStatusFilter === 'all'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    الكل
                  </button>
                </div>
                
                {/* Search input */}
                <div className="relative order-1 sm:order-2">
                  <Search className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="بحث عن جهاز..."
                    value={playstationSearchQuery}
                    onChange={(e) => setPlaystationSearchQuery(e.target.value)}
                    className="pr-8 sm:pr-10 pl-3 sm:pl-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 text-xs sm:text-sm w-full sm:w-auto min-w-0"
                  />
                  {playstationSearchQuery && (
                    <button
                      onClick={() => setPlaystationSearchQuery('')}
                      className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="h-3 w-3 sm:h-4 sm:w-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {!isPlaystationSectionCollapsed && (
            <div className="space-y-3 sm:space-y-4">
              {(() => {
                // تجميع جميع الفواتير التي تحتوي على جلسات بلايستيشن
                const allPlaystationBills = bills.filter((bill: Bill) => 
                  bill.billType === 'playstation' || 
                  (bill.sessions && bill.sessions.some((s: any) => s.deviceType === 'playstation'))
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
                    <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg">
                        <Gamepad2 className="h-8 w-8 sm:h-10 sm:w-10 text-blue-500 dark:text-blue-400" />
                      </div>
                      <p className="text-sm sm:text-base">
                        {playstationSearchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد أجهزة بلايستيشن نشطة'}
                      </p>
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
                    <div key={index} className="border-2 border-blue-200 dark:border-blue-700 rounded-xl p-3 sm:p-5 bg-white dark:bg-gray-800 shadow-md hover:shadow-xl transition-all duration-300">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <button
                            onClick={() => toggleDeviceCollapse(deviceData.deviceName)}
                            className="p-1.5 sm:p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-all duration-200 transform hover:scale-110 flex-shrink-0"
                          >
                            {isDeviceCollapsed ? (
                              <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                            )}
                          </button>
                          <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">{deviceData.deviceName}</h3>
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            {deviceData.hasActiveSession && (
                              <span className="px-2 sm:px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full shadow-md animate-pulse whitespace-nowrap">
                                🎮 جلسة نشطة
                              </span>
                            )}
                            {deviceData.linkedToTable && deviceData.hasActiveSession && (
                              <span className="px-2 sm:px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold rounded-full shadow-md whitespace-nowrap">
                                🪑 طاولة {deviceData.tableNumber}
                              </span>
                            )}
                          </div>
                        </div>
                        {deviceData.bills.length > 0 && (
                          <div className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">
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
                                  onChangeTableClick={handleOpenChangeTableModal}
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



      {/* Tables by Sections */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl shadow-lg border-2 border-orange-200 dark:border-orange-700 p-3 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <TableIcon className="h-5 w-5 sm:h-6 sm:w-6 ml-2 text-orange-600 dark:text-orange-400" />
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
            <div key={section.id} className="mb-4 sm:mb-6 last:mb-0">
              <h3 className="text-base sm:text-lg font-bold text-orange-800 dark:text-orange-200 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b-2 border-orange-300 dark:border-orange-600">
                {section.name}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
                {sectionTables.map((table: Table) => {
                  const tableData = tableBillsMap[table.number];
                  const hasUnpaid = tableData?.hasUnpaid || false;
                  
                  return (
                    <button
                      key={table._id}
                      onClick={() => {
                        setSelectedTable(table);
                        setShowTableBillsModal(true);
                      }}
                      className={`
                        group relative p-3 sm:p-6 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 sm:hover:scale-110 hover:shadow-xl sm:hover:shadow-2xl hover:-translate-y-1
                        ${hasUnpaid 
                          ? 'border-red-400 bg-gradient-to-br from-red-50 via-orange-50 to-red-100 dark:from-red-900/40 dark:via-orange-900/30 dark:to-red-800/30 hover:border-red-500 hover:shadow-red-300 dark:hover:shadow-red-900/70' 
                          : 'border-green-400 bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 dark:from-green-900/40 dark:via-emerald-900/30 dark:to-green-800/30 hover:border-green-500 hover:shadow-green-300 dark:hover:shadow-green-900/70'
                        }
                      `}
                    >
                      {/* Status Badge */}
                      <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2">
                        {hasUnpaid ? (
                          <span className="flex items-center justify-center w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-br from-red-500 to-red-600 text-white text-xs font-bold rounded-full animate-pulse shadow-lg border-2 sm:border-4 border-white dark:border-gray-800">
                            محجوزة
                          </span>
                        ) : (
                          <span className="flex items-center justify-center w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-br from-green-500 to-green-600 text-white text-xs font-bold rounded-full shadow-lg border-2 sm:border-4 border-white dark:border-gray-800">
                            فارغة
                          </span>
                        )}
                      </div>

                      {/* Table Content */}
                      <div className="flex flex-col items-center justify-center pt-1 sm:pt-2">
                        <div className={`
                          w-10 h-10 sm:w-16 sm:h-16 rounded-lg sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-3 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6
                          ${hasUnpaid 
                            ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-lg shadow-red-300 dark:shadow-red-900/50' 
                            : 'bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-300 dark:shadow-green-900/50'
                          }
                        `}>
                          <TableIcon className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
                        </div>
                        <span className={`text-lg sm:text-2xl font-bold transition-colors ${hasUnpaid ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                          {table.number}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          طاولة
                        </span>
                      </div>

                      {/* Hover Effect Overlay */}
                      <div className={`
                        absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
                        ${hasUnpaid 
                          ? 'bg-gradient-to-br from-red-400/10 to-orange-400/10' 
                          : 'bg-gradient-to-br from-green-400/10 to-emerald-400/10'
                        }
                      `} />
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-fade-in"
          onClick={() => {
            setShowTableBillsModal(false);
            setSelectedTable(null);
            setTableBillsFilter('unpaid');
            setSearchQuery('');
          }}
        >
          <div 
            className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col border-2 border-orange-200 dark:border-orange-800 animate-bounce-in mx-2 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-3 sm:p-6 bg-gradient-to-r from-orange-500 to-red-500 dark:from-orange-600 dark:to-red-600 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <TableIcon className="h-5 w-5 sm:h-8 sm:w-8 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 truncate">
                    فواتير الطاولة رقم {selectedTable.number}
                  </h2>
                  <p className="text-xs sm:text-sm text-orange-100 mt-1 flex items-center gap-2">
                    <Receipt className="h-3 w-3 sm:h-4 sm:w-4" />
                    {tableBillsMap[selectedTable.number]?.bills.length || 0} {tableBillsMap[selectedTable.number]?.bills.length === 1 ? 'فاتورة' : 'فواتير'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {/* زر الذهاب إلى إدارة طلبات الطاولة */}
                <button
                  onClick={() => {
                    const tableId = selectedTable._id || selectedTable.id;
                    const tableNumber = selectedTable.number;
                    
                    // إغلاق نافذة فواتير الطاولة
                    setShowTableBillsModal(false);
                    setSelectedTable(null);
                    setTableBillsFilter('unpaid');
                    setSearchQuery('');
                    
                    // الانتقال إلى صفحة الطلبات مع فتح نافذة إدارة طلبات الطاولة
                    navigate('/cafe', {
                      state: {
                        openTableModal: true,
                        tableId,
                        tableNumber
                      }
                    });
                  }}
                  className="hidden sm:flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 text-white hover:scale-105 transform"
                  title={`إدارة طلبات طاولة ${selectedTable.number}`}
                >
                  <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-xs sm:text-sm font-medium">إدارة الطلبات</span>
                </button>
                
                {/* زر الذهاب إلى إدارة طلبات الطاولة - نسخة مبسطة للشاشات الصغيرة */}
                <button
                  onClick={() => {
                    const tableId = selectedTable._id || selectedTable.id;
                    const tableNumber = selectedTable.number;
                    
                    // إغلاق نافذة فواتير الطاولة
                    setShowTableBillsModal(false);
                    setSelectedTable(null);
                    setTableBillsFilter('unpaid');
                    setSearchQuery('');
                    
                    // الانتقال إلى صفحة الطلبات مع فتح نافذة إدارة طلبات الطاولة
                    navigate('/cafe', {
                      state: {
                        openTableModal: true,
                        tableId,
                        tableNumber
                      }
                    });
                  }}
                  className="sm:hidden w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 flex items-center justify-center text-white hover:scale-110 transform"
                  title={`إدارة طلبات طاولة ${selectedTable.number}`}
                >
                  <ShoppingCart className="h-4 w-4" />
                </button>
                
                <button
                  onClick={() => {
                    setShowTableBillsModal(false);
                    setSelectedTable(null);
                    setTableBillsFilter('unpaid');
                    setSearchQuery('');
                  }}
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 flex items-center justify-center text-white hover:scale-110 transform flex-shrink-0"
                >
                  <X className="h-4 w-4 sm:h-6 sm:w-6" />
                </button>
              </div>
            </div>

            {/* Filter and Search */}
            <div className="p-3 sm:p-6 bg-white/50 dark:bg-gray-800/50 border-b border-orange-200 dark:border-orange-800 space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <label className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  فلترة حسب الحالة:
                </label>
                <select
                  value={tableBillsFilter}
                  onChange={(e) => setTableBillsFilter(e.target.value)}
                  className="border-2 border-orange-300 dark:border-orange-700 rounded-xl px-2 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm hover:shadow-md transition-all"
                >
                  <option value="all">🔍 جميع الفواتير</option>
                  <option value="unpaid">💰 غير مدفوع</option>
                  <option value="paid">✅ مدفوع بالكامل</option>
                  <option value="partial">⚡ مدفوع جزئياً</option>
                  <option value="overdue">⚠️ متأخر</option>
                  <option value="cancelled">❌ ملغية</option>
                </select>
              </div>
              {/* Search Section */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                  <input
                    type="text"
                    placeholder="🔎 بحث عن فاتورة برقمها أو معرفها..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10 sm:pr-12 pl-3 sm:pl-4 py-2 sm:py-3 border-2 border-orange-300 dark:border-orange-700 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-sm hover:shadow-md transition-all font-medium text-sm sm:text-base"
                  />
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-200 flex items-center justify-center hover:scale-110 transform shadow-md flex-shrink-0"
                  >
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Bills List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
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
                    <div className="text-center py-12 sm:py-16">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg">
                        <Receipt className="h-10 w-10 sm:h-12 sm:w-12 text-orange-500 dark:text-orange-400" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 sm:mb-3">لا توجد فواتير</h3>
                      <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg px-4">
                        {tableBillsFilter === 'all' ? 'لا توجد فواتير لهذه الطاولة' : `لا توجد فواتير بحالة "${getStatusText(tableBillsFilter)}"`}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 sm:space-y-3">
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
                        onPrintClick={async (bill) => {
                          try {
                            // جلب بيانات الفاتورة الكاملة قبل الطباعة
                            const response = await api.getBill(bill.id || bill._id);
                            if (response.success && response.data) {
                              await printBill(response.data, user?.organizationName);
                            } else {
                              showNotification('فشل في جلب بيانات الفاتورة للطباعة', 'error');
                            }
                          } catch (error) {
                            console.error('Error fetching bill for printing:', error);
                            showNotification('حدث خطأ أثناء جلب بيانات الفاتورة للطباعة', 'error');
                          }
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-blue-200 dark:border-blue-800 animate-bounce-in mx-2 sm:mx-0">
            <div className="sticky top-0 z-10 p-3 sm:p-6 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <DollarSign className="h-5 w-5 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-2xl font-bold text-white truncate">إدارة الدفع</h3>
                  <p className="text-xs sm:text-sm text-blue-100 mt-1 truncate">فاتورة #{selectedBill?.billNumber || selectedBill?.id || selectedBill?._id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {/* زر الذهاب إلى الطاولة - يظهر فقط إذا كانت الفاتورة مرتبطة بطاولة */}
                {selectedBill?.table && (
                  <button
                    onClick={handleGoToTableOrders}
                    className="hidden sm:flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 text-white hover:scale-105 transform"
                    title={`تعديل طلبات طاولة ${selectedBill.table.number}`}
                  >
                    <TableIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-xs sm:text-sm font-medium">تعديل الطلبات</span>
                  </button>
                )}
                <button
                  onClick={handleClosePaymentModal}
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 flex items-center justify-center text-white hover:scale-110 transform flex-shrink-0"
                >
                  <X className="h-4 w-4 sm:h-6 sm:w-6" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
                {/* Payment Section */}
                <div>
                  <h4 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    معلومات الدفع
                  </h4>

                  {/* معلومات الفاتورة */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-5 rounded-xl mb-6 border-2 border-blue-200 dark:border-blue-800 shadow-md">
                    <h5 className="font-bold text-lg text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      معلومات الفاتورة
                    </h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                        <span className="text-gray-600 dark:text-gray-400 text-xs block mb-1">رقم الفاتورة</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">#{selectedBill?.billNumber || selectedBill?.id || selectedBill?._id}</span>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                        <span className="text-gray-600 dark:text-gray-400 text-xs block mb-1">العميل</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{selectedBill && (getCustomerDisplay(selectedBill) as string)}</span>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 p-3 rounded-lg shadow-sm border border-green-200 dark:border-green-800">
                        <span className="text-green-700 dark:text-green-300 text-xs block mb-1">المبلغ الكلي</span>
                        <span className="font-bold text-xl text-green-600 dark:text-green-400">{formatCurrency(selectedBill?.total || 0)}</span>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 p-3 rounded-lg shadow-sm border border-blue-200 dark:border-blue-800">
                        <span className="text-blue-700 dark:text-blue-300 text-xs block mb-1">المدفوع مسبقاً</span>
                        <span className="font-bold text-xl text-blue-600 dark:text-blue-400">{formatCurrency(selectedBill?.paid || 0)}</span>
                      </div>
                      <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30 p-3 rounded-lg shadow-sm border border-red-200 dark:border-red-800">
                        <span className="text-red-700 dark:text-red-300 text-xs block mb-1">المتبقي</span>
                        <span className="font-bold text-xl text-red-600 dark:text-red-400">{formatCurrency(selectedBill?.remaining || 0)}</span>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                        <span className="text-gray-600 dark:text-gray-400 text-xs block mb-1">الحالة</span>
                        <span className={`px-3 py-1.5 text-xs font-bold rounded-full inline-block shadow-sm ${getStatusColor(selectedBill?.status || 'draft')}`}>
                          {getStatusText(selectedBill?.status || 'draft')}
                        </span>
                      </div>
                      {selectedBill?.table && (
                        <div className="col-span-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 p-4 rounded-lg shadow-sm border border-purple-200 dark:border-purple-800">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <TableIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                              <div>
                                <span className="text-purple-700 dark:text-purple-300 text-xs block">الطاولة</span>
                                <span className="font-bold text-lg text-purple-900 dark:text-purple-100">طاولة {selectedBill.table.number}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setNewTableNumber(selectedBill.table?._id || null);
                                setShowChangeTableModal(true);
                              }}
                              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-bold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-md"
                            >
                              تغيير الطاولة
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* تفاصيل الجهاز النشط */}
                  {selectedBill && hasActiveSession(selectedBill) && (
                    <div className="bg-gradient-to-br from-red-50 via-orange-50 to-red-50 dark:from-red-900/40 dark:via-orange-900/30 dark:to-red-900/40 p-5 rounded-xl mb-6 border-2 border-red-300 dark:border-red-700 shadow-lg animate-pulse-slow">
                      <h5 className="font-bold text-lg text-red-900 dark:text-red-100 mb-4 flex items-center gap-3">
                        <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-lg"></div>
                        <Gamepad2 className="h-6 w-6" />
                        الجهاز النشط
                      </h5>
                      <div className="space-y-2 text-sm">
                        {selectedBill.sessions?.filter(s => {
                          // عرض الجلسات النشطة فقط التي تنتمي لنفس الطاولة أو بدون طاولة محددة
                          if (s.status !== 'active') return false;
                          // عرض جميع الجلسات النشطة للفاتورة المحددة
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
                    <div 
                      key={`item-details-${selectedBill._id || selectedBill.id}-${selectedBill.itemPayments?.length || 0}-${selectedBill.paid || 0}`}
                      className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-5 rounded-xl mb-6 border-2 border-purple-200 dark:border-purple-800 shadow-md"
                    >
                      <h5 className="font-bold text-lg text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
                        <Receipt className="h-5 w-5" />
                        تفاصيل الأصناف
                      </h5>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {(() => {
                          // إعادة حساب العناصر مع ضمان البيانات المحدثة
                          const items = aggregateItemsWithPayments(
                            selectedBill?.orders || [], 
                            selectedBill?.itemPayments || [],
                            selectedBill?.status,
                            selectedBill?.paid,
                            selectedBill?.total
                          );
                          
                          // فرض إعادة حساب البيانات إذا كانت فارغة ولكن يجب أن تكون موجودة
                          if (items.length === 0 && selectedBill?.orders?.length > 0) {
                            // إعادة جلب البيانات من الخادم
                            setTimeout(async () => {
                              try {
                                const freshBill = await api.getBill(selectedBill.id || selectedBill._id);
                                if (freshBill.success && freshBill.data) {
                                  setSelectedBill({ ...freshBill.data });
                                }
                              } catch (error) {
                                console.error('Error refreshing bill data:', error);
                              }
                            }, 100);
                          }
                          
                          if (items.length === 0) {
                            return (
                              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                                لا توجد أصناف في هذه الفاتورة
                              </div>
                            );
                          }
                          
                          return items.map((item, index) => (
                            <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-purple-200 dark:border-purple-700 shadow-sm hover:shadow-md transition-all">
                              <div className="flex justify-between items-start mb-3">
                                <span className="font-bold text-gray-900 dark:text-gray-100">{item.name}</span>
                                <span className="text-sm font-semibold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-1 rounded-lg">{formatCurrency(item.price)}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                <div className="text-center p-3 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-lg shadow-sm">
                                  <div className="text-gray-600 dark:text-gray-400 font-semibold mb-1">الكمية الكلية</div>
                                  <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{formatDecimal(item.totalQuantity)}</div>
                                </div>
                                <div className="text-center p-3 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 rounded-lg shadow-sm">
                                  <div className="text-green-700 dark:text-green-300 font-semibold mb-1">المدفوع</div>
                                  <div className="font-bold text-lg text-green-800 dark:text-green-200">{formatDecimal(item.paidQuantity)}</div>
                                </div>
                                <div className="text-center p-3 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/50 dark:to-red-900/50 rounded-lg shadow-sm">
                                  <div className="text-orange-700 dark:text-orange-300 font-semibold mb-1">المتبقي</div>
                                  <div className="font-bold text-lg text-orange-800 dark:text-orange-200">{formatDecimal(item.remainingQuantity)}</div>
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
                                setOriginalAmount(selectedBill.remaining.toString());
                                setDiscountPercentage('');
                                setPaymentMethod('cash');
                                setPaymentReference('');
                              }
                            }}
                            disabled={selectedBill ? hasActiveSession(selectedBill) : false}
                            className={`p-4 border-2 rounded-lg text-center transition-colors duration-200 cursor-pointer ${
                              selectedBill && hasActiveSession(selectedBill)
                                ? 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                : 'border-orange-200 dark:border-orange-600 hover:border-orange-300 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                            }`}
                          >
                            <div className="text-2xl mb-2">💰</div>
                            <div className="font-medium dark:text-gray-100">دفع الفاتورة بالكامل</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              {selectedBill?.remaining ? `دفع ${formatCurrency(selectedBill.remaining)}` : 'دفع المبلغ المتبقي بالكامل'}
                            </div>
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

                          {/* زر دفع جزئي للجلسات */}
                          {selectedBill?.sessions && selectedBill.sessions.length > 0 && (
                            <button
                              onClick={() => {
                                setShowSessionPaymentModal(true);
                              }}
                              className={`p-4 border-2 rounded-lg text-center transition-colors duration-200 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500`}
                            >
                              <div className="text-2xl mb-2">🎮</div>
                              <div className="font-medium dark:text-gray-100">دفع جزئي للجلسات</div>
                              <div className="text-sm text-gray-600 dark:text-gray-300">دفع مبالغ جزئية لجلسات البلايستيشن</div>
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
                              value={(() => {
                                if (!selectedBill || !paymentAmount) return formatCurrency(0);
                                
                                // حساب الإجمالي بعد الخصم
                                let effectiveTotal = selectedBill.total || 0;
                                if (discountPercentage && parseFloat(discountPercentage) > 0) {
                                  const discountAmount = (selectedBill.subtotal || selectedBill.total || 0) * (parseFloat(discountPercentage) / 100);
                                  effectiveTotal = (selectedBill.total || 0) - discountAmount;
                                }
                                
                                // حساب المبلغ المدفوع الجديد
                                const newPaidAmount = (selectedBill.paid || 0) + parseFloat(paymentAmount);
                                
                                // حساب المتبقي بناءً على الإجمالي الفعلي
                                const remaining = Math.max(0, effectiveTotal - newPaidAmount);
                                
                                return formatCurrency(remaining);
                              })()}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              disabled
                            />
                          </div>

                          {/* مؤشر حالة الدفع */}
                          {(() => {
                            if (!selectedBill || !paymentAmount) return null;
                            
                            // حساب الإجمالي بعد الخصم
                            let effectiveTotal = selectedBill.total || 0;
                            if (discountPercentage && parseFloat(discountPercentage) > 0) {
                              const discountAmount = (selectedBill.subtotal || selectedBill.total || 0) * (parseFloat(discountPercentage) / 100);
                              effectiveTotal = (selectedBill.total || 0) - discountAmount;
                            }
                            
                            // حساب المبلغ المدفوع الجديد
                            const newPaidAmount = (selectedBill.paid || 0) + parseFloat(paymentAmount);
                            
                            // حساب المتبقي بناءً على الإجمالي الفعلي
                            const remaining = Math.max(0, effectiveTotal - newPaidAmount);
                            
                            const willBePaidInFull = remaining === 0 || newPaidAmount >= effectiveTotal;
                            
                            return (
                              <div className={`p-3 rounded-lg border ${
                                willBePaidInFull 
                                  ? 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700'
                                  : 'bg-yellow-50 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-700'
                              }`}>
                                <div className="flex items-center">
                                  <span className={`text-lg mr-2 ${
                                    willBePaidInFull 
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-yellow-600 dark:text-yellow-400'
                                  }`}>
                                    {willBePaidInFull ? '✅' : '💰'}
                                  </span>
                                  <div>
                                    <p className={`font-medium ${
                                      willBePaidInFull 
                                        ? 'text-green-800 dark:text-green-200'
                                        : 'text-yellow-800 dark:text-yellow-200'
                                    }`}>
                                      {willBePaidInFull 
                                        ? 'ستصبح الفاتورة مدفوعة بالكامل!'
                                        : 'ستصبح الفاتورة مدفوعة جزئياً'
                                      }
                                    </p>
                                    <p className={`text-sm ${
                                      willBePaidInFull 
                                        ? 'text-green-600 dark:text-green-300'
                                        : 'text-yellow-600 dark:text-yellow-300'
                                    }`}>
                                      {willBePaidInFull 
                                        ? 'المبلغ المتبقي سيكون صفر'
                                        : `المبلغ المتبقي سيكون ${formatCurrency(remaining)}`
                                      }
                                    </p>
                                    {discountPercentage && parseFloat(discountPercentage) > 0 && (
                                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                        تم تطبيق خصم {discountPercentage}% - وفرت {formatCurrency((selectedBill.subtotal || selectedBill.total || 0) * (parseFloat(discountPercentage) / 100))}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
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
                            onClick={() => selectedBill && printBill(selectedBill, user?.organizationName).catch(console.error)}
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

            <div className="p-3 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between gap-3">
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
                  onClick={handleClosePaymentModal}
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

      {/* Partial Payment Modal - New Simplified Version */}
      <PartialPaymentModal
        key={`partial-payment-${selectedBill?._id || selectedBill?.id}-${selectedBill?.itemPayments?.length || 0}-${selectedBill?.paid || 0}`}
        isOpen={showPartialPaymentModal}
        onClose={() => setShowPartialPaymentModal(false)}
        bill={selectedBill}
        onPaymentSubmit={handlePartialPaymentSubmit}
        isProcessing={isProcessingPartialPayment}
      />

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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-3 sm:p-6 mx-2 sm:mx-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">تأكيد إنهاء الجلسة</h3>
              
              {!isLinkedToTable && (
                <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ هذه الجلسة غير مرتبطة بطاولة. يرجى إدخال اسم العميل قبل الإنهاء.
                  </p>
                </div>
              )}
              
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                هل أنت متأكد من إنهاء هذه الجلسة؟ سيتم حساب التكلفة النهائية وإغلاق الجلسة.
              </p>
              
              {!isLinkedToTable && (
                <div className="mb-3 sm:mb-4">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    اسم العميل <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerNameForEndSession}
                    onChange={(e) => setCustomerNameForEndSession(e.target.value)}
                    placeholder="أدخل اسم العميل"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-gray-100 text-sm sm:text-base"
                    disabled={isEndingSession}
                  />
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                onClick={() => {
                  if (!isEndingSession) {
                    setShowSessionEndModal(false);
                    setSessionToEnd(null);
                  }
                }}
                className={`px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200 text-sm sm:text-base order-2 sm:order-1 ${
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
                } text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 min-w-[100px] sm:min-w-[120px] text-sm sm:text-base order-1 sm:order-2`}
                disabled={isEndingSession}
              >
                {isEndingSession ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">جاري إنهاء الجلسة...</span>
                    <span className="sm:hidden">جاري...</span>
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
      {showSessionPaymentModal && selectedBill && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
              <div className="p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                      دفع جزئي للجلسات
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
                      اختر الجلسات وحدد المبلغ المطلوب دفعه لكل جلسة
                    </p>
                  </div>
                  {selectedBill.sessions?.some((s: any) => s.status === 'active') && (
                    <span className="px-2 sm:px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full whitespace-nowrap">
                      🔄 تحديث تلقائي
                    </span>
                  )}
                </div>
              </div>

            <div className="p-3 sm:p-6">
              {/* قائمة الجلسات */}
              <div className="space-y-3 sm:space-y-4">
                {selectedBill.sessions?.map((session: any) => {
                  const sessionId = session._id || session.id;
                  const sessionPayment = selectedBill.sessionPayments?.find(
                    sp => sp.sessionId === sessionId
                  );
                  
                  // تحديد حالة الجلسة أولاً
                  const isActive = session.status === 'active';
                  const isCompleted = session.status === 'completed';
                  
                  // استخدام sessionCost من sessionPayment أو finalCost من session
                  // للجلسات النشطة، نحسب السعر الحالي
                  let totalCost = sessionPayment?.sessionCost || session.finalCost || session.totalCost || 0;
                  
                  // إذا كانت الجلسة نشطة ولم يكن هناك سعر، نحاول حساب السعر الحالي
                  if (isActive && totalCost === 0 && session.startTime) {
                    const startTime = new Date(session.startTime);
                    const now = new Date();
                    const hours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                    
                    // حساب السعر بناءً على نوع الجهاز
                    if (session.deviceType === 'playstation') {
                      const controllers = session.controllers || 1;
                      let hourlyRate = 20; // السعر الافتراضي
                      if (controllers >= 4) hourlyRate = 30;
                      else if (controllers >= 3) hourlyRate = 25;
                      totalCost = Math.round(hours * hourlyRate);
                    } else if (session.deviceType === 'computer') {
                      totalCost = Math.round(hours * 15); // 15 جنيه للساعة
                    }
                  }
                  const paidAmount = sessionPayment?.paidAmount || 0;
                  // حساب المتبقي بشكل صحيح - نستخدم الحساب اليدوي دائماً للجلسات النشطة
                  const remainingAmount = isActive 
                    ? (totalCost - paidAmount) 
                    : (sessionPayment?.remainingAmount !== undefined 
                        ? sessionPayment.remainingAmount 
                        : (totalCost - paidAmount));
                  // الجلسة تعتبر مدفوعة بالكامل فقط إذا كانت مكتملة والمتبقي صفر
                  const isFullyPaid = !isActive && remainingAmount <= 0;
                  
                 
                  
                  return (
                    <div 
                      key={sessionId}
                      className={`border-2 rounded-xl p-3 sm:p-4 transition-all ${
                        isFullyPaid 
                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' 
                          : isActive
                          ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20'
                      }`}
                    >
                      {/* معلومات الجلسة */}
                      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center ${
                            isFullyPaid 
                              ? 'bg-gradient-to-br from-green-500 to-emerald-500' 
                              : isActive
                              ? 'bg-gradient-to-br from-blue-500 to-cyan-500 animate-pulse'
                              : 'bg-gradient-to-br from-orange-500 to-red-500'
                          }`}>
                            <span className="text-lg sm:text-2xl">🎮</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">
                              {session.deviceName}
                            </h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              {session.deviceType === 'playstation' ? 'بلايستيشن' : 'كمبيوتر'}
                              {session.deviceType === 'playstation' && ` - ${session.controllers || 1} دراع`}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          {isFullyPaid && (
                            <span className="px-2 sm:px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                              ✓ مدفوعة
                            </span>
                          )}
                          {isActive && (
                            <span className="px-2 sm:px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full animate-pulse">
                              ⚡ نشطة
                            </span>
                          )}
                        </div>
                      </div>

                      {/* المبالغ */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                        <div className={`text-center p-2 bg-white dark:bg-gray-700 rounded-lg ${isActive ? 'ring-2 ring-blue-400 animate-pulse' : ''}`}>
                          <p className="text-xs text-gray-600 dark:text-gray-400">الإجمالي</p>
                          <p className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">{formatCurrency(totalCost)}</p>
                          {isActive && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">⚡ يتحدث</p>}
                        </div>
                        <div className="text-center p-2 bg-white dark:bg-gray-700 rounded-lg">
                          <p className="text-xs text-gray-600 dark:text-gray-400">المدفوع</p>
                          <p className="font-bold text-sm sm:text-base text-blue-600 dark:text-blue-400">{formatCurrency(paidAmount)}</p>
                        </div>
                        <div className={`text-center p-2 bg-white dark:bg-gray-700 rounded-lg ${isActive ? 'ring-2 ring-orange-400 animate-pulse' : ''}`}>
                          <p className="text-xs text-gray-600 dark:text-gray-400">المتبقي</p>
                          <p className="font-bold text-sm sm:text-base text-red-600 dark:text-red-400">{formatCurrency(remainingAmount)}</p>
                          {isActive && <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">⚡ يتحدث</p>}
                        </div>
                      </div>

                      {/* تنبيه للجلسات النشطة */}
                      {isActive && (
                        <div className="mb-3 p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
                          <p className="text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
                            <span>⚠️</span>
                            <span>الجلسة نشطة - السعر يتغير تلقائياً. يمكنك الدفع جزئياً والمبلغ المتبقي سيتحدث عند انتهاء الجلسة.</span>
                          </p>
                        </div>
                      )}

                      {/* إدخال المبلغ وزر الدفع */}
                      {!isFullyPaid && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="المبلغ"
                              value={selectedSession?._id === sessionId || selectedSession?.id === sessionId ? sessionPaymentAmount : ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d+$/.test(value)) {
                                  setSessionPaymentAmount(value);
                                  setSelectedSession(session);
                                }
                              }}
                              onBlur={(e) => {
                                const value = parseInt(e.target.value);
                                if (!isNaN(value) && value > remainingAmount) {
                                  setSessionPaymentAmount(Math.floor(remainingAmount).toString());
                                  showNotification(`الحد الأقصى للدفع هو ${formatCurrency(remainingAmount)}`, 'warning');
                                }
                              }}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
                            />
                            {/* رسائل التحذير */}
                            {selectedSession?._id === sessionId || selectedSession?.id === sessionId ? (
                              <>
                                {sessionPaymentAmount && parseInt(sessionPaymentAmount) <= 0 && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">⚠️ المبلغ يجب أن يكون أكبر من صفر</p>
                                )}
                                {sessionPaymentAmount && parseInt(sessionPaymentAmount) > remainingAmount && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">⚠️ المبلغ يتجاوز المتبقي ({formatCurrency(remainingAmount)})</p>
                                )}
                                {sessionPaymentAmount && /[^\d]/.test(sessionPaymentAmount) && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">⚠️ يجب إدخال أرقام صحيحة فقط</p>
                                )}
                                {!sessionPaymentAmount && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">الحد الأقصى: {formatCurrency(remainingAmount)}</p>
                                )}
                              </>
                            ) : null}
                          </div>
                          <button
                            onClick={async () => {
                              setSelectedSession(session);
                              await handlePaySessionPartial();
                              setSessionPaymentAmount('');
                            }}
                            disabled={(() => {
                              // التحقق من أن هذه الجلسة هي المحددة
                              const isThisSessionSelected = selectedSession?._id === sessionId || selectedSession?.id === sessionId;
                              
                              // التحقق من وجود مبلغ
                              if (!sessionPaymentAmount || sessionPaymentAmount.trim() === '') return true;
                              
                              const amount = parseInt(sessionPaymentAmount);
                              
                              // التحقق من أن المبلغ رقم صحيح موجب
                              if (isNaN(amount) || amount <= 0) return true;
                              
                              // التحقق من أن المبلغ لا يتجاوز المتبقي (فقط للجلسة المحددة)
                              if (isThisSessionSelected && amount > remainingAmount) return true;
                              
                              
                              return !isThisSessionSelected;
                            })()}
                            className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm sm:text-base whitespace-nowrap"
                          >
                            دفع
                          </button>
                        </div>
                      )}

                      {/* عرض الدفعات السابقة */}
                      {sessionPayment?.payments && sessionPayment.payments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">الدفعات السابقة:</p>
                          <div className="space-y-1">
                            {sessionPayment.payments.map((payment: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-xs bg-white dark:bg-gray-700 p-2 rounded">
                                <span className="text-gray-600 dark:text-gray-400 truncate flex-1 pr-2">
                                  {formatCurrency(payment.amount)} - {payment.method === 'cash' ? 'نقداً' : payment.method === 'card' ? 'بطاقة' : 'تحويل'}
                                </span>
                                <span className="text-gray-500 dark:text-gray-500 text-xs whitespace-nowrap">
                                  {new Date(payment.paidAt).toLocaleString('ar-EG')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>


            </div>

            <div className="p-3 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => {
                  setShowSessionPaymentModal(false);
                  setSelectedSession(null);
                  setSessionPaymentAmount('');
                }}
                className="px-4 sm:px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors text-sm sm:text-base"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Table Modal */}
      {showChangeTableModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-3 sm:p-6 mx-2 sm:mx-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
              تغيير الطاولة
            </h3>
            
            <div className="mb-3 sm:mb-4">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                الفاتورة الحالية: <span className="font-semibold text-gray-900 dark:text-gray-100">#{selectedBill.billNumber}</span>
              </p>
              {(() => {
                const currentTableId = selectedBill.table?._id || selectedBill.table;
                const currentTable = tables.find((t: any) => t._id === currentTableId);
                
                if (currentTable) {
                  return (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-2 sm:p-3 mt-3">
                      <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100">
                        📍 الطاولة الحالية: <span className="font-bold">طاولة {currentTable.number}</span>
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            
            <div className="mb-4 sm:mb-6">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                اختر الطاولة الجديدة
              </label>
              <select
                value={newTableNumber || ''}
                onChange={(e) => setNewTableNumber(e.target.value ? e.target.value : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 text-sm sm:text-base"
                disabled={isChangingTable}
              >
                <option value="">اختر طاولة...</option>
                {tables
                  .filter((t: any) => t.isActive && t._id !== selectedBill.table?._id)
                  .sort((a: any, b: any) => {
                    return String(a.number).localeCompare(String(b.number), 'ar', { numeric: true });
                  })
                  .map((table: any) => (
                    <option key={table._id} value={table._id}>
                      طاولة {table.number}
                    </option>
                  ))}
              </select>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-2 sm:p-3 mb-4 sm:mb-6">
              <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ سيتم نقل جميع الطلبات والجلسات المرتبطة بهذه الفاتورة إلى الطاولة الجديدة.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowChangeTableModal(false);
                  setNewTableNumber(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors text-sm sm:text-base order-2 sm:order-1"
                disabled={isChangingTable}
              >
                إلغاء
              </button>
              <button
                onClick={handleChangeTable}
                className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center min-w-[100px] sm:min-w-[120px] transition-all duration-200 text-sm sm:text-base order-1 sm:order-2 ${
                  isChangingTable || !newTableNumber
                    ? 'bg-blue-400 dark:bg-blue-700 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                } text-white`}
                disabled={isChangingTable || !newTableNumber}
              >
                {isChangingTable ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">جاري التغيير...</span>
                    <span className="sm:hidden">جاري...</span>
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
