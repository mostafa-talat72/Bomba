import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ShoppingCart, Plus, Edit, Trash2, X, PlusCircle, MinusCircle, Printer, Settings, AlertTriangle, Search, CheckCircle, DollarSign } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MenuItem, MenuSection, MenuCategory, TableSection, Table, Order } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { printOrder } from '../utils/printOrder';
import api from '../services/api';
import { io, Socket } from 'socket.io-client';

// دالة تحويل الأرقام الإنجليزية إلى العربية
const convertToArabicNumbers = (str: string | number): string => {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.toString().replace(/[0-9]/g, (match) => arabicNumbers[parseInt(match)]);
};

// دالة تنسيق العملة بالأرقام العربية
const formatCurrencyArabic = (amount: number): string => {
  const formatted = formatCurrency(amount);
  return convertToArabicNumbers(formatted);
};

interface LocalOrderItem {
  menuItem: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

// Memoized Table Button Component
interface TableButtonProps {
  table: Table;
  isSelected: boolean;
  isOccupied: boolean;
  onClick: (table: Table) => void;
}

const TableButton = React.memo<TableButtonProps>(({ table, isSelected, isOccupied, onClick }) => {
  return (
    <button
      onClick={() => onClick(table)}
      className={`
        group relative p-3 sm:p-6 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 sm:hover:scale-110 hover:shadow-xl sm:hover:shadow-2xl hover:-translate-y-1
        ${isSelected 
          ? 'border-orange-400 bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 dark:from-orange-900/40 dark:via-yellow-900/30 dark:to-orange-800/30 shadow-lg sm:shadow-xl ring-2 sm:ring-4 ring-orange-300 dark:ring-orange-700' 
          : isOccupied
          ? 'border-red-400 bg-gradient-to-br from-red-50 via-orange-50 to-red-100 dark:from-red-900/40 dark:via-orange-900/30 dark:to-red-800/30 hover:border-red-500 hover:shadow-red-300 dark:hover:shadow-red-900/70'
          : 'border-green-400 bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 dark:from-green-900/40 dark:via-emerald-900/30 dark:to-green-800/30 hover:border-green-500 hover:shadow-green-300 dark:hover:shadow-green-900/70'
        }
      `}
    >
      {/* Status Badge */}
      <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2">
        {isSelected ? (
          <span className="flex items-center justify-center w-12 h-6 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-500 to-orange-600 text-white text-xs font-bold rounded-full shadow-lg border-2 sm:border-4 border-white dark:border-gray-800">
            مختارة
          </span>
        ) : isOccupied ? (
          <span className="flex items-center justify-center w-12 h-6 sm:w-16 sm:h-16 bg-gradient-to-br from-red-500 to-red-600 text-white text-xs font-bold rounded-full animate-pulse shadow-lg border-2 sm:border-4 border-white dark:border-gray-800">
            محجوزة
          </span>
        ) : (
          <span className="flex items-center justify-center w-12 h-6 sm:w-16 sm:h-16 bg-gradient-to-br from-green-500 to-green-600 text-white text-xs font-bold rounded-full shadow-lg border-2 sm:border-4 border-white dark:border-gray-800">
            فارغة
          </span>
        )}
      </div>

      {/* Table Content */}
      <div className="flex flex-col items-center justify-center pt-1 sm:pt-2">
        <div className={`
          w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-3 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6
          ${isSelected
            ? 'bg-gradient-to-br from-orange-400 to-orange-600 shadow-md sm:shadow-lg shadow-orange-300 dark:shadow-orange-900/50'
            : isOccupied 
            ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-md sm:shadow-lg shadow-red-300 dark:shadow-red-900/50' 
            : 'bg-gradient-to-br from-green-400 to-green-600 shadow-md sm:shadow-lg shadow-green-300 dark:shadow-green-900/50'
          }
        `}>
          <svg className="h-5 w-5 sm:h-8 sm:w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <span className={`text-lg sm:text-2xl font-bold transition-colors ${
          isSelected 
            ? 'text-orange-700 dark:text-orange-300' 
            : isOccupied
            ? 'text-red-700 dark:text-red-300'
            : 'text-green-700 dark:text-green-300'
        }`}>
          {table.number}
        </span>
        <span className="text-xs text-gray-600 dark:text-gray-400 mt-1 hidden sm:block">
          طاولة
        </span>
      </div>

      {/* Hover Effect Overlay */}
      <div className={`
        absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
        ${isSelected
          ? 'bg-gradient-to-br from-orange-400/10 to-yellow-400/10'
          : isOccupied 
          ? 'bg-gradient-to-br from-red-400/10 to-orange-400/10' 
          : 'bg-gradient-to-br from-green-400/10 to-emerald-400/10'
        }
      `} />
    </button>
  );
});

TableButton.displayName = 'TableButton';

// Memoized Order Item Component
interface OrderItemProps {
  order: Order;
  onPrint: (order: Order) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
}

const OrderItem = React.memo<OrderItemProps>(({ order, onPrint, onEdit, onDelete }) => {
  // Calculate total from items if finalAmount is not available
  const calculateTotal = () => {
    if (order.finalAmount) return order.finalAmount;
    if (order.totalAmount) return order.totalAmount;
    
    // Calculate from items
    if (order.items && Array.isArray(order.items)) {
      return order.items.reduce((sum: number, item: any) => {
        const itemTotal = (item.price || 0) * (item.quantity || 0);
        return sum + itemTotal;
      }, 0);
    }
    
    return 0;
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {order.orderNumber}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {formatCurrencyArabic(calculateTotal())}
          </div>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse">
          <button
            onClick={() => onPrint(order)}
            className="text-blue-600 hover:text-blue-700 p-1"
            title="طباعة"
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            onClick={() => onEdit(order)}
            className="text-orange-600 hover:text-orange-700 p-1"
            title="تعديل"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(order);
            }}
            className="text-red-600 hover:text-red-700 p-1"
            title="حذف"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {order.items?.length || 0} عنصر
      </div>
    </div>
  );
});

OrderItem.displayName = 'OrderItem';

const Cafe: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    tableSections,
    tables,
    fetchTableSections,
    fetchTables,
    menuItems,
    menuSections,
    menuCategories,
    fetchAvailableMenuItems,
    fetchMenuSections,
    fetchMenuCategories,
    showNotification,
    createOrder,
    updateOrder,
    deleteOrder,
    getTableStatus: getTableStatusFromContext,
    createTableSection,
    updateTableSection,
    deleteTableSection,
    createTable,
    updateTable,
    deleteTable,
    bills,
    fetchBills,
    orders,
    fetchOrders,
    user,
  } = useApp();

  // States
  const [loading, setLoading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false); // State منفصل لحفظ الطلبات
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableOrders, setTableOrders] = useState<Order[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentOrderItems, setCurrentOrderItems] = useState<LocalOrderItem[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({}); // Sections are collapsed by default
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [orderNotes, setOrderNotes] = useState('');
  const [tableStatuses, setTableStatuses] = useState<Record<string | number, { hasUnpaid: boolean; orders: Order[] }>>({});
  
  // Management states
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingSection, setEditingSection] = useState<TableSection | null>(null);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [sectionFormData, setSectionFormData] = useState({ name: '', description: '', sortOrder: 0 });
  const [tableFormData, setTableFormData] = useState({ number: '', section: '' });
  
  // Confirm modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showTableOrdersModal, setShowTableOrdersModal] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: string;
  } | null>(null);

  // Track if we've loaded data for this page visit
  const hasLoadedDataRef = React.useRef(false);
  
  // Socket.IO reference
  const socketRef = useRef<Socket | null>(null);
  
  // Refs to track latest values without causing re-renders
  const selectedTableRef = useRef(selectedTable);
  const tablesRef = useRef(tables);
  
  // Update refs when values change
  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);
  
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  // Hide scroll buttons when any modal is open
  useEffect(() => {
    const hasAnyModalOpen = showOrderModal || showEditOrderModal || showManagementModal || 
                           showSectionModal || showTableModal || showConfirmModal || 
                           showTableOrdersModal;
    
    // Add/remove class to hide scroll buttons
    if (hasAnyModalOpen) {
      document.body.classList.add('hide-scroll-buttons');
    } else {
      document.body.classList.remove('hide-scroll-buttons');
    }
    
    return () => {
      document.body.classList.remove('hide-scroll-buttons');
    };
  }, [showOrderModal, showEditOrderModal, showManagementModal, showSectionModal, 
      showTableModal, showConfirmModal, showTableOrdersModal]);

  // Handle navigation from Billing page to open table modal
  useEffect(() => {
    const state = location.state as any;
   
    if (state?.openTableModal && state?.tableId && tables.length > 0) {
     
      // Find the table by ID
      const targetTable = tables.find((table: Table) => 
        (table._id === state.tableId || table.id === state.tableId)
      );
      
      
      if (targetTable) {
        // Add a small delay to ensure UI is ready
        setTimeout(() => {
          // Open table modal for this table
          handleTableClick(targetTable);
          
          // Show notification about which table we're opening
          if (state.tableNumber) {
            showNotification(`تم فتح طاولة ${state.tableNumber}`, 'info');
          }
        }, 100);
        
        // Clear the state immediately to prevent reopening
        navigate(location.pathname, { replace: true, state: {} });
      } else {
        showNotification('لم يتم العثور على الطاولة المطلوبة', 'error');
        // Clear the state even if table not found
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [tables, location.state, navigate, location.pathname]);

  // Load data on mount - only once per page visit
  useEffect(() => {
    if (!hasLoadedDataRef.current) {
      hasLoadedDataRef.current = true;
      loadInitialData();
    }
    
    // Reset flag when component unmounts
    return () => {
      hasLoadedDataRef.current = false;
    };
  }, []);

  // Socket.IO connection - initialize once on mount
  useEffect(() => {
    // Prevent duplicate connections in React Strict Mode
    if (socketRef.current) {
      return;
    }

    // Initialize Socket.IO connection
    // Remove /api suffix from VITE_API_URL for Socket.IO connection
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socketUrl = apiUrl.replace(/\/api\/?$/, '');
    
    const socket = io(socketUrl, {
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
      // Socket connected
    });

    socket.on('disconnect', (reason) => {
      showNotification?.('انقطع الاتصال - جاري إعادة الاتصال...', 'warning');
    });

    socket.on('reconnect', async (attemptNumber) => {
      showNotification?.('تم إعادة الاتصال', 'success');
      // Refresh data to sync state
      await fetchBills();
      fetchAllTableStatuses();
    });

    socket.on('reconnect_error', (error) => {
      console.error('Socket.IO reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('Socket.IO reconnection failed');
      showNotification?.('فشل إعادة الاتصال. يرجى تحديث الصفحة.', 'error');
    });

    socket.on('connect_error', (error: any) => {
      console.error('Socket.IO connection error:', error);
      console.error('Error details:', {
        message: error.message,
        description: error.description,
        context: error.context,
        type: error.type
      });
    });

    socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });

    // Listen for order-created event
    socket.on('order-update', (data: any) => {
      if (data.type === 'created' && data.order) {
        // Update table statuses when a new order is created
        fetchAllTableStatuses();
        
        // If the order is for the currently selected table, refresh its orders
        const currentTable = selectedTableRef.current;
        if (currentTable && data.order.table?._id === currentTable._id) {
          handleTableClick(currentTable);
        }
      } else if (data.type === 'updated' && data.order) {
        // Refresh table statuses on order update
        fetchAllTableStatuses();
        
        // If the order is for the currently selected table, refresh its orders
        const currentTable = selectedTableRef.current;
        if (currentTable && data.order.table?._id === currentTable._id) {
          handleTableClick(currentTable);
        }
      } else if (data.type === 'deleted') {
        // Refresh table statuses on order deletion
        fetchAllTableStatuses();
        
        // Refresh currently selected table's orders
        const currentTable = selectedTableRef.current;
        if (currentTable) {
          handleTableClick(currentTable);
        }
      }
    });

    // Listen for bill-updated event
    socket.on('bill-update', async (data: any) => {
      if (data.type === 'payment-received' || data.type === 'created' || data.type === 'deleted') {
        // Refresh table statuses when bill is updated
        await fetchBills();
        fetchAllTableStatuses();
        
        // If a table is selected, refresh its orders
        const currentTable = selectedTableRef.current;
        if (currentTable) {
          handleTableClick(currentTable);
        }
      }
    });

    // Listen for table-status-update event
    socket.on('table-status-update', (data: { tableId: string; status: string }) => {
      // Find the table by ID and update its status in the UI immediately
      const currentTables = tablesRef.current;
      const table = currentTables.find(t => t._id === data.tableId || t.id === data.tableId);
      if (table) {
        // Update table statuses immediately
        setTableStatuses(prev => ({
          ...prev,
          [table.number]: {
            ...prev[table.number],
            hasUnpaid: data.status === 'occupied'
          }
        }));
      }
    });

    // Cleanup on unmount
    return () => {
      // Don't disconnect in development due to Strict Mode
      if (import.meta.env.DEV) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('reconnect');
        socket.off('reconnect_error');
        socket.off('reconnect_failed');
        socket.off('connect_error');
        socket.off('error');
        socket.off('order-update');
        socket.off('bill-update');
        socket.off('table-status-update');
      } else {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('reconnect');
        socket.off('reconnect_error');
        socket.off('reconnect_failed');
        socket.off('connect_error');
        socket.off('error');
        socket.off('order-update');
        socket.off('bill-update');
        socket.off('table-status-update');
        socket.disconnect();
      }
    };
  }, []); // Empty dependency array - only run once on mount

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // تحميل البيانات الأساسية أولاً (الأهم)
      await Promise.all([
        fetchTableSections(),
        fetchTables(),
        fetchBills(), // Load bills first to show table statuses correctly
        fetchAvailableMenuItems(),
        fetchMenuSections(),
        fetchMenuCategories(),
      ]);
      
      // إخفاء شاشة التحميل فوراً
      setLoading(false);
      
      // تحميل الطلبات في الخلفية (غير متزامن)
      fetchOrders().catch(error => {
        // Ignore errors in background loading
      });
    } catch (error) {
      showNotification('خطأ في تحميل البيانات', 'error');
      setLoading(false);
    }
  };

  // Fetch table statuses when tables or bills change - INSTANT!
  const fetchAllTableStatuses = useCallback(() => {
    const statuses: Record<number, { hasUnpaid: boolean; orders: Order[] }> = {};
    
    // Use bills from state (already loaded) - filter unpaid bills
    const unpaidBills = bills.filter((bill: any) => 
      bill.status !== 'paid' && bill.status !== 'cancelled'
    );
    
    // Create a map of table ID to bills for fast lookup
    const tableBillsMap = new Map<string, any[]>();
    unpaidBills.forEach((bill: any) => {
      if (bill.table) {
        const tableId = (bill.table._id || bill.table.id || bill.table).toString();
        if (!tableBillsMap.has(tableId)) {
          tableBillsMap.set(tableId, []);
        }
        tableBillsMap.get(tableId)!.push(bill);
      }
    });
    
    // Process each table - INSTANT!
    for (const table of tables) {
      const tableId = (table._id || table.id).toString();
      const tableBills = tableBillsMap.get(tableId) || [];
      
      // Table has unpaid bills if there are any bills in the map
      const hasUnpaid = tableBills.length > 0;
      
      statuses[table.number] = {
        hasUnpaid,
        orders: [], // We'll fetch orders only when clicking on the table
      };
    }
    
    setTableStatuses(statuses);
  }, [bills, tables]);

  useEffect(() => {
    if (tables.length > 0 && bills.length >= 0) {
      fetchAllTableStatuses();
    }
  }, [tables, bills, fetchAllTableStatuses]); // Update when tables or bills change

  // Memoize active table sections
  const activeTableSections = useMemo(() => {
    return tableSections
      .filter(section => section.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [tableSections]);

  // Memoize active tables
  const activeTables = useMemo(() => {
    return tables.filter(t => t.isActive);
  }, [tables]);

  // Memoize table statistics
  const tableStats = useMemo(() => {
    const emptyTables = activeTables.filter(t => {
      const status = tableStatuses[t.number];
      return !status?.hasUnpaid;
    }).length;

    const occupiedTables = activeTables.filter(t => {
      const status = tableStatuses[t.number];
      return status?.hasUnpaid;
    }).length;

    return {
      totalSections: activeTableSections.length,
      totalTables: activeTables.length,
      emptyTables,
      occupiedTables,
    };
  }, [activeTables, activeTableSections, tableStatuses]);

  // Get tables by section (memoized)
  const getTablesBySection = useMemo(() => {
    const tablesBySection: Record<string, Table[]> = {};
    
    activeTables.forEach(table => {
      const section = typeof table.section === 'string' ? table.section : (table.section as TableSection)?._id || (table.section as TableSection)?.id;
      if (section) {
        if (!tablesBySection[section]) {
          tablesBySection[section] = [];
        }
        tablesBySection[section].push(table);
      }
    });
    
    // Sort tables by number within each section
    Object.keys(tablesBySection).forEach(sectionId => {
      tablesBySection[sectionId].sort((a, b) => {
        // Convert to numbers for comparison, fallback to string comparison
        const aNum = typeof a.number === 'number' ? a.number : parseInt(String(a.number));
        const bNum = typeof b.number === 'number' ? b.number : parseInt(String(b.number));
        
        // If both are valid numbers, sort numerically
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        
        // Otherwise, sort alphabetically
        return String(a.number).localeCompare(String(b.number));
      });
    });
    
    return tablesBySection;
  }, [activeTables]);

  // Helper function for ManagementModal
  const getTablesBySectionFn = (sectionId: string): Table[] => {
    return getTablesBySection[sectionId] || [];
  };

  // Memoize filtered table orders (only unpaid)
  const filteredTableOrders = useMemo(() => {
    return tableOrders.filter((order: Order) => {
      // If order has no bill, show it
      if (!order.bill) return true;
      
      // If bill is populated, check status
      if (typeof order.bill === 'object' && order.bill !== null) {
        const bill = order.bill as any;
        return bill.status !== 'paid';
      }
      
      // If bill is just an ID, assume it's not paid
      return true;
    });
  }, [tableOrders]);

  // Update table orders when selected table or orders change
  useEffect(() => {
    if (selectedTable) {
      const tableId = selectedTable._id || selectedTable.id;
      
      // Filter orders that belong to this table - INSTANT!
      const filteredOrders = orders.filter((order: any) => {
        const orderTableId = order.table?._id || order.table?.id || order.table;
        return orderTableId === tableId;
      });
      
      setTableOrders(filteredOrders);
    }
  }, [selectedTable, orders]);

  // Handle table click
  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
    setShowTableOrdersModal(true);
    // Orders will be updated automatically by useEffect above
  };

  // Handle payment management - navigate to billing page
  const handlePaymentManagement = (table: Table) => {
    // Find unpaid bill for this table
    const tableId = table._id || table.id;
    const unpaidBill = bills.find((bill: any) => {
      const billTableId = bill.table?._id || bill.table?.id || bill.table;
      return billTableId === tableId && bill.status !== 'paid' && bill.status !== 'cancelled';
    });

    if (unpaidBill) {
      // Close current modal
      setShowTableOrdersModal(false);
      setSelectedTable(null);
      
      // Navigate to billing page with bill ID as state
      navigate('/billing', { 
        state: { 
          openPaymentModal: true, 
          billId: unpaidBill._id || unpaidBill.id,
          tableNumber: table.number 
        } 
      });
    } else {
      showNotification('لا توجد فاتورة غير مدفوعة لهذه الطاولة', 'warning');
    }
  };

  // Handle add order
  const handleAddOrder = () => {
    if (!selectedTable) {
      showNotification('يرجى اختيار طاولة أولاً', 'error');
      return;
    }
    // إعادة تعيين كل شيء كأنها المرة الأولى
    setCurrentOrderItems([]);
    setOrderNotes('');
    setExpandedSections({});
    setExpandedCategories({});
    setShowOrderModal(true);
  };

  // Handle edit order
  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order);
    // Check if order.items exists and is an array
    if (!order.items || !Array.isArray(order.items)) {
      showNotification('خطأ: الطلب لا يحتوي على عناصر', 'error');
      return;
    }
    const items: LocalOrderItem[] = order.items.map(item => ({
      menuItem: (item as any).menuItem?._id || (item as any).menuItem || '',
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      notes: item.notes || '',
    }));
    setCurrentOrderItems(items);
    setOrderNotes(order.notes || '');
    // إعادة تعيين الأقسام والفئات المفتوحة
    setExpandedSections({});
    setExpandedCategories({});
    setShowEditOrderModal(true);
  };

  // Toggle section expand
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Toggle category expand
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  // Get categories for section
  const getCategoriesForSection = (sectionId: string) => {
    return menuCategories.filter(cat => {
      const section = typeof cat.section === 'string' ? cat.section : (cat.section as MenuSection)?._id || (cat.section as MenuSection)?.id;
      return section === sectionId && cat.isActive;
    }).sort((a, b) => a.sortOrder - b.sortOrder);
  };

  // Get items for category
  const getItemsForCategory = (categoryId: string) => {
    return menuItems.filter(item => {
      const category = typeof item.category === 'string' ? item.category : (item.category as MenuCategory)?._id || (item.category as MenuCategory)?.id;
      return category === categoryId && item.isAvailable;
    });
  };

  // Add item to order
  const addItemToOrder = (menuItem: MenuItem) => {
    const existingItem = currentOrderItems.find(item => item.menuItem === menuItem.id);
    if (existingItem) {
      setCurrentOrderItems(prev =>
        prev.map(item =>
          item.menuItem === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCurrentOrderItems(prev => [
        ...prev,
        {
          menuItem: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
          notes: '',
        },
      ]);
    }
  };

  // Update item quantity
  const updateItemQuantity = useCallback((menuItemId: string, delta: number) => {
    setCurrentOrderItems(prev =>
      prev.map(item => {
        if (item.menuItem === menuItemId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity <= 0) {
            return null;
          }
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean) as LocalOrderItem[]
    );
  }, []);

  // Update item notes
  const updateItemNotes = useCallback((menuItemId: string, notes: string) => {
    setCurrentOrderItems(prev =>
      prev.map(item =>
        item.menuItem === menuItemId ? { ...item, notes } : item
      )
    );
  }, []);

  // Remove item from order
  const removeItemFromOrder = useCallback((menuItemId: string) => {
    setCurrentOrderItems(prev => prev.filter(item => item.menuItem !== menuItemId));
  }, []);

  // Calculate order total
  const calculateOrderTotal = () => {
    return currentOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  // Save order
  const handleSaveOrder = async (shouldPrint: boolean = false) => {
    if (!selectedTable || currentOrderItems.length === 0) {
      showNotification('يرجى إضافة عنصر واحد على الأقل', 'error');
      return;
    }

    // Store previous state for rollback on error
    const previousTableStatuses = { ...tableStatuses };

    try {
      const orderData = {
        table: selectedTable._id,
        customerName: selectedTable.number.toString(),
        items: currentOrderItems.map(item => ({
          menuItem: item.menuItem,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          notes: item.notes || null,
        })),
        notes: orderNotes || null,
      };

      // Close modal immediately for better UX
      setShowOrderModal(false);
      setSelectedTable(null);
      setCurrentOrderItems([]);
      setOrderNotes('');
      showNotification('جاري حفظ الطلب...', 'info');
      
      // Create order in background
      setSavingOrder(true);
      const order = await createOrder(orderData);
      
      if (order) {
        showNotification('تم إضافة الطلب بنجاح', 'success');
        
        // Print order if requested or by default
        if (shouldPrint) {
          setTimeout(async () => {
            const menuItemsMap = new Map();
            menuItems.forEach(item => {
              menuItemsMap.set(item.id, item);
              menuItemsMap.set(item._id, item);
              menuItemsMap.set(String(item.id), item);
              menuItemsMap.set(String(item._id), item);
            });
            
            // Create a compatible order object for printing
            const printableOrder = {
              ...order,
              items: order.items?.map((item: any, index: number) => ({
                ...item,
                _id: item._id || item.id || `temp-${index}`, // Add _id if missing
              })) || [],
              createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
              updatedAt: (order as any).updatedAt instanceof Date ? (order as any).updatedAt.toISOString() : (order as any).updatedAt,
            };
            
            const establishmentName = user?.organizationName || (order.organization as any)?.name || 'اسم المنشأة';
            await printOrder(printableOrder, menuSections, menuItemsMap, establishmentName);
          }, 0);
        }
        
        // Update table status immediately (optimistic update)
        if (selectedTable) {
          setTableStatuses(prev => ({
            ...prev,
            [selectedTable.number]: {
              hasUnpaid: true,
              orders: [...(prev[selectedTable.number]?.orders || []), order]
            }
          }));
          
          // Add order to table orders immediately
          setTableOrders(prev => [...prev, order]);
        }
        
        // Refresh data in background (non-blocking) - لا ننتظرها
        setTimeout(() => {
          fetchOrders();
          fetchBills();
        }, 100);
      } else {
        // If order creation failed, revert optimistic updates
        setTableStatuses(previousTableStatuses);
        showNotification('فشل في إضافة الطلب', 'error');
      }
    } catch (error: any) {
      // Revert optimistic updates on error
      setTableStatuses(previousTableStatuses);
      
      // Handle different error types
      if (error?.message) {
        showNotification(error.message, 'error');
      } else if (error?.response?.data?.message) {
        showNotification(error.response.data.message, 'error');
      } else if (!navigator.onLine) {
        showNotification('لا يوجد اتصال بالإنترنت', 'error');
      } else {
        showNotification('خطأ في إضافة الطلب', 'error');
      }
    } finally {
      setSavingOrder(false);
    }
  };

  // Update order
  const handleUpdateOrder = async (shouldPrint: boolean = false) => {
    if (!selectedOrder || currentOrderItems.length === 0) {
      showNotification('يرجى إضافة عنصر واحد على الأقل', 'error');
      return;
    }

    
    // التحقق من وجود دفعات جزئية وتحليل التغييرات
    const orderId = selectedOrder._id || selectedOrder.id;
    
    const orderBill = bills.find((bill: any) => {
      return bill.orders?.some((o: any) => {
        const billOrderId = o._id || o.id || o;
        return billOrderId === orderId;
      });
    });


    let hasPartialPayments = false;
    let warningMessage = '';
    let affectedItems: any[] = [];
    
    if (orderBill && orderBill.itemPayments) {
      
      // البحث عن دفعات جزئية لهذا الطلب
      const orderItemPayments = orderBill.itemPayments.filter((ip: any) => {
        const matches = ip.orderId === orderId && ip.paidAmount > 0;
        return matches;
      });
      
      
      if (orderItemPayments.length > 0) {
        
        // تحليل التغييرات
        const originalItems = selectedOrder.items || [];
        
        orderItemPayments.forEach((payment: any) => {
          
          // استخراج الـ index من itemId (format: orderId-index)
          const itemIdParts = payment.itemId.split('-');
          const itemIndex = itemIdParts.length > 1 ? parseInt(itemIdParts[itemIdParts.length - 1]) : -1;
          
          
          // البحث عن الصنف في الطلب الأصلي باستخدام الـ index
          const originalItem = itemIndex >= 0 && itemIndex < originalItems.length 
            ? originalItems[itemIndex] 
            : originalItems.find((item: any) => {
                const itemId = item._id || item.id;
                return itemId === payment.itemId;
              });
          
          
          // البحث عن الصنف في الطلب الجديد
          const newItem = currentOrderItems.find(item => {
            // مقارنة بالاسم والسعر
            const matches = item.name === payment.itemName && item.price === payment.pricePerUnit;
            return matches;
          });
          
          if (!newItem) {
            // الصنف تم حذفه
            hasPartialPayments = true;
            affectedItems.push({
              type: 'deleted',
              name: payment.itemName,
              paidQuantity: payment.paidQuantity,
              paidAmount: payment.paidAmount,
              originalQuantity: payment.quantity
            });
          } else if (originalItem && newItem.quantity < originalItem.quantity) {
            // الكمية تم تقليلها
            if (payment.paidQuantity > newItem.quantity) {
              hasPartialPayments = true;
              affectedItems.push({
                type: 'reduced',
                name: payment.itemName,
                paidQuantity: payment.paidQuantity,
                paidAmount: payment.paidAmount,
                originalQuantity: originalItem.quantity,
                newQuantity: newItem.quantity,
                refundAmount: (payment.paidQuantity - newItem.quantity) * payment.pricePerUnit
              });
            }
          } else if (originalItem && newItem.quantity === originalItem.quantity && payment.paidQuantity > 0) {
            // الكمية لم تتغير لكن هناك دفعة جزئية
          }
        });
        
  
        if (hasPartialPayments) {
          const deletedItems = affectedItems.filter(i => i.type === 'deleted');
          const reducedItems = affectedItems.filter(i => i.type === 'reduced');
          
          let details = '';
          
          if (deletedItems.length > 0) {
            details += '\n\n🗑️ أصناف محذوفة مدفوعة:\n';
            deletedItems.forEach(item => {
              details += `• ${item.name}: ${convertToArabicNumbers(item.paidQuantity)} من ${convertToArabicNumbers(item.originalQuantity)} (${formatCurrencyArabic(item.paidAmount)})\n`;
            });
          }
          
          if (reducedItems.length > 0) {
            details += '\n\n📉 أصناف مقللة مدفوعة جزئياً:\n';
            reducedItems.forEach(item => {
              details += `• ${item.name}: من ${convertToArabicNumbers(item.originalQuantity)} إلى ${convertToArabicNumbers(item.newQuantity)}\n`;
              details += `  المدفوع: ${convertToArabicNumbers(item.paidQuantity)} (${formatCurrencyArabic(item.paidAmount)})\n`;
              details += `  سيتم استرداد: ${formatCurrencyArabic(item.refundAmount)}\n`;
            });
          }
          
          const totalRefund = affectedItems.reduce((sum, item) => 
            sum + (item.refundAmount || item.paidAmount), 0
          );
          
          warningMessage = `⚠️ تحذير: هذا الطلب يحتوي على تغييرات تؤثر على الدفعات الجزئية:${details}\n\n💰 إجمالي المبلغ المسترد: ${formatCurrencyArabic(totalRefund)}\n\n✓ سيتم إعادة توزيع المبلغ تلقائياً على أصناف مشابهة في الفاتورة (إن وجدت)`;
        }
      } else {
      }
    } else {
    }

    // إذا كانت هناك دفعات جزئية، اعرض تأكيد
    if (hasPartialPayments) {
      showConfirm(
        'تحديث طلب يحتوي على دفعات جزئية',
        `هل أنت متأكد من تحديث الطلب ${selectedOrder.orderNumber}؟\n\n${warningMessage}`,
        async () => {
          setConfirmLoading(true);
          await executeUpdateOrder(shouldPrint);
          setConfirmLoading(false);
          setShowConfirmModal(false);
        },
        'تأكيد التحديث',
        'إلغاء',
        'bg-orange-600 hover:bg-orange-700'
      );
    } else {
      // لا توجد دفعات جزئية، نفذ التحديث مباشرة
      await executeUpdateOrder(shouldPrint);
    }
  };

  // دالة منفصلة لتنفيذ التحديث
  const executeUpdateOrder = async (shouldPrint: boolean = false) => {
    if (!selectedOrder || currentOrderItems.length === 0) {
      return;
    }

    // Store previous state for rollback on error
    const previousTableStatuses = { ...tableStatuses };

    try {
      const orderData = {
        items: currentOrderItems.map(item => ({
          menuItem: item.menuItem,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          notes: item.notes || null,
        })),
        notes: orderNotes || null,
      };

      // Close modal immediately for better UX
      setShowEditOrderModal(false);
      setSelectedTable(null);
      const orderToUpdate = selectedOrder;
      setSelectedOrder(null);
      setCurrentOrderItems([]);
      setOrderNotes('');
      showNotification('جاري تحديث الطلب...', 'info');
      
      // Update order in background
      setSavingOrder(true);
      const updatedOrder = await updateOrder(orderToUpdate.id, orderData);
      
      if (updatedOrder) {
        showNotification('تم تحديث الطلب بنجاح', 'success');
        
        // Print updated order if requested
        if (shouldPrint) {
          setTimeout(async () => {
            const menuItemsMap = new Map();
            menuItems.forEach(item => {
              menuItemsMap.set(item.id, item);
              menuItemsMap.set(item._id, item);
              menuItemsMap.set(String(item.id), item);
              menuItemsMap.set(String(item._id), item);
            });
            
            // Create a compatible order object for printing
            const printableOrder = {
              ...updatedOrder,
              items: updatedOrder.items?.map((item: any, index: number) => ({
                ...item,
                _id: item._id || item.id || `temp-${index}`, // Add _id if missing
              })) || [],
              createdAt: updatedOrder.createdAt instanceof Date ? updatedOrder.createdAt.toISOString() : updatedOrder.createdAt,
              updatedAt: (updatedOrder as any).updatedAt instanceof Date ? (updatedOrder as any).updatedAt.toISOString() : (updatedOrder as any).updatedAt,
            };
            
            const establishmentName = user?.organizationName || (updatedOrder.organization as any)?.name || 'اسم المنشأة';
            await printOrder(printableOrder, menuSections, menuItemsMap, establishmentName);
          }, 0);
        }
        
        // Update table orders immediately (optimistic)
        if (selectedTable) {
          setTableOrders(prev => 
            prev.map(order => order.id === updatedOrder.id ? updatedOrder : order)
          );
        }
        
        // Refresh data in background (non-blocking) - لا ننتظرها
        setTimeout(() => {
          fetchOrders();
          fetchBills();
        }, 100);
      } else {
        // If order update failed, revert optimistic updates
        setTableStatuses(previousTableStatuses);
        showNotification('فشل في تحديث الطلب', 'error');
      }
    } catch (error: any) {
      // Revert optimistic updates on error
      setTableStatuses(previousTableStatuses);
      
      // Handle different error types
      if (error?.message) {
        showNotification(error.message, 'error');
      } else if (error?.response?.data?.message) {
        showNotification(error.response.data.message, 'error');
      } else if (!navigator.onLine) {
        showNotification('لا يوجد اتصال بالإنترنت', 'error');
      } else {
        showNotification('خطأ في تحديث الطلب', 'error');
      }
    } finally {
      setSavingOrder(false);
    }
  };

  // Print order
  const handlePrintOrder = async (order: Order) => {
    // Check if order.items exists and is an array
    if (!order.items || !Array.isArray(order.items)) {
      showNotification('خطأ: الطلب لا يحتوي على عناصر', 'error');
      return;
    }
    const menuItemsMap = new Map();
    menuItems.forEach(item => {
      menuItemsMap.set(item.id, item);
      menuItemsMap.set(item._id, item);
      menuItemsMap.set(String(item.id), item);
      menuItemsMap.set(String(item._id), item);
    });
    
    // Create a compatible order object for printing
    const printableOrder = {
      ...order,
      items: order.items.map((item: any, index: number) => ({
        ...item,
        _id: item._id || item.id || `temp-${index}`, // Add _id if missing
      })),
      createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
      updatedAt: (order as any).updatedAt instanceof Date ? (order as any).updatedAt.toISOString() : (order as any).updatedAt,
    };
    
    // Get establishment name from user (already populated from backend)
    const establishmentName = user?.organizationName || (order.organization as any)?.name || 'اسم المنشأة';
    
    await printOrder(printableOrder, menuSections, menuItemsMap, establishmentName);
  };

  // Show confirm modal
  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText: string = 'تأكيد',
    cancelText: string = 'إلغاء',
    confirmColor: string = 'bg-red-600 hover:bg-red-700'
  ) => {
    setConfirmModalData({
      title,
      message,
      onConfirm,
      confirmText,
      cancelText,
      confirmColor,
    });
    setShowConfirmModal(true);
  };

  // Delete order
  const handleDeleteOrder = (order: Order) => {
    // التحقق من وجود دفعات جزئية للطلب
    const orderId = order._id || order.id;
    const orderBill = bills.find((bill: any) => {
      return bill.orders?.some((o: any) => {
        const billOrderId = o._id || o.id || o;
        return billOrderId === orderId;
      });
    });

    let hasPartialPayments = false;
    let paidItemsInfo = '';
    let totalPaid = 0;
    
    if (orderBill && orderBill.itemPayments) {
      // البحث عن دفعات جزئية لهذا الطلب
      const orderItemPayments = orderBill.itemPayments.filter((ip: any) => 
        ip.orderId === orderId && ip.paidAmount > 0
      );
      
      if (orderItemPayments.length > 0) {
        hasPartialPayments = true;
        totalPaid = orderItemPayments.reduce((sum: number, ip: any) => sum + ip.paidAmount, 0);
        const paidItems = orderItemPayments.map((ip: any) => 
          `• ${ip.itemName}: ${convertToArabicNumbers(ip.paidQuantity)} من ${convertToArabicNumbers(ip.quantity)} (${formatCurrencyArabic(ip.paidAmount)})`
        ).join('\n');
        
        paidItemsInfo = `\n\n⚠️ تحذير: هذا الطلب يحتوي على أصناف مدفوعة جزئياً:\n\n${paidItems}\n\n💰 إجمالي المبلغ المدفوع: ${formatCurrencyArabic(totalPaid)}\n\n✓ سيتم استرداد المبلغ المدفوع تلقائياً إلى رصيد الفاتورة`;
      }
    }

    const confirmMessage = hasPartialPayments
      ? `هل أنت متأكد من حذف الطلب ${order.orderNumber}؟${paidItemsInfo}`
      : `هل أنت متأكد من حذف الطلب ${order.orderNumber}؟`;

    const confirmColor = hasPartialPayments 
      ? 'bg-orange-600 hover:bg-orange-700' 
      : 'bg-red-600 hover:bg-red-700';

    showConfirm(
      'حذف الطلب',
      confirmMessage,
      async () => {
        try {
          setConfirmLoading(true);
          const result = await deleteOrder(order.id);
          
          // إيقاف التحميل وإغلاق النافذة فوراً
          setConfirmLoading(false);
          setShowConfirmModal(false);
          
          if (result === true) {
            // إظهار رسالة النجاح فوراً
            if (hasPartialPayments) {
              showNotification(`تم حذف الطلب بنجاح واسترداد ${formatCurrencyArabic(totalPaid)}`, 'success');
            } else {
              showNotification('تم حذف الطلب بنجاح', 'success');
            }
            
            // إعادة تحميل البيانات في الخلفية (بدون await)
            Promise.all([
              fetchOrders(),
              fetchBills()
            ]).then(() => {
              fetchAllTableStatuses();
              if (selectedTable) {
                handleTableClick(selectedTable);
              }
            }).catch(err => {
              // تجاهل الأخطاء في التحديث الخلفي
            });
          } else {
            // إظهار رسالة الخطأ
            showNotification('خطأ في حذف الطلب', 'error');
          }
        } catch (error) {
          setConfirmLoading(false);
          setShowConfirmModal(false);
          showNotification('خطأ في حذف الطلب', 'error');
        }
      },
      'تأكيد الحذف',
      'إلغاء',
      confirmColor
    );
  };


  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400 ml-2 flex-shrink-0" />
            <span className="truncate">إدارة الطلبات والطاولات</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">إدارة الطلبات والطاولات</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={() => setShowManagementModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center transition-colors duration-200 text-sm sm:text-base"
          >
            <Settings className="h-4 w-4 sm:h-5 sm:w-5 ml-1 sm:ml-2" />
            إدارة الطاولات
          </button>
          <button
            onClick={loadInitialData}
            className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 sm:px-4 py-2 rounded-lg flex items-center transition-colors duration-200 text-sm sm:text-base"
          >
            تحديث
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="group bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-lg hover:shadow-2xl p-4 sm:p-6 text-white transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-blue-100 dark:text-blue-200 text-xs sm:text-sm font-medium mb-1 sm:mb-2 truncate">عدد الأقسام</p>
              <p className="text-2xl sm:text-4xl font-bold">{tableStats.totalSections}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 sm:p-4 group-hover:bg-white/30 transition-all duration-300 flex-shrink-0">
              <Settings className="h-5 w-5 sm:h-8 sm:w-8" />
            </div>
          </div>
        </div>

        <div className="group bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 rounded-xl shadow-lg hover:shadow-2xl p-4 sm:p-6 text-white transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-green-100 dark:text-green-200 text-xs sm:text-sm font-medium mb-1 sm:mb-2 truncate">إجمالي الطاولات</p>
              <p className="text-2xl sm:text-4xl font-bold">{tableStats.totalTables}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 sm:p-4 group-hover:bg-white/30 transition-all duration-300 flex-shrink-0">
              <ShoppingCart className="h-5 w-5 sm:h-8 sm:w-8" />
            </div>
          </div>
        </div>

        <div className="group bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 rounded-xl shadow-lg hover:shadow-2xl p-4 sm:p-6 text-white transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-emerald-100 dark:text-emerald-200 text-xs sm:text-sm font-medium mb-1 sm:mb-2 truncate">الطاولات الفارغة</p>
              <p className="text-2xl sm:text-4xl font-bold">{tableStats.emptyTables}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 sm:p-4 group-hover:bg-white/30 transition-all duration-300 flex-shrink-0">
              <CheckCircle className="h-5 w-5 sm:h-8 sm:w-8" />
            </div>
          </div>
        </div>

        <div className="group bg-gradient-to-br from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 rounded-xl shadow-lg hover:shadow-2xl p-4 sm:p-6 text-white transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-red-100 dark:text-red-200 text-xs sm:text-sm font-medium mb-1 sm:mb-2 truncate">الطاولات المحجوزة</p>
              <p className="text-2xl sm:text-4xl font-bold">{tableStats.occupiedTables}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 sm:p-4 group-hover:bg-white/30 transition-all duration-300 flex-shrink-0">
              <AlertTriangle className="h-5 w-5 sm:h-8 sm:w-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Table Sections and Tables */}
      <div>
        {/* Table Sections */}
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700">
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-1 h-6 sm:h-8 bg-blue-500 rounded-full flex-shrink-0"></div>
                <span className="truncate">الأقسام والطاولات</span>
              </h2>
            </div>
            
            <div className="p-3 sm:p-6">
              {loading && tableSections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
              ) : tableSections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">لا توجد أقسام</div>
              ) : (
                <div className="space-y-4 sm:space-y-6">
                  {activeTableSections.map(section => {
                      const sectionTables = getTablesBySection[section.id] || [];
                      if (sectionTables.length === 0) return null;

                      return (
                        <div key={section.id} className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-3 sm:p-5 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 shadow-md hover:shadow-lg transition-shadow duration-300">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                            <div className="w-1 h-5 sm:h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full flex-shrink-0"></div>
                            <span className="truncate">{section.name}</span>
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 auto-cols-fr">
                            {sectionTables.map(table => {
                              const status = tableStatuses[table.number];
                              const isOccupied = status?.hasUnpaid || false;
                              const isSelected = selectedTable?.id === table.id;

                              return (
                                <TableButton
                                  key={table.id}
                                  table={table}
                                  isSelected={isSelected}
                                  isOccupied={isOccupied}
                                  onClick={handleTableClick}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Order Modal */}
      {showOrderModal && selectedTable && (
        <OrderModal
          table={selectedTable}
          orderItems={currentOrderItems}
          setOrderItems={setCurrentOrderItems}
          orderNotes={orderNotes}
          setOrderNotes={setOrderNotes}
          menuSections={menuSections}
          menuCategories={menuCategories}
          menuItems={menuItems}
          expandedSections={expandedSections}
          expandedCategories={expandedCategories}
          toggleSection={toggleSection}
          toggleCategory={toggleCategory}
          getCategoriesForSection={getCategoriesForSection}
          getItemsForCategory={getItemsForCategory}
          addItemToOrder={addItemToOrder}
          updateItemQuantity={updateItemQuantity}
          updateItemNotes={updateItemNotes}
          removeItemFromOrder={removeItemFromOrder}
          calculateTotal={calculateOrderTotal}
          onSave={() => handleSaveOrder(false)}
          onSaveAndPrint={() => handleSaveOrder(true)}
          onClose={() => {
            setShowOrderModal(false);
            setSelectedTable(null);
            setCurrentOrderItems([]);
            setOrderNotes('');
          }}
          loading={savingOrder}
          isEdit={false}
        />
      )}

      {/* Edit Order Modal */}
      {showEditOrderModal && selectedOrder && selectedTable && (
        <OrderModal
          table={selectedTable}
          orderItems={currentOrderItems}
          setOrderItems={setCurrentOrderItems}
          orderNotes={orderNotes}
          setOrderNotes={setOrderNotes}
          menuSections={menuSections}
          menuCategories={menuCategories}
          menuItems={menuItems}
          expandedSections={expandedSections}
          expandedCategories={expandedCategories}
          toggleSection={toggleSection}
          toggleCategory={toggleCategory}
          getCategoriesForSection={getCategoriesForSection}
          getItemsForCategory={getItemsForCategory}
          addItemToOrder={addItemToOrder}
          updateItemQuantity={updateItemQuantity}
          updateItemNotes={updateItemNotes}
          removeItemFromOrder={removeItemFromOrder}
          calculateTotal={calculateOrderTotal}
          onSave={() => handleUpdateOrder(false)}
          onSaveAndPrint={() => handleUpdateOrder(true)}
          onClose={() => {
            setShowEditOrderModal(false);
            setSelectedTable(null);
            setSelectedOrder(null);
            setCurrentOrderItems([]);
            setOrderNotes('');
          }}
          loading={savingOrder}
          isEdit={true}
        />
      )}

      {/* Management Modal */}
      {showManagementModal && (
        <ManagementModal
          tableSections={tableSections}
          tables={tables}
          onClose={() => setShowManagementModal(false)}
          onAddSection={() => {
            setEditingSection(null);
            setSectionFormData({ name: '', description: '', sortOrder: 0 });
            setShowSectionModal(true);
          }}
          onEditSection={(section) => {
            setEditingSection(section);
            setSectionFormData({
              name: section.name,
              description: section.description || '',
              sortOrder: section.sortOrder,
            });
            setShowSectionModal(true);
          }}
          onDeleteSection={async (id) => {
            showConfirm(
              'حذف القسم',
              'هل أنت متأكد من حذف هذا القسم؟ سيتم حذف جميع الطاولات التابعة له.',
              async () => {
                await deleteTableSection(id);
                await fetchTables();
                setShowConfirmModal(false);
              }
            );
          }}
          onAddTable={(sectionId) => {
            setEditingTable(null);
            setTableFormData({ number: '', section: sectionId });
            setShowTableModal(true);
          }}
          onEditTable={(table) => {
            setEditingTable(table);
            const sectionId = typeof table.section === 'string' 
              ? table.section 
              : (table.section as TableSection)?.id || (table.section as TableSection)?._id || '';
            setTableFormData({ number: table.number.toString(), section: sectionId });
            setShowTableModal(true);
          }}
          onDeleteTable={async (id) => {
            showConfirm(
              'حذف الطاولة',
              'هل أنت متأكد من حذف هذه الطاولة؟',
              async () => {
                await deleteTable(id);
                setShowConfirmModal(false);
              }
            );
          }}
          getTablesBySection={getTablesBySectionFn}
        />
      )}

      {/* Section Modal */}
      {showSectionModal && (
        <SectionModal
          formData={sectionFormData}
          setFormData={setSectionFormData}
          editingSection={editingSection}
          onSave={async () => {
            if (!sectionFormData.name.trim()) {
              showNotification('يرجى إدخال اسم القسم', 'error');
              return;
            }
            if (editingSection) {
              await updateTableSection(editingSection.id, sectionFormData);
            } else {
              await createTableSection(sectionFormData);
            }
            setShowSectionModal(false);
            setEditingSection(null);
            setSectionFormData({ name: '', description: '', sortOrder: 0 });
          }}
          onClose={() => {
            setShowSectionModal(false);
            setEditingSection(null);
            setSectionFormData({ name: '', description: '', sortOrder: 0 });
          }}
        />
      )}

      {/* Table Modal */}
      {showTableModal && (
        <TableModal
          formData={tableFormData}
          setFormData={setTableFormData}
          tableSections={tableSections}
          editingTable={editingTable}
          onSave={async () => {
            if (!tableFormData.number || tableFormData.number.trim() === '') {
              showNotification('يرجى إدخال رقم/اسم الطاولة', 'error');
              return;
            }
            if (!tableFormData.section) {
              showNotification('يرجى اختيار قسم', 'error');
              return;
            }
            if (editingTable) {
              await updateTable(editingTable.id, {
                number: tableFormData.number,
                section: tableFormData.section,
              });
            } else {
              await createTable({
                number: tableFormData.number,
                section: tableFormData.section,
              });
            }
            setShowTableModal(false);
            setEditingTable(null);
            setTableFormData({ number: '', section: '' });
          }}
          onClose={() => {
            setShowTableModal(false);
            setEditingTable(null);
            setTableFormData({ number: '', section: '' });
          }}
        />
      )}

      {/* Confirm Modal */}
      {showConfirmModal && confirmModalData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[70] p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="relative p-4 sm:p-5 bg-gradient-to-br from-yellow-500 to-orange-600">
              <div className="absolute top-2 right-2 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full"></div>
              <div className="relative flex items-center justify-between z-10">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-xl border border-white/30 flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg truncate">
                    {confirmModalData.title}
                  </h3>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-900">
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                {confirmModalData.message}
              </p>
            </div>
            
            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmModalData(null);
                  setConfirmLoading(false);
                }}
                disabled={confirmLoading}
                className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl transition-colors text-sm sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmModalData.cancelText || 'إلغاء'}
              </button>
              <button
                onClick={() => {
                  confirmModalData.onConfirm();
                }}
                disabled={confirmLoading}
                className={`w-full sm:w-auto px-4 py-2.5 text-white rounded-xl transition-colors text-sm sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${confirmModalData.confirmColor || 'bg-red-600 hover:bg-red-700'}`}
              >
                {confirmLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>جاري التنفيذ...</span>
                  </>
                ) : (
                  confirmModalData.confirmText || 'تأكيد'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Orders Modal */}
      {showTableOrdersModal && selectedTable && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-40 p-3 sm:p-4 md:p-6 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-sm sm:max-w-2xl md:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 animate-slideUp">
            {/* Header */}
            <div className="relative p-4 sm:p-5 md:p-6 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex-shrink-0">
              {/* Decorative circles - contained within header */}
              <div className="absolute top-2 right-2 w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-full"></div>
              <div className="absolute bottom-2 left-2 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full"></div>
              
              <div className="relative flex items-center justify-between z-10">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl border border-white/30 flex-shrink-0">
                    <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white drop-shadow-lg truncate">
                      طاولة {convertToArabicNumbers(selectedTable.number)}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="px-2 sm:px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                        <p className="text-xs sm:text-sm text-white font-medium">
                          {convertToArabicNumbers(filteredTableOrders.length)} {filteredTableOrders.length === 1 ? 'طلب' : 'طلبات'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowTableOrdersModal(false);
                    setSelectedTable(null);
                  }}
                  className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all duration-300 border border-white/30 hover:scale-110 flex-shrink-0"
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </button>
              </div>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 bg-gray-50 dark:bg-gray-900">
              {filteredTableOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-16">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center mb-4 shadow-lg">
                    <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-gray-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg font-semibold">لا توجد طلبات</p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm mt-2 text-center px-4">اضغط على "طلب جديد" لإضافة طلب</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {filteredTableOrders.map(order => (
                    <div
                      key={order.id}
                      className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 hover:scale-[1.02]"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-gradient-to-br from-orange-400 via-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate">
                              {order.orderNumber}
                            </div>
                            <div className="text-xs sm:text-sm font-semibold text-orange-600 dark:text-orange-400 truncate">
                              {(() => {
                                // Calculate total from items if not available
                                if (order.finalAmount) return formatCurrencyArabic(order.finalAmount);
                                if (order.totalAmount) return formatCurrencyArabic(order.totalAmount);
                                
                                // Calculate from items
                                if (order.items && Array.isArray(order.items)) {
                                  const total = order.items.reduce((sum: number, item: any) => {
                                    const itemTotal = (item.price || 0) * (item.quantity || 0);
                                    return sum + itemTotal;
                                  }, 0);
                                  return formatCurrencyArabic(total);
                                }
                                
                                return formatCurrencyArabic(0);
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          <button
                            onClick={() => handlePrintOrder(order)}
                            className="p-2 sm:p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all duration-300 hover:scale-110 border border-transparent hover:border-blue-200 dark:hover:border-blue-700"
                            title="طباعة"
                          >
                            <Printer className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleEditOrder(order)}
                            className="p-2 sm:p-2.5 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-xl transition-all duration-300 hover:scale-110 border border-transparent hover:border-green-200 dark:hover:border-green-700"
                            title="تعديل"
                          >
                            <Edit className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order)}
                            className="p-2 sm:p-2.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all duration-300 hover:scale-110 border border-transparent hover:border-red-200 dark:hover:border-red-700"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </div>
                      {order.items && order.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="space-y-2">
                            {order.items.slice(0, 3).map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center gap-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                                <span className="text-gray-700 dark:text-gray-300 font-medium truncate flex-1 min-w-0">{item.name}</span>
                                <span className="text-gray-500 dark:text-gray-400 font-semibold flex-shrink-0">×{item.quantity}</span>
                              </div>
                            ))}
                            {order.items.length > 3 && (
                              <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2 font-medium">
                                +{order.items.length - 3} عناصر أخرى
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 md:p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleAddOrder}
                  className="flex-1 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 font-bold text-sm sm:text-base shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                >
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                  طلب جديد
                </button>
                
                {/* Payment Management Button - only show if table is occupied */}
                {(() => {
                  const tableStatus = tableStatuses[selectedTable.number];
                  const hasUnpaidBill = tableStatus?.hasUnpaid;
                  
                  if (hasUnpaidBill) {
                    return (
                      <button
                        onClick={() => handlePaymentManagement(selectedTable)}
                        className="flex-1 sm:flex-none sm:min-w-[140px] bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 font-bold text-sm sm:text-base shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                        title="إدارة الدفع"
                      >
                        <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
                        إدارة الدفع
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Order Modal Component
interface OrderModalProps {
  table: {
    _id: string;
    number: string | number;
    name?: string;
  };
  orderItems: LocalOrderItem[];
  setOrderItems: React.Dispatch<React.SetStateAction<LocalOrderItem[]>>;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  menuSections: MenuSection[];
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  expandedSections: Record<string, boolean>;
  expandedCategories: Record<string, boolean>;
  toggleSection: (sectionId: string) => void;
  toggleCategory: (categoryId: string) => void;
  getCategoriesForSection: (sectionId: string) => MenuCategory[];
  getItemsForCategory: (categoryId: string) => MenuItem[];
  addItemToOrder: (menuItem: MenuItem) => void;
  updateItemQuantity: (menuItemId: string, delta: number) => void;
  updateItemNotes: (menuItemId: string, notes: string) => void;
  removeItemFromOrder: (menuItemId: string) => void;
  calculateTotal: () => number;
  onSave: () => void;
  onSaveAndPrint: () => void;
  onClose: () => void;
  loading: boolean;
  isEdit: boolean;
}

const OrderModal: React.FC<OrderModalProps> = ({
  table,
  orderItems,
  orderNotes,
  setOrderNotes,
  menuSections,
  menuCategories,
  menuItems,
  expandedSections,
  expandedCategories,
  toggleSection,
  toggleCategory,
  getCategoriesForSection,
  getItemsForCategory,
  addItemToOrder,
  updateItemQuantity,
  updateItemNotes,
  removeItemFromOrder,
  calculateTotal,
  onSave,
  onSaveAndPrint,
  onClose,
  loading,
  isEdit,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const orderItemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Reset search query and focus when modal opens
  useEffect(() => {
    setSearchQuery('');
    
    // Multiple attempts to ensure focus works
    const focusInput = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };
    
    // Try immediately
    focusInput();
    
    // Try after a short delay
    const timer1 = setTimeout(focusInput, 50);
    const timer2 = setTimeout(focusInput, 150);
    const timer3 = setTimeout(focusInput, 300);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);
  
  // Scroll to section when clicked - only scroll within menu container
  const scrollToSection = (sectionId: string) => {
    const sectionElement = sectionRefs.current[sectionId];
    const menuContainer = document.querySelector('.menu-scroll-container');
    
    if (sectionElement && menuContainer) {
      const containerRect = menuContainer.getBoundingClientRect();
      const sectionRect = sectionElement.getBoundingClientRect();
      const scrollTop = menuContainer.scrollTop;
      
      // Calculate the position relative to the container
      const targetScrollTop = scrollTop + (sectionRect.top - containerRect.top) - 20; // 20px offset
      
      menuContainer.scrollTo({
        top: Math.max(0, targetScrollTop), // Ensure we don't scroll to negative values
        behavior: 'smooth'
      });
    }
  };

  // Auto scroll to section when expanding it
  const handleSectionToggle = (sectionId: string) => {
    toggleSection(sectionId);
    // Only scroll if we're expanding the section
    if (!expandedSections[sectionId]) {
      setTimeout(() => scrollToSection(sectionId), 100);
    }
  };
  
  // Scroll to order item after adding - only scroll within order container
  const scrollToOrderItem = (itemId: string) => {
    setTimeout(() => {
      const orderItemElement = orderItemRefs.current[itemId];
      const orderContainer = document.querySelector('.order-scroll-container');
      
      if (orderItemElement && orderContainer) {
        const containerRect = orderContainer.getBoundingClientRect();
        const itemRect = orderItemElement.getBoundingClientRect();
        const scrollTop = orderContainer.scrollTop;
        
        // Calculate the position relative to the container
        const targetScrollTop = scrollTop + (itemRect.top - containerRect.top) - 20; // 20px offset
        
        orderContainer.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      }
    }, 100); // Small delay to ensure item is rendered
  };
  
  // Wrap addItemToOrder to include scroll
  const handleAddItemToOrder = (item: MenuItem) => {
    addItemToOrder(item);
    scrollToOrderItem(item.id);
  };

  // Filter items based on search query
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;
    const query = searchQuery.toLowerCase();
    return menuItems.filter(item => 
      item.name.toLowerCase().includes(query)
    );
  }, [menuItems, searchQuery]);

  // Get filtered items for category
  const getFilteredItemsForCategory = (categoryId: string) => {
    const items = getItemsForCategory(categoryId);
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(query));
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60] p-3 sm:p-4 md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-7xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
      >
        {/* Header */}
        <div className="relative p-4 sm:p-6 bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 flex-shrink-0">
          {/* Decorative circles */}
          <div className="absolute top-2 right-2 w-20 h-20 bg-white/10 rounded-full pointer-events-none"></div>
          <div className="absolute bottom-2 left-2 w-16 h-16 bg-white/10 rounded-full pointer-events-none"></div>
          
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl border border-white/30">
                <ShoppingCart className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                  {isEdit ? 'تعديل الطلب' : 'طلب جديد'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                    <p className="text-xs sm:text-sm text-white font-medium">
                      طاولة {convertToArabicNumbers(table.number)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all duration-300 border border-white/30 hover:scale-110"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 overflow-hidden min-h-0">
          {/* Left: Menu */}
          <div className="flex flex-col space-y-4 h-full min-h-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-red-500 rounded-full"></div>
                المنيو
              </h3>
            </div>
            {/* Search Input */}
            <div className="relative flex-shrink-0">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="بحث عن عنصر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pr-10 pl-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-300"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex-1 space-y-3 pr-2 menu-scroll-container" style={{overflowY: 'scroll'}}>
              {searchQuery.trim() ? (
                // Show all matching items when searching
                <div className="space-y-2">
                  {filteredMenuItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">لا توجد نتائج</div>
                  ) : (
                    filteredMenuItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleAddItemToOrder(item)}
                        className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                          {item.name}
                        </span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">
                          {formatCurrencyArabic(item.price)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                // Show sections and categories when not searching
                menuSections
                  .filter(section => section.isActive)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map(section => {
                    const categories = getCategoriesForSection(section.id);
                    if (categories.length === 0) return null;

                    return (
                      <div 
                        key={section.id} 
                        ref={(el) => (sectionRefs.current[section.id] = el)}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <button
                          onClick={() => handleSectionToggle(section.id)}
                          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        >
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {section.name}
                          </span>
                          {expandedSections[section.id] ? (
                            <MinusCircle className="h-5 w-5 text-gray-500" />
                          ) : (
                            <PlusCircle className="h-5 w-5 text-gray-500" />
                          )}
                        </button>
                        {expandedSections[section.id] && (
                          <div className="p-3 space-y-2">
                            {categories.map(category => {
                              const items = getItemsForCategory(category.id);
                              if (items.length === 0) return null;

                              return (
                                <div key={category.id}>
                                  <button
                                    onClick={() => toggleCategory(category.id)}
                                    className="w-full flex items-center justify-between p-2 text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors rounded"
                                  >
                                    <span className="font-medium text-gray-800 dark:text-gray-200">
                                      {category.name}
                                    </span>
                                    {expandedCategories[category.id] ? (
                                      <MinusCircle className="h-4 w-4 text-gray-500" />
                                    ) : (
                                      <PlusCircle className="h-4 w-4 text-gray-500" />
                                    )}
                                  </button>
                                  {expandedCategories[category.id] && (
                                    <div className="mt-2 space-y-1 pr-4">
                                      {getFilteredItemsForCategory(category.id).map(item => (
                                        <button
                                          key={item.id}
                                          onClick={() => handleAddItemToOrder(item)}
                                          className="w-full flex items-center justify-between p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                                        >
                                          <span className="text-gray-700 dark:text-gray-300">
                                            {item.name}
                                          </span>
                                          <span className="font-semibold text-orange-600 dark:text-orange-400">
                                            {formatCurrencyArabic(item.price)}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Right: Order Items */}
          <div className="flex flex-col space-y-4 h-full min-h-0">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-shrink-0">
              <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full"></div>
              الطلبات
              {orderItems.length > 0 && (
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-bold rounded-full">
                  {convertToArabicNumbers(orderItems.length)}
                </span>
              )}
            </h3>
            <div className="flex-1 space-y-3 pr-2 order-scroll-container" style={{overflowY: 'scroll'}}>
              {orderItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">لا توجد عناصر في الطلب</div>
              ) : (
                orderItems.map(item => {
                  const menuItem = menuItems.find(mi => mi.id === item.menuItem);
                  return (
                    <div
                      key={item.menuItem}
                      ref={(el) => (orderItemRefs.current[item.menuItem] = el)}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {item.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {formatCurrencyArabic(item.price)} × {convertToArabicNumbers(item.quantity)} = {formatCurrencyArabic(item.price * item.quantity)}
                          </div>
                        </div>
                        <button
                          onClick={() => removeItemFromOrder(item.menuItem)}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse mb-2">
                        <button
                          onClick={() => updateItemQuantity(item.menuItem, -1)}
                          className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg p-2 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                        >
                          <MinusCircle className="h-4 w-4" />
                        </button>
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 border-2 border-blue-200 dark:border-gray-500 rounded-lg px-3 py-2 min-w-[3rem] shadow-sm">
                          <span className="font-bold text-lg text-blue-800 dark:text-white text-center block">{convertToArabicNumbers(item.quantity)}</span>
                        </div>
                        <button
                          onClick={() => updateItemQuantity(item.menuItem, 1)}
                          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg p-2 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                        >
                          <PlusCircle className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => updateItemNotes(item.menuItem, e.target.value)}
                        placeholder="ملاحظات على العنصر"
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">الإجمالي:</span>
                <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrencyArabic(calculateTotal())}
                </span>
              </div>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="ملاحظات على الطلب"
                rows={3}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 space-x-reverse p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={onSave}
            disabled={loading || orderItems.length === 0}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? 'جاري الحفظ...' : isEdit ? 'تحديث' : 'حفظ'}
          </button>
          <button
            onClick={onSaveAndPrint}
            disabled={loading || orderItems.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            {loading ? 'جاري الحفظ...' : isEdit ? 'تحديث وطباعة' : 'حفظ وطباعة'}
          </button>
        </div>
      </div>
    </div>
  )}

// Management Modal Component
interface ManagementModalProps {
  tableSections: TableSection[];
  tables: Table[];
  onClose: () => void;
  onAddSection: () => void;
  onEditSection: (section: TableSection) => void;
  onDeleteSection: (id: string) => Promise<void>;
  onAddTable: (sectionId: string) => void;
  onEditTable: (table: Table) => void;
  onDeleteTable: (id: string) => Promise<void>;
  getTablesBySection: (sectionId: string) => Table[];
}

const ManagementModal: React.FC<ManagementModalProps> = ({
  tableSections,
  tables,
  onClose,
  onAddSection,
  onEditSection,
  onDeleteSection,
  onAddTable,
  onEditTable,
  onDeleteTable,
  getTablesBySection,
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60] p-3 sm:p-4 md:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-sm sm:max-w-2xl md:max-w-4xl lg:max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="relative p-4 sm:p-5 md:p-6 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex-shrink-0">
          {/* Decorative circles */}
          <div className="absolute top-2 right-2 w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-full"></div>
          <div className="absolute bottom-2 left-2 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full"></div>
          
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl border border-white/30 flex-shrink-0">
                <Settings className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white drop-shadow-lg truncate">
                  إدارة الأقسام والطاولات
                </h2>
                <p className="text-xs sm:text-sm text-white/80 mt-1 truncate">
                  {convertToArabicNumbers(tableSections.length)} أقسام • {convertToArabicNumbers(tables.length)} طاولات
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all duration-300 border border-white/30 hover:scale-110 flex-shrink-0"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 bg-gray-50 dark:bg-gray-900">
          <div className="mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-1 h-5 sm:h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full flex-shrink-0"></div>
                <span className="truncate">الأقسام</span>
              </h3>
              <button
                onClick={onAddSection}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <Plus className="h-4 w-4 ml-1" />
                إضافة قسم
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {tableSections
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map(section => {
                  const sectionTables = getTablesBySection(section.id);
                  return (
                    <div
                      key={section.id}
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-5 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                            <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{section.name}</h4>
                            <span className="w-fit px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full">
                              {convertToArabicNumbers(sectionTables.length)} طاولة
                            </span>
                          </div>
                          {section.description && (
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{section.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => onEditSection(section)}
                            className="p-2 sm:p-2.5 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-xl transition-all duration-300 hover:scale-110 border border-transparent hover:border-orange-200 dark:hover:border-orange-700"
                            title="تعديل"
                          >
                            <Edit className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
                          </button>
                          <button
                            onClick={() => onDeleteSection(section.id)}
                            className="p-2 sm:p-2.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all duration-300 hover:scale-110 border border-transparent hover:border-red-200 dark:hover:border-red-700"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex flex-wrap gap-2">
                          {sectionTables.map(table => (
                            <div
                              key={table.id}
                              className="group flex items-center gap-2 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-gray-300 dark:border-gray-600 hover:shadow-md transition-all duration-300"
                            >
                              <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100">
                                {table.number}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => onEditTable(table)}
                                  className="p-1 hover:bg-orange-200 dark:hover:bg-orange-800 rounded-lg transition-all duration-300"
                                  title="تعديل"
                                >
                                  <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-600 dark:text-orange-400" />
                                </button>
                                <button
                                  onClick={() => onDeleteTable(table.id)}
                                  className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded-lg transition-all duration-300"
                                  title="حذف"
                                >
                                  <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-600 dark:text-red-400" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => onAddTable(section.id)}
                          className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
                        >
                          <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                          إضافة طاولة
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 sm:p-5 md:p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition-colors text-sm sm:text-base font-medium"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

// Section Modal Component
interface SectionModalProps {
  formData: { name: string; description: string; sortOrder: number };
  setFormData: (data: { name: string; description: string; sortOrder: number }) => void;
  editingSection: TableSection | null;
  onSave: () => void;
  onClose: () => void;
}

const SectionModal: React.FC<SectionModalProps> = ({
  formData,
  setFormData,
  editingSection,
  onSave,
  onClose,
}) => {
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Reset focus when modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60] p-3 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm sm:max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="relative p-4 sm:p-5 bg-gradient-to-br from-blue-500 to-indigo-600">
          <div className="absolute top-2 right-2 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full"></div>
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 flex-shrink-0">
                <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg truncate">
                {editingSection ? 'تعديل القسم' : 'إضافة قسم'}
              </h2>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all duration-300 border border-white/30 flex-shrink-0"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 bg-gray-50 dark:bg-gray-900">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              اسم القسم *
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="اسم القسم"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              الوصف
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
              placeholder="وصف القسم"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ترتيب العرض
            </label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="0"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm sm:text-base font-medium transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={onSave}
            className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm sm:text-base font-medium transition-colors"
          >
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
};

// Table Modal Component
interface TableModalProps {
  formData: { number: string; section: string };
  setFormData: (data: { number: string; section: string }) => void;
  tableSections: TableSection[];
  editingTable: Table | null;
  onSave: () => void;
  onClose: () => void;
}

const TableModal: React.FC<TableModalProps> = ({
  formData,
  setFormData,
  tableSections,
  editingTable,
  onSave,
  onClose,
}) => {
  const numberInputRef = useRef<HTMLInputElement>(null);
  
  // Reset focus when modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      numberInputRef.current?.focus();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60] p-3 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm sm:max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="relative p-4 sm:p-5 bg-gradient-to-br from-green-500 to-emerald-600">
          <div className="absolute top-2 right-2 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full"></div>
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 flex-shrink-0">
                <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg truncate">
                {editingTable ? 'تعديل الطاولة' : 'إضافة طاولة'}
              </h2>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all duration-300 border border-white/30 flex-shrink-0"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 bg-gray-50 dark:bg-gray-900">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              رقم/اسم الطاولة *
            </label>
            <input
              ref={numberInputRef}
              type="text"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
              placeholder="مثال: 1، واحد، A1، VIP، شرفة 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              القسم *
            </label>
            <select
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
            >
              <option value="">اختر القسم</option>
              {tableSections
                .filter(section => section.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map(section => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm sm:text-base font-medium transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={onSave}
            className="w-full sm:w-auto px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm sm:text-base font-medium transition-colors"
          >
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cafe;
