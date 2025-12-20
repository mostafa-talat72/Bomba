import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo } from 'react';
import api, { User, Session, Order, InventoryItem, Bill, Cost, Device, MenuItem, MenuSection, MenuCategory, BillItem } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useSmartPolling } from '../hooks/useSmartPolling';

// تعريف Notification (مأخوذ من NotificationCenter)
interface Notification {
  _id: string;
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'session' | 'order' | 'inventory' | 'billing' | 'system';
  category: 'session' | 'order' | 'inventory' | 'billing' | 'system' | 'security' | 'backup';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionRequired: boolean;
  actionUrl?: string;
  actionText?: string;
  createdAt: string;
  readBy: Array<{ user: string; readAt: string }>;
  createdBy: { name: string };
}

interface NotificationType {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface AppContextType {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
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
  menuSections: MenuSection[];
  menuCategories: MenuCategory[];
  tableSections: any[];
  tables: any[];
  settings: any;
  inventoryItems: InventoryItem[];
  users: User[];
  notifications: any[];
  subscriptionStatus: 'active' | 'expired' | 'pending' | 'loading';

  // Auth methods
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshData: () => Promise<void>;
  forceRefreshData: () => Promise<void>;
  resendVerification: (email: string) => Promise<{ success: boolean; message?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; message?: string }>;

  // Data methods
  fetchSessions: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchInventory: () => Promise<void>;
  fetchBills: () => Promise<void>;
  fetchCosts: () => Promise<void>;
  fetchMenuItems: () => Promise<void>;
  fetchAvailableMenuItems: () => Promise<void>; // دالة جديدة لجلب العناصر المتوفرة فقط
  fetchMenuSections: () => Promise<void>;
  fetchMenuCategories: (sectionId?: string) => Promise<void>;
  fetchDevices: () => Promise<void>;
  fetchInventoryItems: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchSettings: () => Promise<void>;

  // CRUD methods
  createSession: (sessionData: any) => Promise<Session | null>;
  updateSession: (id: string, updates: any) => Promise<Session | null>;
  endSession: (id: string, customerName?: string) => Promise<Session | null>;

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
  
  // Menu Sections CRUD methods
  createMenuSection: (sectionData: any) => Promise<MenuSection | null>;
  updateMenuSection: (id: string, updates: any) => Promise<MenuSection | null>;
  deleteMenuSection: (id: string) => Promise<boolean>;
  
  // Menu Categories CRUD methods
  createMenuCategory: (categoryData: any) => Promise<MenuCategory | null>;
  updateMenuCategory: (id: string, updates: any) => Promise<MenuCategory | null>;
  deleteMenuCategory: (id: string) => Promise<boolean>;

  // Table Sections CRUD methods
  fetchTableSections: () => Promise<void>;
  createTableSection: (sectionData: any) => Promise<any>;
  updateTableSection: (id: string, updates: any) => Promise<any>;
  deleteTableSection: (id: string) => Promise<boolean>;

  // Tables CRUD methods
  fetchTables: (sectionId?: string) => Promise<void>;
  getTableStatus: (id: string) => Promise<{ table: any; hasUnpaidOrders: boolean; orders: Order[]; bills?: Bill[] } | null>;
  createTable: (tableData: any) => Promise<any>;
  updateTable: (id: string, updates: any) => Promise<any>;
  deleteTable: (id: string) => Promise<boolean>;

  // User CRUD methods
  createUser: (userData: any) => Promise<User | null>;
  updateUser: (id: string, updates: any) => Promise<User | null>;
  deleteUser: (id: string) => Promise<boolean>;

  // Utility methods
  showNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

  // New methods
  updateOrderItemPrepared: (orderId: string, itemIndex: number, data: { preparedCount: number }) => Promise<Order | null>;
  updateOrderStatus: (orderId: string, status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled') => Promise<Order | null>;
  getRecentActivity: (limit?: number) => Promise<any[]>;

  // Report methods
  getSalesReport: (filter: any, groupBy?: string) => Promise<any>;
  getSessionsReport: (filter: any, device?: string) => Promise<any>;
  getInventoryReport: (category?: string) => Promise<any>;
  getFinancialReport: (filter: any) => Promise<any>;

  // Notification methods
  getNotifications: (options?: { category?: string; unreadOnly?: boolean; limit?: number }) => Promise<Notification[]>;
  getNotificationStats: () => Promise<unknown>;
  markNotificationAsRead: (notificationId: string) => Promise<boolean>;
  markAllNotificationsAsRead: () => Promise<boolean>;
  deleteNotification: (notificationId: string) => Promise<boolean>;
  createNotification: (notificationData: any) => Promise<any>;
  sendNotificationToRole: (role: string, notificationData: any) => Promise<any>;
  sendNotificationToPermission: (permission: string, notificationData: any) => Promise<any>;
  broadcastNotification: (notificationData: any) => Promise<any>;
  forceRefreshNotifications: () => Promise<void>;

  // Export functions
  exportReportToExcel: (reportType: string, filter: Filter) => Promise<void>;
  exportReportToPDF: (reportType: string, filter: Filter) => Promise<void>;

  // Settings methods
  updateUserProfile: (profileData: any) => Promise<boolean>;
  changePassword: (passwordData: any) => Promise<boolean>;
  updateNotificationSettings: (settings: any) => Promise<boolean>;
  updateGeneralSettings: (settings: any) => Promise<boolean>;
}

export type Filter = {
  period?: 'today' | 'yesterday' | 'week' | 'month' | 'year';
  type?: 'daily' | 'monthly' | 'yearly';
  day?: string; // YYYY-MM-DD
  month?: string; // YYYY-MM
  year?: string; // YYYY
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationType | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Data state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [tableSections, setTableSections] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  // دالة لجلب حالة الاشتراك من السيرفر
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'expired' | 'pending' | 'loading'>('loading');

  const navigate = useNavigate();
  const firstLoginRef = useRef(true);

  // Force logout and redirect if token is missing (session expired or refresh failed)
  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('token'); // إصلاح الخطأ: تعريف المتغير
      const path = window.location.pathname;
      // استثناء صفحة التفعيل وصفحة الفاتورة وصفحة إعادة تعيين كلمة المرور وصفحة التسجيل من أي redirect
      const isVerifyEmail = path.startsWith('/verify-email');
      const isBillView = /^\/bill\/[a-fA-F0-9]{24}$/.test(path);
      const isResetPassword = path.startsWith('/reset-password');
      const isRegister = path === '/register';
      const isEmailActions = path.startsWith('/email-actions');
      const isLogin = path === '/login';

      // إذا كان المستخدم في صفحة تسجيل الدخول، لا تقم بإعادة التوجيه
      if (isLogin) {
        return;
      }

      if (!token && !isVerifyEmail && !isBillView && !isResetPassword && !isRegister && !isEmailActions) {
        setUser(null);
        setIsAuthenticated(false);
        setSessions([]);
        setOrders([]);
        setInventory([]);
        setBills([]);
        setCosts([]);
        navigate('/login', { replace: true });
      }
    };

    // تأخير أول فحص للتوكن لضمان عدم التداخل مع عملية تسجيل الدخول
    const initialDelay = setTimeout(checkToken, 2000);
    const interval = setInterval(checkToken, 3000); // تقليل التكرار إلى كل 3 ثوانٍ

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [navigate]);

  // Check authentication on app load
  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isLoggingOut) return;

    const fetchSubscription = async () => {
      try {
        setSubscriptionStatus('loading');
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/billing/subscription/status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await res.json();
        if (data.status === 'active') setSubscriptionStatus('active');
        else setSubscriptionStatus('expired');
      } catch {
        if (!isAuthenticated || isLoggingOut) return;
        setSubscriptionStatus('expired');
      }
    };
    fetchSubscription();
  }, [isAuthenticated, isLoggingOut]);

  useEffect(() => {
    // تم تعطيل التوجيه التلقائي لصفحة الاشتراكات، النظام مجاني حالياً
    // if (subscriptionStatus === 'expired') {
    //   navigate('/subscription');
    // }
  }, [subscriptionStatus, navigate]);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        let response = await api.getMe();
        if (response.success && response.data?.user) {
          setUser(response.data.user);
          setIsAuthenticated(true);
          await refreshData();
        } else if (response.message && (response.message.includes('توكن غير صالح') || response.message.includes('انتهت صلاحية الجلسة'))) {
          // محاولة تجديد التوكن تلقائياً
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const refreshRes = await api.refreshToken(refreshToken);
              if (refreshRes.success && refreshRes.data?.token) {
                localStorage.setItem('token', refreshRes.data.token);
                if (refreshRes.data.refreshToken) {
                  localStorage.setItem('refreshToken', refreshRes.data.refreshToken);
                }
                api.setToken(refreshRes.data.token);
                // أعد محاولة getMe بعد التجديد
                response = await api.getMe();
                if (response.success && response.data?.user) {
                  setUser(response.data.user);
                  setIsAuthenticated(true);
                  await refreshData();
                  setIsLoading(false);
                  return;
                }
              }
            } catch (refreshError) {
              // تجاهل الأخطاء
            }
          }
          // إذا فشل التجديد أو لم يوجد refreshToken
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          api.clearToken();
          setUser(null);
          setIsAuthenticated(false);
          showNotification('انتهت صلاحية الجلسة، يرجى تسجيل الدخول من جديد', 'error');
          navigate('/login', { replace: true });
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          api.clearToken();
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        // لا يوجد توكن، تأكد من أن الحالة صحيحة
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      api.clearToken();
      setUser(null);
      setIsAuthenticated(false);
      showNotification('انتهت صلاحية الجلسة، يرجى تسجيل الدخول من جديد', 'error');
      navigate('/login', { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  // Utility function to update notification count
  const updateNotificationCount = (increment: number = 0) => {
    const badge = document.querySelector('.notification-badge') as HTMLElement;
    if (badge) {
      const currentCount = parseInt(badge.textContent || '0');
      const newCount = Math.max(0, currentCount + increment);
      badge.textContent = newCount > 99 ? '99+' : newCount.toString();
      badge.style.display = newCount > 0 ? 'flex' : 'none';
    }
  };

  // Auth methods
  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await api.login(email, password);
      const user = response.data?.user;
      const token = response.data?.token;
      if (response.success && user && token) {
        localStorage.setItem('token', token);
        api.setToken(token);
        setUser(user);
        setIsAuthenticated(true);
        await refreshData();
        // رسالة ترحيب فقط عند تسجيل الدخول وليس عند reload
        if (firstLoginRef.current) {
          showNotification(`مرحباً بك يا ${user.name}!`, 'success');
          firstLoginRef.current = false;
        }
        return { success: true };
      }
      // لا تعرض إشعار للخطأ، فقط أعد الرسالة للعرض في النموذج
      return { success: false, message: response.message || 'بيانات الدخول غير صحيحة' };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return { success: false, message: err.message || 'فشل في تسجيل الدخول' };
    }
  };

  const resendVerification = async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await api.resendVerification(email);
      return { success: response.success, message: response.message };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return { success: false, message: err.message || 'فشل في إعادة إرسال رابط التفعيل' };
    }
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await api.forgotPassword(email);
      return { success: response.success, message: response.message };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return { success: false, message: err.message || 'فشل في طلب إعادة تعيين كلمة المرور' };
    }
  };

  const resetPassword = async (token: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await api.resetPassword(token, password);
      return { success: response.success, message: response.message };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return { success: false, message: err.message || 'فشل في إعادة تعيين كلمة المرور' };
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoggingOut(true); // منع أي استدعاءات API أثناء تسجيل الخروج

    // إيقاف جميع الـ intervals أولاً
    const intervals = window.setInterval(() => {}, 999999);
    for (let i = 1; i <= intervals; i++) {
      window.clearInterval(i);
    }

    const token = localStorage.getItem('token');
    if (token) {
      try {
        await api.logout();
      } catch {
        // تجاهل أي خطأ (401 أو غيره)
      }
    }

    // مسح التوكن من localStorage و API
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    api.clearToken();

    // إعادة تعيين جميع الحالات
    setUser(null);
    setIsAuthenticated(false);
    setSessions([]);
    setOrders([]);
    setInventory([]);
    setBills([]);
    setCosts([]);
    setDevices([]);
    setMenuItems([]);
    setInventoryItems([]);
    setUsers([]);
    setNotifications([]);
    setSettings(null);
    setError(null);
    setNotification(null);

    // إعادة توجيه إلى صفحة تسجيل الدخول
    navigate('/login', { replace: true });
    showNotification('تم تسجيل الخروج بنجاح', 'info');

    setIsLoggingOut(false); // إعادة تعيين العلم
  };

  // Data fetching methods
  const fetchSessions = async (): Promise<void> => {
    // Skip if not authenticated or logging out
    if (!isAuthenticated || isLoggingOut) return;
    
    try {
      const response = await api.getActiveSessions();
      if (response.success && response.data) {
        setSessions(response.data);
      } else {
        // إذا لم يكن لديه صلاحية أو فشل الطلب، لا تعرض أي إشعار
        setSessions([]);
      }
    } catch (error) {
      // تجاهل أي خطأ (خاصة 403) ولا تعرض أي إشعار
      // Only log if still authenticated
      if (isAuthenticated && !isLoggingOut) {
        }
      setSessions([]);
    }
  };

  const fetchOrders = async (): Promise<void> => {
    // Skip if not authenticated or logging out
    if (!isAuthenticated || isLoggingOut) return;
    
    try {
      // جلب جميع الطلبات
      const response = await api.getOrders();
      if (response.success && response.data) {
        // فلترة: فقط الطلبات المرتبطة بفواتير غير مدفوعة بالكامل
        const filteredOrders = response.data.filter((order: any) => {
          // إذا لم يكن للطلب فاتورة، نعرضه
          if (!order.bill) return true;
          
          // إذا كانت الفاتورة object، نتحقق من حالتها
          if (typeof order.bill === 'object' && order.bill !== null) {
            const billStatus = order.bill.status;
            // نعرض فقط الطلبات المرتبطة بفواتير غير مدفوعة
            return billStatus !== 'paid' && billStatus !== 'cancelled';
          }
          
          // إذا كانت الفاتورة مجرد ID، نفترض أنها غير مدفوعة
          return true;
        });
        
        setOrders(filteredOrders);
      } else {
        // إذا فشل الطلب، تأكد من أن القائمة فارغة بدلاً من undefined
        setOrders([]);
      }
    } catch (error) {
      // Only log errors if still authenticated
      if (isAuthenticated && !isLoggingOut) {
        console.warn('Failed to fetch orders:', error);
        // تأكد من أن القائمة فارغة بدلاً من undefined
        setOrders([]);
      }
    }
  };

  const fetchInventory = async (): Promise<void> => {
    try {
      const response = await api.getInventoryItems();
      if (response.success && response.data) {
        setInventory(response.data);
      }
    } catch (error) {
      }
  };

  const fetchBills = async (): Promise<void> => {
    // Skip if not authenticated or logging out
    if (!isAuthenticated || isLoggingOut) return;
    
    try {
      // جلب جميع الفواتير بدون حد - لضمان ظهور الفواتير القديمة والطاولات المحجوزة
      // تم إزالة limit: 100 لعرض جميع الفواتير بغض النظر عن التاريخ
      const response = await api.getBills();
      if (response.success && response.data) {
        setBills(response.data);
      } else {
        // إذا فشل الطلب، تأكد من أن القائمة فارغة بدلاً من undefined
        setBills([]);
      }
    } catch (error) {
      // Only log errors if still authenticated
      if (isAuthenticated && !isLoggingOut) {
        console.warn('Failed to fetch bills:', error);
        // تأكد من أن القائمة فارغة بدلاً من undefined
        setBills([]);
      }
    }
  };

  const fetchCosts = async (): Promise<void> => {
    try {
      const response = await api.getCosts();
      if (response.success && response.data) {
        setCosts(response.data);
      }
    } catch (error) {
      }
  };

  const fetchMenuItems = async (): Promise<void> => {
    try {
      // لا نستخدم checkStock في صفحة إدارة المنيو لنعرض جميع العناصر
      const response = await api.getMenuItems();
      if (response.success && response.data) {
        setMenuItems(response.data);
      }
    } catch (error) {
      }
  };

  // دالة جديدة لجلب عناصر القائمة مع التحقق من توفر المخزون للطلبات
  const fetchAvailableMenuItems = async (): Promise<void> => {
    try {
      // استخدام checkStock للتحقق من توفر المخزون في قائمة الطلبات
      const response = await api.getMenuItems({ checkStock: true });
      if (response.success && response.data) {
        setMenuItems(response.data);
      }
    } catch (error) {
      }
  };

  const fetchDevices = async (): Promise<void> => {
    try {
      const response = await api.getDevices();
      if (response.success && response.data) {
        setDevices(response.data);
      }
    } catch (error) {
      }
  };

  const fetchInventoryItems = async (): Promise<void> => {
    try {
      const response = await api.getInventoryItems();
      if (response.success && response.data) {
        setInventoryItems(response.data);
      }
    } catch (error) {
      }
  };

  const fetchUsers = async (): Promise<void> => {
    try {
      const response = await api.getUsers();
      if (response.success && response.data) {
        setUsers(response.data);
      }
    } catch (error) {
      }
  };

  const fetchSettings = async (): Promise<void> => {
    try {
      const response = await api.getAllSettings();
      if (response.success && response.data) {
        setSettings(response.data);
      }
    } catch (error) {
      }
  };

  // Determine if there's activity that requires polling
  const hasActivity = useMemo(() => {
    // Check for active sessions
    const hasActiveSessions = sessions.some(session => session.status === 'active');
    
    // Check for pending orders
    const hasPendingOrders = orders.some(order => 
      order.status === 'pending' || order.status === 'preparing'
    );
    
    return hasActiveSessions || hasPendingOrders;
  }, [sessions, orders]);

  // Check if user can view sessions
  const canViewSessions = user && user.permissions && (
    user.permissions.includes('playstation') ||
    user.permissions.includes('computer') ||
    user.permissions.includes('all')
  );

  // Disable polling temporarily to prevent ERR_INSUFFICIENT_RESOURCES
  // The pages will fetch data manually when needed
  // Smart polling for orders - DISABLED
  // useSmartPolling({
  //   fetchFunction: fetchOrders,
  //   hasActivity,
  //   interval: 30000,
  //   enabled: isAuthenticated && !isLoggingOut
  // });

  // Smart polling for bills - DISABLED
  // useSmartPolling({
  //   fetchFunction: fetchBills,
  //   hasActivity,
  //   interval: 30000,
  //   enabled: isAuthenticated && !isLoggingOut
  // });

  // Smart polling for sessions - DISABLED
  // useSmartPolling({
  //   fetchFunction: fetchSessions,
  //   hasActivity,
  //   interval: 30000,
  //   enabled: isAuthenticated && !isLoggingOut && !!canViewSessions
  // });

  // CRUD methods for sessions
  const createSession = async (sessionData: any): Promise<Session | null> => {
    try {
      const response = await api.createSession(sessionData);
      if (response.success && response.data) {
        const data = response.data as any;
        const session = data.session;
        const bill = data.bill;

        setSessions(prev => [...prev, session]);

        // Add bill to bills list if created
        if (bill) {
          setBills(prev => [...prev, bill]);
          showNotification(`تم بدء جلسة جديدة على ${session.deviceName} - الفاتورة: ${bill.billNumber}`, 'success');
        } else {
          showNotification(`تم بدء جلسة جديدة على ${session.deviceName}`, 'success');
        }

        updateNotificationCount(1);
        return session;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إنشاء الجلسة', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تحديث الجلسة', 'error');
      return null;
    }
  };

  const endSession = async (id: string, customerName?: string): Promise<Session | null> => {
    try {
      const response = await api.endSession(id, customerName);
      if (response.success && response.data) {
        const data = response.data as any;
        const session = data.session;
        const bill = data.bill;

        // Remove the session from active sessions list since it's now completed
        setSessions(prev => prev.filter(s => s.id !== id));

        // Update bill in bills list if exists
        if (bill) {
          setBills(prev => prev.map(b => b.id === bill.id ? bill : b));
          showNotification(`تم إنهاء الجلسة على ${session.deviceName} - إجمالي التكلفة: ${session.finalCost}`, 'success');
        } else {
          showNotification(`تم إنهاء الجلسة على ${session.deviceName} بنجاح`, 'success');
        }

        return session;
      }
      // If response is not successful, throw error
      throw new Error(response.message || 'فشل في إنهاء الجلسة');
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إنهاء الجلسة', 'error');
      throw error; // Re-throw error so calling code knows it failed
    }
  };


  // CRUD methods for orders
  const createOrder = async (orderData: any): Promise<Order | null> => {
    try {
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

      // Ensure table is sent as ObjectId (string format)
      // The table field should already be an ObjectId string from the calling component
      if (orderData.table && typeof orderData.table !== 'string') {
        showNotification('معرف الطاولة غير صحيح', 'error');
        return null;
      }

      const response = await api.createOrder(orderData);

      if (response.success && response.data) {
        const newOrder = response.data;
        // The response should include populated table data
        // Update orders list with the new order
        setOrders(prev => [...prev, newOrder]);
        
        // If the order has a bill, update bills list as well
        if (newOrder.bill) {
          // Fetch bills to get the updated bill with the new order
          await fetchBills();
        }
        
        showNotification(`تم إنشاء طلب جديد: ${newOrder.orderNumber}`, 'success');
        updateNotificationCount(1);
        return newOrder;
      } else {
        const errorMessage = response.message || 'فشل في إنشاء الطلب';
        showNotification(errorMessage, 'error');
        return null;
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إنشاء الطلب', 'error');
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

      // Handle error response from backend
      if (response && !response.success) {
        // Handle detailed inventory insufficiency messages
        if (response.data && Array.isArray(response.data.details) && response.data.details.length > 0) {
          const detailsMessage = response.data.details
            .map(d => `• ${d.name}: المطلوب ${d.required} ${d.unit}، المتوفر ${d.available} ${d.unit}`)
            .join('\n');
          showNotification(`المخزون غير كافي لتحديث الطلب:\n${detailsMessage}`, 'error');
        } else if (response.data && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
          showNotification(`المخزون غير كافي لتحديث الطلب:\n${response.data.errors.join('\n')}`, 'error');
        } else {
          showNotification(response.message || 'حدث خطأ أثناء تحديث الطلب', 'error');
        }
        return null;
      }

      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تحديث الطلب', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تحديث حالة التجهيز', 'error');
      return null;
    }
  };

  const updateOrderStatus = async (orderId: string, status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'): Promise<Order | null> => {
    try {
      const response = await api.updateOrderStatus(orderId, status);
      if (response.success && response.data) {
        setOrders(prev => prev.map(order => order.id === orderId ? response.data! : order));

        const statusMessages = {
          pending: 'تم تحديث حالة الطلب إلى: في الانتظار',
          preparing: 'تم تحديث حالة الطلب إلى: قيد التحضير',
          ready: 'تم تحديث حالة الطلب إلى: جاهز',
          delivered: 'تم تحديث حالة الطلب إلى: تم التسليم',
          cancelled: 'تم إلغاء الطلب'
        };

        showNotification(statusMessages[status], 'success');
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تحديث حالة الطلب', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في حذف الطلب', 'error');
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
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إضافة المنتج', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تحديث المنتج', 'error');
      return null;
    }
  };

  const updateStock = async (id: string, stockData: any): Promise<InventoryItem | null> => {
    try {
      const response = await api.updateStock(id, stockData);
      if (response.success && response.data) {
        setInventory(prev => prev.map(item => item.id === id ? response.data! : item));
        setInventoryItems(prev => prev.map(item => item.id === id ? response.data! : item));

        const { quantity, operation } = stockData;
        const operationText = operation === 'add' ? 'إضافة' : operation === 'subtract' ? 'خصم' : 'تحديث';
        showNotification(`تم ${operationText} ${quantity} وحدة من المخزون بنجاح`, 'success');
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تحديث المخزون', 'error');
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
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إنشاء الفاتورة', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تحديث الفاتورة', 'error');
      return null;
    }
  };

  const addPayment = async (id: string, paymentData: any): Promise<Bill | null> => {
    try {
      const response = await api.addPayment(id, paymentData);
      if (response.success && response.data) {
        setBills(prev => prev.map(bill => bill.id === id ? response.data! : bill));

        const { amount, method } = paymentData;
        const methodText = method === 'cash' ? 'نقداً' : method === 'card' ? 'بطاقة' : method === 'online' ? 'إلكتروني' : method;
        showNotification(`تم إضافة دفعة ${amount} ريال ${methodText} بنجاح`, 'success');
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إضافة الدفعة', 'error');
      return null;
    }
  };

  const cancelBill = async (id: string): Promise<boolean> => {
    try {
      const response = await api.cancelBill(id);

      if (response.success) {
        setBills(prev => {
          const newBills = prev.map(bill =>
            bill.id === id
              ? { ...bill, status: 'cancelled' as const }
              : bill
          );
          return newBills;
        });
        showNotification('تم إلغاء الفاتورة بنجاح', 'success');
        return true;
      } else {
        return false;
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إلغاء الفاتورة', 'error');
      return false;
    }
  };

  const getBillItems = async (id: string): Promise<BillItem[]> => {
    try {
      const response = await api.getBillItems(id);
      return response.success && response.data ? response.data : [];
    } catch (error) {
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تسجيل الدفع الجزئي', 'error');
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
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إضافة التكلفة', 'error');
      return null;
    }
  };

  const updateCost = async (id: string, updates: any): Promise<Cost | null> => {
    try {
      const response = await api.updateCost(id, updates);
      if (response.success && response.data) {
        // تحديث البيانات المحلية مباشرة
        setCosts(prev => prev.map(cost =>
          cost.id === id ? response.data! : cost
        ));
        showNotification('تم تحديث التكلفة بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تحديث التكلفة', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في حذف التكلفة', 'error');
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
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إضافة الجهاز', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تحديث الجهاز', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تحديث حالة الجهاز', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في حذف الجهاز', 'error');
      return false;
    }
  };

  const getDeviceStats = async (): Promise<any> => {
    try {
      const response = await api.getDeviceStats();
      return response.success ? response.data : null;
    } catch (error) {
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
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في إضافة العنصر', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في تحديث العنصر', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في حذف العنصر', 'error');
      return false;
    }
  };

  const getMenuItemsByCategory = async (category: string): Promise<MenuItem[]> => {
    try {
      const response = await api.getMenuItemsByCategory(category);
      return response.success && response.data ? response.data : [];
    } catch (error) {
      return [];
    }
  };

  const getPopularMenuItems = async (limit?: number): Promise<MenuItem[]> => {
    try {
      const response = await api.getPopularMenuItems(limit);
      return response.success && response.data ? response.data : [];
    } catch (error) {
      return [];
    }
  };

  const getMenuStats = async (): Promise<any> => {
    try {
      const response = await api.getMenuStats();
      return response.success ? response.data : null;
    } catch (error) {
      return null;
    }
  };

  // Menu Sections CRUD methods
  const fetchMenuSections = async (): Promise<void> => {
    try {
      const response = await api.getMenuSections();
      if (response.success && response.data) {
        setMenuSections(response.data);
      }
    } catch (error) {
      }
  };

  const createMenuSection = async (sectionData: any): Promise<MenuSection | null> => {
    try {
      const response = await api.createMenuSection(sectionData);
      if (response.success && response.data) {
        await fetchMenuSections();
        showNotification('تم إضافة القسم بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في إضافة القسم', 'error');
      return null;
    }
  };

  const updateMenuSection = async (id: string, updates: any): Promise<MenuSection | null> => {
    try {
      const response = await api.updateMenuSection(id, updates);
      if (response.success && response.data) {
        await fetchMenuSections();
        showNotification('تم تحديث القسم بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في تحديث القسم', 'error');
      return null;
    }
  };

  const deleteMenuSection = async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteMenuSection(id);
      if (response.success) {
        await fetchMenuSections();
        showNotification('تم حذف القسم بنجاح', 'success');
        return true;
      }
      return false;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في حذف القسم', 'error');
      return false;
    }
  };

  // Menu Categories CRUD methods
  const fetchMenuCategories = async (sectionId?: string): Promise<void> => {
    try {
      const response = await api.getMenuCategories(sectionId ? { section: sectionId } : undefined);
      if (response.success && response.data) {
        setMenuCategories(response.data);
      }
    } catch (error) {
      }
  };

  const createMenuCategory = async (categoryData: any): Promise<MenuCategory | null> => {
    try {
      const response = await api.createMenuCategory(categoryData);
      if (response.success && response.data) {
        await fetchMenuCategories();
        showNotification('تم إضافة الفئة بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في إضافة الفئة', 'error');
      return null;
    }
  };

  const updateMenuCategory = async (id: string, updates: any): Promise<MenuCategory | null> => {
    try {
      const response = await api.updateMenuCategory(id, updates);
      if (response.success && response.data) {
        await fetchMenuCategories();
        showNotification('تم تحديث الفئة بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في تحديث الفئة', 'error');
      return null;
    }
  };

  const deleteMenuCategory = async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteMenuCategory(id);
      if (response.success) {
        await fetchMenuCategories();
        showNotification('تم حذف الفئة بنجاح', 'success');
        return true;
      }
      return false;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في حذف الفئة', 'error');
      return false;
    }
  };

  // Table Sections CRUD methods
  const fetchTableSections = async () => {
    try {
      const response = await api.getTableSections();
      if (response.success && response.data) {
        setTableSections(response.data);
      }
    } catch (error) {
      }
  };

  const createTableSection = async (sectionData: any): Promise<any> => {
    try {
      const response = await api.createTableSection(sectionData);
      if (response.success && response.data) {
        await fetchTableSections();
        showNotification('تم إضافة القسم بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في إضافة القسم', 'error');
      return null;
    }
  };

  const updateTableSection = async (id: string, updates: any): Promise<any> => {
    try {
      const response = await api.updateTableSection(id, updates);
      if (response.success && response.data) {
        await fetchTableSections();
        showNotification('تم تحديث القسم بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في تحديث القسم', 'error');
      return null;
    }
  };

  const deleteTableSection = async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteTableSection(id);
      if (response.success) {
        await fetchTableSections();
        showNotification('تم حذف القسم بنجاح', 'success');
        return true;
      }
      return false;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في حذف القسم', 'error');
      return false;
    }
  };

  // Tables CRUD methods
  const fetchTables = async (sectionId?: string) => {
    try {
      const response = await api.getTables(sectionId ? { section: sectionId } : undefined);
      if (response.success && response.data) {
        setTables(response.data);
      }
    } catch (error) {
      }
  };

  const getTableStatus = async (id: string): Promise<{ table: any; hasUnpaidOrders: boolean; orders: Order[]; bills?: Bill[] } | null> => {
    try {
      const response = await api.getTableStatus(id);
      if (response.success && response.data) {
        // Filter bills by table._id === tableId and unpaid status
        const tableBills = bills.filter(bill => 
          bill.table && 
          (bill.table as any)._id === id && 
          bill.status !== 'paid' && 
          bill.status !== 'cancelled'
        );
        
        return {
          ...response.data,
          bills: tableBills
        };
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في جلب حالة الطاولة', 'error');
      return null;
    }
  };

  const createTable = async (tableData: any): Promise<any> => {
    try {
      const response = await api.createTable(tableData);
      
      if (response.success && response.data) {
        await fetchTables();
        showNotification('تم إضافة الطاولة بنجاح', 'success');
        return response.data;
      }
      
      console.warn('⚠️ Frontend: Response not successful:', response);
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('❌ Frontend: Error creating table:', error);
      showNotification(err.message || 'خطأ في إضافة الطاولة', 'error');
      return null;
    }
  };

  const updateTable = async (id: string, updates: any): Promise<any> => {
    try {
      const response = await api.updateTable(id, updates);
      if (response.success && response.data) {
        await fetchTables();
        showNotification('تم تحديث الطاولة بنجاح', 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في تحديث الطاولة', 'error');
      return null;
    }
  };

  const deleteTable = async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteTable(id);
      if (response.success) {
        await fetchTables();
        showNotification('تم حذف الطاولة بنجاح', 'success');
        return true;
      }
      return false;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في حذف الطاولة', 'error');
      return false;
    }
  };

  // User CRUD methods
  const createUser = async (userData: any): Promise<User | null> => {
    try {
      // تمرير businessName و businessType إذا كان الدور owner
      const payload = { ...userData };
      if (userData.role === 'owner') {
        payload.businessName = userData.businessName;
        payload.businessType = userData.businessType;
      } else {
        delete payload.businessName;
        delete payload.businessType;
      }
      const response = await api.createUser(payload);
      if (response.success && response.data) {
        showNotification('تم إضافة المستخدم بنجاح', 'success');
        await fetchUsers();
        updateNotificationCount(1);
        return response.data;
      }
      showNotification(response.message || 'فشل في إضافة المستخدم', 'error');
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إضافة المستخدم', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تحديث المستخدم', 'error');
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في حذف المستخدم', 'error');
      return false;
    }
  };

  // Utility methods
  const forceRefreshData = async (): Promise<void> => {
    if (!isAuthenticated || !user) {
      return;
    }


    
    // إعادة تعيين البيانات أولاً
    setOrders([]);
    setBills([]);
    setSessions([]);
    
    // ثم جلب البيانات مرة أخرى
    await refreshData(0);
  };

  const refreshData = async (retryCount = 0): Promise<void> => {
    if (!isAuthenticated && !user) {
      return;
    }

    try {
      // جلب البيانات الأساسية أولاً
      await Promise.all([
        fetchOrders(),
        fetchBills(),
        fetchSessions(),
        fetchInventory(),
        fetchCosts(),
        fetchDevices(),
        fetchMenuItems(),
        fetchInventoryItems(),
        fetchUsers(),
        fetchSettings(),
      ]);
    } catch (error) {
      console.warn('Error in refreshData:', error);
      
      // إعادة المحاولة مرة واحدة بعد تأخير قصير
      if (retryCount < 1 && isAuthenticated && !isLoggingOut) {
        setTimeout(() => {
          refreshData(retryCount + 1);
        }, 1000);
      }
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void => {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 z-50 p-4 rounded-lg text-white max-w-sm shadow-lg transition-all duration-300 ${
      type === 'success' ? 'bg-green-500' :
      type === 'error' ? 'bg-red-500' :
      type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
    }`;
    toast.textContent = message;

    // Add RTL support
    toast.style.direction = 'rtl';
    toast.style.textAlign = 'right';

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    }, 100);

    setTimeout(() => {
      // Animate out
      toast.style.transform = 'translateX(100%)';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  const getRecentActivity = async (limit?: number): Promise<any[]> => {
    try {
      const response = await api.getRecentActivity(limit);
      return response.success && response.data ? response.data : [];
    } catch (error) {
      return [];
    }
  };

  // Report methods
  const getSalesReport = async (filter: Filter): Promise<any> => {
    try {
      const response = await api.getSalesReport(filter);
      return response.success ? response.data : null;
    } catch (error) {
      return null;
    }
  };

  const getSessionsReport = async (filter: Filter): Promise<any> => {
    try {
      const response = await api.getSessionsReport(filter);
      return response.success ? response.data : null;
    } catch (error) {
      return null;
    }
  };

  const getInventoryReport = async (): Promise<any> => {
    try {
      const response = await api.getInventoryReport();
      return response.success ? response.data : null;
    } catch (error) {
      return null;
    }
  };

  const getFinancialReport = async (filter: Filter): Promise<any> => {
    try {
      const response = await api.getFinancialReport(filter);
      return response.success ? response.data : null;
    } catch (error) {
      return null;
    }
  };

  // Notification methods
  const getNotifications = async (options?: { category?: string; unreadOnly?: boolean; limit?: number }): Promise<Notification[]> => {
    try {
      const response = await api.getNotifications(options);
      return response.success && response.data ? response.data : [];
    } catch (error) {
      return [];
    }
  };

  // دالة تجبر تحديث notifications في الـcontext (مثلاً عند فتح نافذة الإشعارات)
  const forceRefreshNotifications = async (): Promise<void> => {
    const notifs = await getNotifications();
    setNotifications(notifs);
  };

  const getNotificationStats = async (): Promise<unknown> => {
    try {
      const response = await api.getNotificationStats();
      return response.success ? response.data : null;
    } catch (error) {
      return null;
    }
  };

  const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
    try {
      const response = await api.markNotificationAsRead(notificationId);
      if (response.success) {
        // تحديث notifications فوراً
        const notifs = await getNotifications();
        setNotifications(notifs);
      }
      return response.success;
    } catch (error) {
      return false;
    }
  };

  const markAllNotificationsAsRead = async (): Promise<boolean> => {
    try {
      const response = await api.markAllNotificationsAsRead();
      if (response.success) {
        // تحديث notifications فوراً
        const notifs = await getNotifications();
        setNotifications(notifs);
      }
      return response.success;
    } catch (error) {
      return false;
    }
  };

  const deleteNotification = async (notificationId: string): Promise<boolean> => {
    try {
      const response = await api.deleteNotification(notificationId);
      if (response.success) {
        // تحديث notifications فوراً بعد الحذف
        const notifs = await getNotifications();
        setNotifications(notifs);
      }
      return response.success;
    } catch (error) {
      return false;
    }
  };

  // Admin notification methods
  const createNotification = async (notificationData: any): Promise<any> => {
    try {
      const response = await api.createNotification(notificationData);
      if (response.success && response.data) {
        showNotification('تم إنشاء الإشعار بنجاح', 'success');
        // Update notification count in real-time
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إنشاء الإشعار', 'error');
      return null;
    }
  };

  const sendNotificationToRole = async (role: string, notificationData: any): Promise<any> => {
    try {
      const response = await api.sendNotificationToRole(role, notificationData);
      if (response.success && response.data) {
        showNotification(`تم إرسال الإشعار لدور ${role} بنجاح`, 'success');
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إرسال الإشعار', 'error');
      return null;
    }
  };

  const sendNotificationToPermission = async (permission: string, notificationData: any): Promise<any> => {
    try {
      const response = await api.sendNotificationToPermission(permission, notificationData);
      if (response.success && response.data) {
        showNotification(`تم إرسال الإشعار لمن لديهم صلاحية ${permission} بنجاح`, 'success');
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إرسال الإشعار', 'error');
      return null;
    }
  };

  const broadcastNotification = async (notificationData: any): Promise<any> => {
    try {
      const response = await api.broadcastNotification(notificationData);
      if (response.success && response.data) {
        showNotification('تم إرسال الإشعار لجميع المستخدمين بنجاح', 'success');
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في إرسال الإشعار', 'error');
      return null;
    }
  };

  const exportReportToExcel = async (reportType: string, filter: Filter) => {
    try {
      const blob = await api.exportReportToExcel(reportType, filter);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showNotification('تم تصدير التقرير بنجاح', 'success');
    } catch (error) {
      showNotification('فشل في تصدير التقرير', 'error');
    }
  };

  const exportReportToPDF = async (reportType: string, filter: Filter) => {
    try {
      const blob = await api.exportReportToPDF(reportType, filter);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `تقرير_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showNotification('تم تصدير التقرير بنجاح', 'success');
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'فشل في تصدير التقرير', 'error');
    }
  };

  // Settings methods
  const updateUserProfile = async (profileData: any): Promise<boolean> => {
    try {
      const response = await api.updateUserProfile(profileData);
      if (response.success) {
        showNotification('تم تحديث الملف الشخصي بنجاح', 'success');
        return true;
      } else {
        showNotification(response.message || 'فشل في تحديث الملف الشخصي', 'error');
        return false;
      }
    } catch (error) {
      showNotification('فشل في تحديث الملف الشخصي', 'error');
      return false;
    }
  };

  const changePassword = async (passwordData: any): Promise<boolean> => {
    try {
      const response = await api.changePassword(passwordData);
      if (response.success) {
        showNotification('تم تغيير كلمة المرور بنجاح', 'success');
        return true;
      } else {
        showNotification(response.message || 'فشل في تغيير كلمة المرور', 'error');
        return false;
      }
    } catch (error) {
      showNotification('فشل في تغيير كلمة المرور', 'error');
      return false;
    }
  };

  const updateNotificationSettings = async (settings: any): Promise<boolean> => {
    try {
      const response = await api.updateNotificationSettings(settings);
      if (response.success) {
        showNotification('تم حفظ إعدادات الإشعارات بنجاح', 'success');
        return true;
      } else {
        showNotification(response.message || 'فشل في حفظ إعدادات الإشعارات', 'error');
        return false;
      }
    } catch (error) {
      showNotification('فشل في حفظ إعدادات الإشعارات', 'error');
      return false;
    }
  };

  const updateGeneralSettings = async (settings: any): Promise<boolean> => {
    try {
      const response = await api.updateGeneralSettings(settings);
      if (response.success) {
        showNotification('تم حفظ الإعدادات العامة بنجاح', 'success');
        return true;
      } else {
        showNotification(response.message || 'فشل في حفظ الإعدادات العامة', 'error');
        return false;
      }
    } catch (error) {
      showNotification('فشل في حفظ الإعدادات العامة', 'error');
      return false;
    }
  };

  const value: AppContextType = {
    // Auth state
    user,
    isAuthenticated,
    isLoading,
    isLoggingOut,
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
    menuSections,
    menuCategories,
    tableSections,
    tables,
    settings,
    inventoryItems,
    users,
    notifications,
    subscriptionStatus,

    // Auth methods
    login,
    logout,
    refreshData,
    forceRefreshData,
    resendVerification,
    forgotPassword,
    resetPassword,

    // Data methods
    fetchSessions,
    fetchOrders,
    fetchInventory,
    fetchBills,
    fetchCosts,
    fetchMenuItems,
    fetchAvailableMenuItems,
    fetchMenuSections,
    fetchMenuCategories,
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
    createMenuSection,
    updateMenuSection,
    deleteMenuSection,
    createMenuCategory,
    updateMenuCategory,
    deleteMenuCategory,
    fetchTableSections,
    createTableSection,
    updateTableSection,
    deleteTableSection,
    fetchTables,
    getTableStatus,
    createTable,
    updateTable,
    deleteTable,
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
    getFinancialReport,

    // Notification methods
    getNotifications,
    getNotificationStats,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    createNotification,
    sendNotificationToRole,
    sendNotificationToPermission,
    broadcastNotification,
    forceRefreshNotifications,

    // Export functions
    exportReportToExcel,
    exportReportToPDF,

    // Settings methods
    updateUserProfile,
    changePassword,
    updateNotificationSettings,
    updateGeneralSettings,
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

export { AppContext };
