import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ShoppingCart, Plus, Edit, Trash2, X, PlusCircle, MinusCircle, Printer, Settings, AlertTriangle, Search, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MenuItem, MenuSection, MenuCategory, TableSection, Table, Order } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { printOrderBySections } from '../utils/printOrderBySection';
import api from '../services/api';
import { io, Socket } from 'socket.io-client';

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
        w-full min-h-[100px] p-4 rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center
        ${isSelected 
          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-lg' 
          : isOccupied
          ? 'border-red-300 bg-red-50 dark:bg-red-900/20 hover:border-red-400 hover:shadow-md'
          : 'border-green-300 bg-green-50 dark:bg-green-900/20 hover:border-green-400 hover:shadow-md'
        }
      `}
    >
      <div className="text-center w-full flex flex-col items-center justify-center gap-2">
        <div className={`
          text-2xl sm:text-3xl font-bold break-words
          ${isSelected 
            ? 'text-orange-600 dark:text-orange-400' 
            : isOccupied
            ? 'text-red-600 dark:text-red-400'
            : 'text-green-600 dark:text-green-400'
          }
        `}>
          {table.number}
        </div>
        <div className={`
          text-sm font-medium
          ${isOccupied ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
        `}>
          {isOccupied ? 'محجوزة' : 'فاضية'}
        </div>
      </div>
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
            {formatCurrency(calculateTotal())}
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
      console.log('Socket.IO connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
      showNotification?.('انقطع الاتصال - جاري إعادة الاتصال...', 'warning');
    });

    socket.on('reconnect', async (attemptNumber) => {
      console.log('Socket.IO reconnected after', attemptNumber, 'attempts');
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
    };
  }, []); // Empty dependency array - only run once on mount

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // تحميل البيانات الأساسية أولاً (الأهم)
      await Promise.all([
        fetchTableSections(),
        fetchTables(),
        fetchAvailableMenuItems(),
        fetchMenuSections(),
        fetchMenuCategories(),
      ]);
      
      // إخفاء شاشة التحميل فوراً
      setLoading(false);
      
      // تحميل الفواتير والطلبات في الخلفية (غير متزامن)
      Promise.all([
        fetchBills(),
        fetchOrders(),
      ]).then(() => {
        // Fetch table statuses after loading tables and bills
        fetchAllTableStatuses();
      }).catch(error => {
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
      tablesBySection[sectionId].sort((a, b) => a.number - b.number);
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
    // Orders will be updated automatically by useEffect above
  };

  // Handle add order
  const handleAddOrder = () => {
    if (!selectedTable) {
      showNotification('يرجى اختيار طاولة أولاً', 'error');
      return;
    }
    setCurrentOrderItems([]);
    setOrderNotes('');
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
  const updateItemQuantity = (menuItemId: string, delta: number) => {
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
  };

  // Update item notes
  const updateItemNotes = (menuItemId: string, notes: string) => {
    setCurrentOrderItems(prev =>
      prev.map(item =>
        item.menuItem === menuItemId ? { ...item, notes } : item
      )
    );
  };

  // Remove item from order
  const removeItemFromOrder = (menuItemId: string) => {
    setCurrentOrderItems(prev => prev.filter(item => item.menuItem !== menuItemId));
  };

  // Calculate order total
  const calculateOrderTotal = () => {
    return currentOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  // Save order
  const handleSaveOrder = async () => {
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
      setCurrentOrderItems([]);
      setOrderNotes('');
      showNotification('جاري حفظ الطلب...', 'info');
      
      // Create order in background
      setSavingOrder(true);
      const order = await createOrder(orderData);
      
      if (order) {
        showNotification('تم إضافة الطلب بنجاح', 'success');
        
        // Print order in background (non-blocking)
        setTimeout(() => {
          const menuItemsMap = new Map();
          menuItems.forEach(item => {
            menuItemsMap.set(item.id, item);
            menuItemsMap.set(item._id, item);
            menuItemsMap.set(String(item.id), item);
            menuItemsMap.set(String(item._id), item);
          });
          
          const establishmentName = user?.organizationName || (order.organization as any)?.name || 'اسم المنشأة';
          printOrderBySections(order, menuSections, menuItemsMap, establishmentName);
        }, 0);
        
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
  const handleUpdateOrder = async () => {
    if (!selectedOrder || currentOrderItems.length === 0) {
      showNotification('يرجى إضافة عنصر واحد على الأقل', 'error');
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
      setSelectedOrder(null);
      setCurrentOrderItems([]);
      setOrderNotes('');
      showNotification('جاري تحديث الطلب...', 'info');
      
      // Update order in background
      setSavingOrder(true);
      const updatedOrder = await updateOrder(selectedOrder.id, orderData);
      
      if (updatedOrder) {
        showNotification('تم تحديث الطلب بنجاح', 'success');
        
        // Print updated order in background (non-blocking)
        setTimeout(() => {
          const menuItemsMap = new Map();
          menuItems.forEach(item => {
            menuItemsMap.set(item.id, item);
            menuItemsMap.set(item._id, item);
            menuItemsMap.set(String(item.id), item);
            menuItemsMap.set(String(item._id), item);
          });
          
          const establishmentName = user?.organizationName || (updatedOrder.organization as any)?.name || 'اسم المنشأة';
          printOrderBySections(updatedOrder, menuSections, menuItemsMap, establishmentName);
        }, 0);
        
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
  const handlePrintOrder = (order: Order) => {
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
    
    // Get establishment name from user (already populated from backend)
    const establishmentName = user?.organizationName || (order.organization as any)?.name || 'اسم المنشأة';
    
    printOrderBySections(order, menuSections, menuItemsMap, establishmentName);
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
    showConfirm(
      'حذف الطلب',
      `هل أنت متأكد من حذف الطلب ${order.orderNumber}؟`,
      async () => {
        try {
          setLoading(true);
          const result = await deleteOrder(order.id);
          if (result) {
            showNotification('تم حذف الطلب بنجاح', 'success');
            await fetchAllTableStatuses();
            if (selectedTable) {
              await handleTableClick(selectedTable);
            }
          }
        } catch (error) {
          showNotification('خطأ في حذف الطلب', 'error');
        } finally {
          setLoading(false);
          setShowConfirmModal(false);
        }
      }
    );
  };


  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <ShoppingCart className="h-6 w-6 text-orange-600 dark:text-orange-400 ml-2" />
            إدارة الطلبات والطاولات
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">إدارة الطلبات والطاولات</p>
        </div>
        <div className="flex items-center space-x-3 space-x-reverse">
          <button
            onClick={() => setShowManagementModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
          >
            <Settings className="h-5 w-5 ml-2" />
            إدارة الطاولات
          </button>
          <button
            onClick={loadInitialData}
            className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
          >
            تحديث
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 dark:text-blue-200 text-sm font-medium mb-1">عدد الأقسام</p>
              <p className="text-3xl font-bold">{tableStats.totalSections}</p>
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <Settings className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 dark:text-green-200 text-sm font-medium mb-1">إجمالي الطاولات</p>
              <p className="text-3xl font-bold">{tableStats.totalTables}</p>
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <ShoppingCart className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 dark:text-emerald-200 text-sm font-medium mb-1">الطاولات الفارغة</p>
              <p className="text-3xl font-bold">{tableStats.emptyTables}</p>
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <CheckCircle className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 dark:text-red-200 text-sm font-medium mb-1">الطاولات المحجوزة</p>
              <p className="text-3xl font-bold">{tableStats.occupiedTables}</p>
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <AlertTriangle className="h-8 w-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Table Sections and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-400px)]">
        {/* Left: Table Sections */}
        <div className="lg:col-span-2 h-full">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">الأقسام والطاولات</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {loading && tableSections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
              ) : tableSections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">لا توجد أقسام</div>
              ) : (
                <div className="space-y-6">
                  {activeTableSections.map(section => {
                      const sectionTables = getTablesBySection[section.id] || [];
                      if (sectionTables.length === 0) return null;

                      return (
                        <div key={section.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                            {section.name}
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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

        {/* Right: Table Orders */}
        <div className="lg:col-span-1 h-full">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {selectedTable ? `طاولة ${selectedTable.number}` : 'اختر طاولة'}
                </h2>
                {selectedTable && (
                  <button
                    onClick={handleAddOrder}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg flex items-center text-sm transition-colors duration-200"
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    طلب جديد
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedTable ? (
                <div className="space-y-3">
                  {filteredTableOrders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">لا توجد طلبات</div>
                  ) : (
                    filteredTableOrders.map(order => (
                      <OrderItem
                        key={order.id}
                        order={order}
                        onPrint={handlePrintOrder}
                        onEdit={handleEditOrder}
                        onDelete={handleDeleteOrder}
                      />
                    ))
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  اختر طاولة لعرض الطلبات
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
          onSave={handleSaveOrder}
          onClose={() => {
            setShowOrderModal(false);
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
          onSave={handleUpdateOrder}
          onClose={() => {
            setShowEditOrderModal(false);
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {confirmModalData.title}
                  </h3>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                {confirmModalData.message}
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmModalData(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
              >
                {confirmModalData.cancelText || 'إلغاء'}
              </button>
              <button
                onClick={() => {
                  confirmModalData.onConfirm();
                }}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${confirmModalData.confirmColor || 'bg-red-600 hover:bg-red-700'}`}
              >
                {confirmModalData.confirmText || 'تأكيد'}
              </button>
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
  onClose,
  loading,
  isEdit,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const orderItemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // Scroll to section when clicked
  const scrollToSection = (sectionId: string) => {
    const sectionElement = sectionRefs.current[sectionId];
    if (sectionElement) {
      sectionElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
    }
  };
  
  // Scroll to order item after adding
  const scrollToOrderItem = (itemId: string) => {
    setTimeout(() => {
      const orderItemElement = orderItemRefs.current[itemId];
      if (orderItemElement) {
        orderItemElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'تعديل الطلب' : 'إضافة طلب'} - طاولة {table.number}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Menu */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">المنيو</h3>
            </div>
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="بحث عن عنصر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
            <div className="space-y-3">
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
                          {formatCurrency(item.price)}
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
                          onClick={() => {
                            toggleSection(section.id);
                            scrollToSection(section.id);
                          }}
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
                                            {formatCurrency(item.price)}
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
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">الطلبات</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
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
                            {formatCurrency(item.price)} × {item.quantity} = {formatCurrency(item.price * item.quantity)}
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
                          className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded p-1"
                        >
                          <MinusCircle className="h-4 w-4" />
                        </button>
                        <span className="font-semibold w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateItemQuantity(item.menuItem, 1)}
                          className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded p-1"
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
                  {formatCurrency(calculateTotal())}
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">إدارة الأقسام والطاولات</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">الأقسام</h3>
              <button
                onClick={onAddSection}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center text-sm"
              >
                <Plus className="h-4 w-4 ml-1" />
                إضافة قسم
              </button>
            </div>
            <div className="space-y-3">
              {tableSections
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map(section => {
                  const sectionTables = getTablesBySection(section.id);
                  return (
                    <div
                      key={section.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{section.name}</h4>
                          {section.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{section.description}</p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {sectionTables.length} طاولة
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <button
                            onClick={() => onEditSection(section)}
                            className="text-orange-600 hover:text-orange-700 p-2"
                            title="تعديل"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDeleteSection(section.id)}
                            className="text-red-600 hover:text-red-700 p-2"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                          {sectionTables.map(table => (
                            <div
                              key={table.id}
                              className="flex items-center space-x-2 space-x-reverse bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded"
                            >
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                طاولة {table.number}
                              </span>
                              <button
                                onClick={() => onEditTable(table)}
                                className="text-orange-600 hover:text-orange-700"
                                title="تعديل"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => onDeleteTable(table.id)}
                                className="text-red-600 hover:text-red-700"
                                title="حذف"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => onAddTable(section.id)}
                          className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
                        >
                          <Plus className="h-4 w-4 ml-1" />
                          إضافة طاولة
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
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
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {editingSection ? 'تعديل القسم' : 'إضافة قسم'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              اسم القسم *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="اسم القسم"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              الوصف
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="وصف القسم"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ترتيب العرض
            </label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 space-x-reverse p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
          >
            إلغاء
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
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
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {editingTable ? 'تعديل الطاولة' : 'إضافة طاولة'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              رقم/اسم الطاولة *
            </label>
            <input
              type="text"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="مثال: 1، واحد، A1، VIP، شرفة 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              القسم *
            </label>
            <select
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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

        <div className="flex items-center justify-end space-x-3 space-x-reverse p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
          >
            إلغاء
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cafe;
