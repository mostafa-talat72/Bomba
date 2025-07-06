import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api, { User, Session, Order, InventoryItem, Bill, Cost, Device, MenuItem, BillItem } from '../services/api';

interface NotificationType {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface AppContextType {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  notification: NotificationType | null;

  // Data state
  sessions: Session[];
  orders: Order[];
  inventory: InventoryItem[];
  bills: Bill[];
  costs: Cost[];
  devices: Device[];
  menuItems: MenuItem[];
  settings: any;
  inventoryItems: InventoryItem[];
  users: User[];

  // Auth methods
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshData: () => Promise<void>;

  // Data methods
  fetchSessions: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchInventory: () => Promise<void>;
  fetchBills: () => Promise<void>;
  fetchCosts: () => Promise<void>;
  fetchMenuItems: () => Promise<void>;
  fetchDevices: () => Promise<void>;
  fetchInventoryItems: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchSettings: () => Promise<void>;

  // CRUD methods
  createSession: (sessionData: any) => Promise<Session | null>;
  updateSession: (id: string, updates: any) => Promise<Session | null>;
  endSession: (id: string) => Promise<Session | null>;

  createOrder: (orderData: any) => Promise<Order | null>;
  updateOrder: (id: string, updates: any) => Promise<Order | null>;
  deleteOrder: (id: string) => Promise<boolean>;

  createInventoryItem: (itemData: any) => Promise<InventoryItem | null>;
  updateInventoryItem: (id: string, updates: any) => Promise<InventoryItem | null>;
  updateStock: (id: string, stockData: any) => Promise<InventoryItem | null>;

  createBill: (billData: any) => Promise<Bill | null>;
  updateBill: (id: string, updates: any) => Promise<Bill | null>;
  addPayment: (id: string, paymentData: any) => Promise<Bill | null>;
  cancelBill: (id: string) => Promise<boolean>;
  getBillItems: (id: string) => Promise<BillItem[]>;
  addPartialPayment: (id: string, paymentData: any) => Promise<Bill | null>;

  createCost: (costData: any) => Promise<Cost | null>;
  updateCost: (id: string, updates: any) => Promise<Cost | null>;
  deleteCost: (id: string) => Promise<boolean>;

  // Device CRUD methods
  createDevice: (deviceData: any) => Promise<Device | null>;
  updateDevice: (id: string, updates: any) => Promise<Device | null>;
  updateDeviceStatus: (id: string, status: string) => Promise<Device | null>;
  deleteDevice: (id: string) => Promise<boolean>;
  getDeviceStats: () => Promise<any>;

  // Menu CRUD methods
  createMenuItem: (itemData: any) => Promise<MenuItem | null>;
  updateMenuItem: (id: string, updates: any) => Promise<MenuItem | null>;
  deleteMenuItem: (id: string) => Promise<boolean>;
  getMenuItemsByCategory: (category: string) => Promise<MenuItem[]>;
  getPopularMenuItems: (limit?: number) => Promise<MenuItem[]>;
  getMenuStats: () => Promise<any>;

  // User CRUD methods
  createUser: (userData: any) => Promise<User | null>;
  updateUser: (id: string, updates: any) => Promise<User | null>;
  deleteUser: (id: string) => Promise<boolean>;

  // Utility methods
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;

  // New methods
  updateOrderItemPrepared: (orderId: string, itemIndex: number, data: { preparedCount: number }) => Promise<Order | null>;
  updateOrderStatus: (orderId: string, status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled') => Promise<Order | null>;
  getRecentActivity: (limit?: number) => Promise<any[]>;

  // Report methods
  getSalesReport: (period?: string, groupBy?: string) => Promise<any>;
  getSessionsReport: (period?: string, device?: string) => Promise<any>;
  getInventoryReport: (category?: string) => Promise<any>;
  getFinancialReport: (period?: string) => Promise<any>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationType | null>(null);

  // Data state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<any>({});

  // Check authentication on app load
  useEffect(() => {
    console.log('🔄 App loading, checking authentication...');

    // Skip auth check if we're on a public bill page
    if (window.location.pathname.startsWith('/bill/')) {
      console.log('📄 Public bill page detected, skipping authentication check');
      setIsLoading(false);
      return;
    }

    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('🔍 Checking authentication...');
      const token = localStorage.getItem('token');
      if (token) {
        console.log('🔑 Token found, validating...');
        const response = await api.getMe();
        if (response.success && response.data?.user) {
          console.log('✅ Authentication successful, user:', response.data.user.name);
          setUser(response.data.user);
          setIsAuthenticated(true);
          console.log('🔄 Refreshing data after authentication...');
          await refreshData();
        } else {
          console.log('❌ Token invalid, removing...');
          localStorage.removeItem('token');
        }
      } else {
        console.log('❌ No token found');
      }
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  // Auth methods
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('🔐 Attempting login for:', email);
      const response = await api.login(email, password);
      if (response.success && response.data?.user) {
        console.log('✅ Login successful, user:', response.data.user.name);
        localStorage.setItem('token', response.data.token);
        api.setToken(response.data.token);
        setUser(response.data.user);
        setIsAuthenticated(true);
        console.log('🔄 Refreshing data after login...');
        await refreshData();
        showNotification('تم تسجيل الدخول بنجاح', 'success');
        return true;
      }
      console.log('❌ Login failed:', response.message);
      return false;
    } catch (error: any) {
      console.error('❌ Login error:', error);
      showNotification(error.message || 'فشل في تسجيل الدخول', 'error');
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setSessions([]);
      setOrders([]);
      setInventory([]);
      setBills([]);
      setCosts([]);
      showNotification('تم تسجيل الخروج بنجاح', 'info');
    }
  };

  // Data fetching methods
  const fetchSessions = async (): Promise<void> => {
    try {
      console.log('Fetching sessions...');
      const response = await api.getSessions();
      console.log('Sessions response:', response);
      if (response.success && response.data) {
        console.log('Setting sessions:', response.data);
        setSessions(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const fetchOrders = async (): Promise<void> => {
    try {
      console.log('🔍 Fetching orders...');
      const response = await api.getOrders();
      console.log('📥 Orders response:', response);
      if (response.success && response.data) {
        console.log('📋 Setting orders:', response.data);

        // Log details of each order
        response.data.forEach((order, index) => {
          console.log(`📋 Order ${index + 1} from API:`, {
            _id: order._id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            itemsCount: order.items ? order.items.length : 0,
            items: order.items,
            status: order.status,
            finalAmount: order.finalAmount
          });
        });

        setOrders(response.data);
        console.log('✅ Orders set successfully');
      } else {
        console.log('❌ No orders data in response');
      }
    } catch (error) {
      console.error('❌ Failed to fetch orders:', error);
    }
  };

  const fetchInventory = async (): Promise<void> => {
    try {
      const response = await api.getInventoryItems();
      if (response.success && response.data) {
        setInventory(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    }
  };

  const fetchBills = async (): Promise<void> => {
    try {
      const response = await api.getBills();
      if (response.success && response.data) {
        // تضمين جميع الفواتير بما في ذلك الملغية
        setBills(response.data);
        console.log('📋 AppContext: Fetched bills:', response.data.length, 'bills');
        response.data.forEach(bill => {
          console.log(`📄 Bill ${bill.billNumber}: status = ${bill.status}, paid = ${bill.paid}`);
        });
      }
    } catch (error) {
      console.error('Failed to fetch bills:', error);
    }
  };

  const fetchCosts = async (): Promise<void> => {
    try {
      const response = await api.getCosts();
      if (response.success && response.data) {
        setCosts(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch costs:', error);
    }
  };

  const fetchMenuItems = async (): Promise<void> => {
    try {
      const response = await api.getMenuItems();
      if (response.success && response.data) {
        setMenuItems(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
    }
  };

  const fetchDevices = async (): Promise<void> => {
    try {
      const response = await api.getDevices();
      if (response.success && response.data) {
        setDevices(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  const fetchInventoryItems = async (): Promise<void> => {
    try {
      const response = await api.getInventoryItems();
      if (response.success && response.data) {
        setInventoryItems(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch inventory items:', error);
    }
  };

  const fetchUsers = async (): Promise<void> => {
    try {
      const response = await api.getUsers();
      if (response.success && response.data) {
        setUsers(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchSettings = async (): Promise<void> => {
    try {
      const response = await api.getAllSettings();
      if (response.success && response.data) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  // CRUD methods for sessions
  const createSession = async (sessionData: any): Promise<Session | null> => {
    try {
      console.log('بيانات الجلسة المرسلة:', sessionData);
      const response = await api.createSession(sessionData);
      if (response.success && response.data) {
        setSessions(prev => [...prev, response.data!]);
        showNotification('تم بدء الجلسة بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      console.error('createSession error:', error, sessionData);
      showNotification(error.message || 'فشل في إنشاء الجلسة', 'error');
      return null;
    }
  };

  const updateSession = async (id: string, updates: any): Promise<Session | null> => {
    try {
      const response = await api.updateSession(id, updates);
      if (response.success && response.data) {
        setSessions(prev => prev.map(session =>
          session.id === id ? response.data! : session
        ));
        showNotification('تم تحديث الجلسة بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في تحديث الجلسة', 'error');
      return null;
    }
  };

  const endSession = async (id: string): Promise<Session | null> => {
    try {
      const response = await api.endSession(id);
      if (response.success && response.data) {
        const data = response.data as any;
        const session = data.session;
        const bill = data.bill;

        setSessions(prev => prev.map(s =>
          s.id === id ? session : s
        ));

        // Add bill to bills list if created
        if (bill) {
          setBills(prev => [...prev, bill]);
          showNotification(`تم إنهاء الجلسة وإنشاء الفاتورة ${bill.billNumber}`, 'success');
        } else {
          showNotification('تم إنهاء الجلسة بنجاح', 'success');
        }

        return session;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في إنهاء الجلسة', 'error');
      return null;
    }
  };


  // CRUD methods for orders
  const createOrder = async (orderData: any): Promise<Order | null> => {
    try {
      console.log('🔍 AppContext: Creating order with data:', orderData);

      // Validate order data
      if (!orderData.customerName || !orderData.items || orderData.items.length === 0) {
        showNotification('بيانات الطلب غير مكتملة', 'error');
        return null;
      }

      // Validate each item
      for (const item of orderData.items) {
        if (!item.name || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
          showNotification('بيانات العناصر غير مكتملة', 'error');
          return null;
        }
      }

      const response = await api.createOrder(orderData);

      console.log('📥 AppContext: Order response:', response);

      if (response.success && response.data) {
        console.log('✅ Order created successfully, adding to orders list');
        setOrders(prev => {
          console.log('📋 Previous orders:', prev);
          const newOrders = [...prev, response.data!];
          console.log('📋 New orders list:', newOrders);
          return newOrders;
        });
        showNotification('تم إنشاء الطلب بنجاح', 'success');
        console.log('✅ Order added to context successfully');
        return response.data;
      } else {
        const errorMessage = response.message || 'فشل في إنشاء الطلب';
        console.error('❌ Order creation failed:', errorMessage);
        showNotification(errorMessage, 'error');
        return null;
      }
    } catch (error: any) {
      console.error('❌ AppContext: Order creation error:', error);
      const errorMessage = error.message || 'فشل في إنشاء الطلب';
      showNotification(errorMessage, 'error');
      return null;
    }
  };

  const updateOrder = async (id: string, updates: any): Promise<Order | null> => {
    try {
      const response = await api.updateOrder(id, updates);
      if (response.success && response.data) {
        setOrders(prev => prev.map(order =>
          order.id === id ? response.data! : order
        ));
        showNotification('تم تحديث الطلب بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في تحديث الطلب', 'error');
      return null;
    }
  };

  const updateOrderItemPrepared = async (orderId: string, itemIndex: number, data: { preparedCount: number }): Promise<Order | null> => {
    try {
      const response = await api.updateOrderItemPrepared(orderId, itemIndex, data);
      if (response.success && response.data) {
        // Update the order in local state
        setOrders(prev => prev.map(order =>
          order.id === orderId ? response.data! : order
        ));
        showNotification('تم تحديث حالة التجهيز بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في تحديث حالة التجهيز', 'error');
      return null;
    }
  };

  const updateOrderStatus = async (orderId: string, status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'): Promise<Order | null> => {
    try {
      const response = await api.updateOrder(orderId, { status });
      if (response.success && response.data) {
        // Update the order in local state
        setOrders(prev => prev.map(order =>
          order.id === orderId ? response.data! : order
        ));
        showNotification('تم تحديث حالة الطلب بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في تحديث حالة الطلب', 'error');
      return null;
    }
  };

  const deleteOrder = async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteOrder(id);
      if (response.success) {
        setOrders(prev => prev.filter(order => order.id !== id));
        showNotification('تم حذف الطلب بنجاح', 'success');
        return true;
      }
      return false;
    } catch (error: any) {
      showNotification(error.message || 'فشل في حذف الطلب', 'error');
      return false;
    }
  };

  // CRUD methods for inventory
  const createInventoryItem = async (itemData: any): Promise<InventoryItem | null> => {
    try {
      const response = await api.createInventoryItem(itemData);
      if (response.success && response.data) {
        setInventory(prev => [...prev, response.data!]);
        showNotification('تم إضافة المنتج بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في إضافة المنتج', 'error');
      return null;
    }
  };

  const updateInventoryItem = async (id: string, updates: any): Promise<InventoryItem | null> => {
    try {
      const response = await api.updateInventoryItem(id, updates);
      if (response.success && response.data) {
        setInventory(prev => prev.map(item =>
          item.id === id ? response.data! : item
        ));
        showNotification('تم تحديث المنتج بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في تحديث المنتج', 'error');
      return null;
    }
  };

  const updateStock = async (id: string, stockData: any): Promise<InventoryItem | null> => {
    try {
      const response = await api.updateStock(id, stockData);
      if (response.success && response.data) {
        setInventory(prev => prev.map(item =>
          item.id === id ? response.data! : item
        ));
        showNotification('تم تحديث المخزون بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في تحديث المخزون', 'error');
      return null;
    }
  };

  // CRUD methods for bills
  const createBill = async (billData: any): Promise<Bill | null> => {
    try {
      const response = await api.createBill(billData);
      if (response.success && response.data) {
        setBills(prev => [...prev, response.data!]);
        showNotification('تم إنشاء الفاتورة بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في إنشاء الفاتورة', 'error');
      return null;
    }
  };

  const updateBill = async (id: string, updates: any): Promise<Bill | null> => {
    try {
      const response = await api.updateBill(id, updates);
      if (response.success && response.data) {
        setBills(prev => prev.map(bill =>
          bill.id === id ? response.data! : bill
        ));
        showNotification('تم تحديث الفاتورة بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في تحديث الفاتورة', 'error');
      return null;
    }
  };

  const addPayment = async (id: string, paymentData: any): Promise<Bill | null> => {
    try {
      const response = await api.addPayment(id, paymentData);
      if (response.success && response.data) {
        setBills(prev => prev.map(bill =>
          bill.id === id ? response.data! : bill
        ));
        showNotification('تم تسجيل الدفع بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في تسجيل الدفع', 'error');
      return null;
    }
  };

  const cancelBill = async (id: string): Promise<boolean> => {
    try {
      console.log('🔄 AppContext: Cancelling bill with ID:', id);
      const response = await api.cancelBill(id);
      console.log('📥 AppContext: Cancel bill response:', response);

      if (response.success) {
        console.log('✅ AppContext: Bill cancelled successfully, updating local list');
        // تحديث حالة الفاتورة في القائمة المحلية بدلاً من إزالتها
        setBills(prev => {
          const newBills = prev.map(bill =>
            bill.id === id
              ? { ...bill, status: 'cancelled' as const }
              : bill
          );
          console.log('📋 AppContext: Bills after update:', newBills.length);
          return newBills;
        });
        showNotification('تم إلغاء الفاتورة بنجاح', 'success');
        return true;
      } else {
        console.log('❌ AppContext: Cancel bill failed:', response.message);
        return false;
      }
    } catch (error: any) {
      console.error('❌ AppContext: Cancel bill error:', error);
      showNotification(error.message || 'فشل في إلغاء الفاتورة', 'error');
      return false;
    }
  };

  const getBillItems = async (id: string): Promise<BillItem[]> => {
    try {
      const response = await api.getBillItems(id);
      return response.success && response.data ? response.data : [];
    } catch (error) {
      console.error('Failed to get bill items:', error);
      return [];
    }
  };

  const addPartialPayment = async (id: string, paymentData: any): Promise<Bill | null> => {
    try {
      const response = await api.addPartialPayment(id, paymentData);
      if (response.success && response.data) {
        setBills(prev => prev.map(bill =>
          bill.id === id ? response.data! : bill
        ));
        showNotification('تم تسجيل الدفع الجزئي بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في تسجيل الدفع الجزئي', 'error');
      return null;
    }
  };

  // CRUD methods for costs
  const createCost = async (costData: any): Promise<Cost | null> => {
    try {
      const response = await api.createCost(costData);
      if (response.success && response.data) {
        setCosts(prev => [...prev, response.data!]);
        showNotification('تم إضافة التكلفة بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في إضافة التكلفة', 'error');
      return null;
    }
  };

  const updateCost = async (id: string, updates: any): Promise<Cost | null> => {
    try {
      const response = await api.updateCost(id, updates);
      if (response.success && response.data) {
        setCosts(prev => prev.map(cost =>
          cost.id === id ? response.data! : cost
        ));
        showNotification('تم تحديث التكلفة بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في تحديث التكلفة', 'error');
      return null;
    }
  };

  const deleteCost = async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteCost(id);
      if (response.success) {
        setCosts(prev => prev.filter(cost => cost.id !== id));
        showNotification('تم حذف التكلفة بنجاح', 'success');
        return true;
      }
      return false;
    } catch (error: any) {
      showNotification(error.message || 'فشل في حذف التكلفة', 'error');
      return false;
    }
  };

  // CRUD methods for devices
  const createDevice = async (deviceData: any): Promise<Device | null> => {
    try {
      const response = await api.createDevice(deviceData);
      if (response.success && response.data) {
        setDevices(prev => [...prev, response.data!]);
        showNotification('تم إضافة الجهاز بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في إضافة الجهاز', 'error');
      return null;
    }
  };

  const updateDevice = async (id: string, updates: any): Promise<Device | null> => {
    try {
      const response = await api.updateDevice(id, updates);
      if (response.success && response.data) {
        setDevices(prev => prev.map(device =>
          device.id === id ? response.data! : device
        ));
        showNotification('تم تحديث الجهاز بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في تحديث الجهاز', 'error');
      return null;
    }
  };

  const updateDeviceStatus = async (id: string, status: string): Promise<Device | null> => {
    try {
      const response = await api.updateDeviceStatus(id, status);
      if (response.success && response.data) {
        setDevices(prev => prev.map(device =>
          device.id === id ? response.data! : device
        ));
        showNotification('تم تحديث حالة الجهاز بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'فشل في تحديث حالة الجهاز', 'error');
      return null;
    }
  };

  const deleteDevice = async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteDevice(id);
      if (response.success) {
        await fetchDevices();
        showNotification('تم حذف الجهاز بنجاح', 'success');
        return true;
      }
      return false;
    } catch (error: any) {
      showNotification(error.message || 'خطأ في حذف الجهاز', 'error');
      return false;
    }
  };

  const getDeviceStats = async (): Promise<any> => {
    try {
      const response = await api.getDeviceStats();
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Failed to get device stats:', error);
      return null;
    }
  };

  // Menu CRUD methods
  const createMenuItem = async (itemData: any): Promise<MenuItem | null> => {
    try {
      const response = await api.createMenuItem(itemData);
      if (response.success && response.data) {
        await fetchMenuItems();
        showNotification('تم إضافة العنصر بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'خطأ في إضافة العنصر', 'error');
      return null;
    }
  };

  const updateMenuItem = async (id: string, updates: any): Promise<MenuItem | null> => {
    try {
      const response = await api.updateMenuItem(id, updates);
      if (response.success && response.data) {
        await fetchMenuItems();
        showNotification('تم تحديث العنصر بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: any) {
      showNotification(error.message || 'خطأ في تحديث العنصر', 'error');
      return null;
    }
  };

  const deleteMenuItem = async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteMenuItem(id);
      if (response.success) {
        await fetchMenuItems();
        showNotification('تم حذف العنصر بنجاح', 'success');
        return true;
      }
      return false;
    } catch (error: any) {
      showNotification(error.message || 'خطأ في حذف العنصر', 'error');
      return false;
    }
  };

  const getMenuItemsByCategory = async (category: string): Promise<MenuItem[]> => {
    try {
      const response = await api.getMenuItemsByCategory(category);
      return response.success && response.data ? response.data : [];
    } catch (error) {
      console.error('Failed to get menu items by category:', error);
      return [];
    }
  };

  const getPopularMenuItems = async (limit?: number): Promise<MenuItem[]> => {
    try {
      const response = await api.getPopularMenuItems(limit);
      return response.success && response.data ? response.data : [];
    } catch (error) {
      console.error('Failed to get popular menu items:', error);
      return [];
    }
  };

  const getMenuStats = async (): Promise<any> => {
    try {
      const response = await api.getMenuStats();
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Failed to get menu stats:', error);
      return null;
    }
  };

  // User CRUD methods
  const createUser = async (userData: any): Promise<User | null> => {
    try {
      const response = await api.createUser(userData);
      if (response.success && response.data) {
        showNotification('تم إضافة المستخدم بنجاح', 'success');
        await fetchUsers();
        return response.data;
      }
      showNotification(response.message || 'فشل في إضافة المستخدم', 'error');
      return null;
    } catch (error: any) {
      console.error('Error creating user:', error);
      showNotification(error.message || 'فشل في إضافة المستخدم', 'error');
      return null;
    }
  };

  const updateUser = async (id: string, updates: any): Promise<User | null> => {
    try {
      const response = await api.updateUser(id, updates);
      if (response.success && response.data) {
        showNotification('تم تحديث المستخدم بنجاح', 'success');
        await fetchUsers();
        return response.data;
      }
      showNotification(response.message || 'فشل في تحديث المستخدم', 'error');
      return null;
    } catch (error: any) {
      console.error('Error updating user:', error);
      showNotification(error.message || 'فشل في تحديث المستخدم', 'error');
      return null;
    }
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteUser(id);
      if (response.success) {
        showNotification('تم حذف المستخدم بنجاح', 'success');
        await fetchUsers();
        return true;
      }
      showNotification(response.message || 'فشل في حذف المستخدم', 'error');
      return false;
    } catch (error: any) {
      console.error('Error deleting user:', error);
      showNotification(error.message || 'فشل في حذف المستخدم', 'error');
      return false;
    }
  };

  // Utility methods
  const refreshData = async (): Promise<void> => {
    if (!isAuthenticated && !user) {
      console.log('❌ Not authenticated, skipping data refresh');
      return;
    }

    try {
      console.log('🔄 Refreshing all data...');
      await Promise.all([
        fetchSessions(),
        fetchOrders(),
        fetchInventory(),
        fetchBills(),
        fetchCosts(),
        fetchDevices(),
        fetchMenuItems(),
        fetchInventoryItems(),
        fetchUsers(),
        fetchSettings(),
      ]);
      console.log('✅ Data refresh completed');
    } catch (error) {
      console.error('❌ Failed to refresh data:', error);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info'): void => {
    // Simple notification implementation
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg text-white max-w-sm ${type === 'success' ? 'bg-green-500' :
      type === 'error' ? 'bg-red-500' : 'bg-blue-500'
      }`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
  };

  const getRecentActivity = async (limit?: number): Promise<any[]> => {
    try {
      const response = await api.getRecentActivity(limit);
      return response.success && response.data ? response.data : [];
    } catch (error) {
      console.error('Failed to get recent activity:', error);
      return [];
    }
  };

  // Report methods
  const getSalesReport = async (period?: string, groupBy?: string): Promise<any> => {
    try {
      const response = await api.getSalesReport(period, groupBy);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error fetching sales report:', error);
      return null;
    }
  };

  const getSessionsReport = async (period?: string, device?: string): Promise<any> => {
    try {
      const response = await api.getSessionsReport(period, device);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error fetching sessions report:', error);
      return null;
    }
  };

  const getInventoryReport = async (category?: string): Promise<any> => {
    try {
      const response = await api.getInventoryReport(category);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error fetching inventory report:', error);
      return null;
    }
  };

  const getFinancialReport = async (period?: string): Promise<any> => {
    try {
      const response = await api.getFinancialReport(period);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error fetching financial report:', error);
      return null;
    }
  };

  const value: AppContextType = {
    // Auth state
    user,
    isAuthenticated,
    isLoading,
    error,
    notification,

    // Data state
    sessions,
    orders,
    inventory,
    bills,
    costs,
    devices,
    menuItems,
    settings,
    inventoryItems,
    users,

    // Auth methods
    login,
    logout,
    refreshData,

    // Data methods
    fetchSessions,
    fetchOrders,
    fetchInventory,
    fetchBills,
    fetchCosts,
    fetchMenuItems,
    fetchDevices,
    fetchInventoryItems,
    fetchUsers,
    fetchSettings,

    // CRUD methods
    createSession,
    updateSession,
    endSession,
    createOrder,
    updateOrder,
    deleteOrder,
    createInventoryItem,
    updateInventoryItem,
    updateStock,
    createBill,
    updateBill,
    addPayment,
    cancelBill,
    getBillItems,
    addPartialPayment,
    createCost,
    updateCost,
    deleteCost,
    createDevice,
    updateDevice,
    updateDeviceStatus,
    deleteDevice,
    getDeviceStats,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    getMenuItemsByCategory,
    getPopularMenuItems,
    getMenuStats,
    createUser,
    updateUser,
    deleteUser,

    // Utility methods
    showNotification,

    // New methods
    updateOrderItemPrepared,
    updateOrderStatus,
    getRecentActivity,
    getSalesReport,
    getSessionsReport,
    getInventoryReport,
    getFinancialReport
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
