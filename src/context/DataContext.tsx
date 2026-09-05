import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiBase';
import api, { Session, Order, InventoryItem, WarehouseItem, Bill, Cost, Device, MenuItem, MenuSection, MenuCategory, BillItem, User, Table, TableSection } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { setDataActionsRef } from './dataActionsRef';

const toArabicNumbers = (num: number | string): string => {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (digit) => arabicNumbers[parseInt(digit)]);
};

const formatNumber = (num: number | string, lang: string): string => {
  return lang === 'ar' ? toArabicNumbers(num) : String(num);
};

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

export type Filter = {
  period?: 'today' | 'yesterday' | 'week' | 'month' | 'year';
  type?: 'daily' | 'monthly' | 'yearly';
  day?: string;
  month?: string;
  year?: string;
};

interface DataContextType {
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
  warehouseItems: WarehouseItem[];
  users: User[];
  notifications: any[];

  fetchSessions: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchInventory: () => Promise<void>;
  fetchBills: () => Promise<void>;
  fetchCosts: () => Promise<void>;
  fetchDashboardData: () => Promise<void>;
  setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  setTableSections: React.Dispatch<React.SetStateAction<TableSection[]>>;
  fetchMenuItems: () => Promise<void>;
  fetchAvailableMenuItems: () => Promise<void>;
  fetchMenuSections: () => Promise<void>;
  fetchMenuCategories: (sectionId?: string) => Promise<void>;
  fetchDevices: () => Promise<void>;
  fetchInventoryItems: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchWarehouseItems: () => Promise<void>;

  refreshData: () => Promise<void>;
  forceRefreshData: () => Promise<void>;

  createSession: (sessionData: any) => Promise<Session | null>;
  updateSession: (id: string, updates: any) => Promise<Session | null>;
  endSession: (id: string, customerName?: string) => Promise<Session | null>;

  createOrder: (orderData: any) => Promise<Order | null>;
  updateOrder: (id: string, updates: any) => Promise<Order | null>;
  deleteOrder: (id: string) => Promise<boolean>;

  createInventoryItem: (itemData: any) => Promise<InventoryItem | null>;
  updateInventoryItem: (id: string, updates: any) => Promise<InventoryItem | null>;
  updateStock: (id: string, stockData: any) => Promise<InventoryItem | null>;

  createWarehouseItem: (itemData: any) => Promise<WarehouseItem | null>;
  updateWarehouseItem: (id: string, updates: any) => Promise<WarehouseItem | null>;
  updateWarehouseStock: (id: string, stockData: any) => Promise<WarehouseItem | null>;
  transferToInventory: (data: { warehouseItemId: string; inventoryItemId?: string; quantity: number; price?: number; date?: string; reason?: string }) => Promise<boolean>;
  returnToWarehouse: (data: { inventoryItemId: string; warehouseItemId: string; quantity: number; price?: number; date?: string; reason?: string }) => Promise<boolean>;

  createBill: (billData: any) => Promise<Bill | null>;
  updateBill: (id: string, updates: any) => Promise<Bill | null>;
  addPayment: (id: string, paymentData: any) => Promise<Bill | null>;
  cancelBill: (id: string) => Promise<boolean>;
  getBillItems: (id: string) => Promise<BillItem[]>;
  addPartialPayment: (id: string, paymentData: any) => Promise<Bill | null>;
  addPartialPaymentAggregated: (id: string, paymentData: any) => Promise<Bill | null>;
  payForItems: (id: string, paymentData: any) => Promise<Bill | null>;
  paySessionPartial: (id: string, paymentData: any) => Promise<Bill | null>;
  updateBillAggregatedItems: (id: string, data: any) => Promise<Bill | null>;
  deleteBill: (id: string) => Promise<boolean>;

  createCost: (costData: any) => Promise<Cost | null>;
  updateCost: (id: string, updates: any) => Promise<Cost | null>;
  deleteCost: (id: string) => Promise<boolean>;

  createDevice: (deviceData: any) => Promise<Device | null>;
  updateDevice: (id: string, updates: any) => Promise<Device | null>;
  updateDeviceStatus: (id: string, status: string) => Promise<Device | null>;
  deleteDevice: (id: string) => Promise<boolean>;
  getDeviceStats: () => Promise<any>;

  createMenuItem: (itemData: any) => Promise<MenuItem | null>;
  updateMenuItem: (id: string, updates: any) => Promise<MenuItem | null>;
  deleteMenuItem: (id: string) => Promise<boolean>;
  mergeMenuItems: (itemIds: string[], name?: string) => Promise<MenuItem | null>;
  getMenuItemsByCategory: (category: string) => Promise<MenuItem[]>;
  getPopularMenuItems: (limit?: number) => Promise<MenuItem[]>;
  getMenuStats: () => Promise<any>;

  createMenuSection: (sectionData: any) => Promise<MenuSection | null>;
  updateMenuSection: (id: string, updates: any) => Promise<MenuSection | null>;
  deleteMenuSection: (id: string) => Promise<boolean>;

  createMenuCategory: (categoryData: any) => Promise<MenuCategory | null>;
  updateMenuCategory: (id: string, updates: any) => Promise<MenuCategory | null>;
  deleteMenuCategory: (id: string) => Promise<boolean>;

  fetchTableSections: () => Promise<any>;
  createTableSection: (sectionData: any) => Promise<any>;
  updateTableSection: (id: string, updates: any) => Promise<any>;
  deleteTableSection: (id: string) => Promise<boolean>;

  fetchTables: (sectionId?: string) => Promise<any>;
  getTableStatus: (id: string) => Promise<{ table: any; hasUnpaidOrders: boolean; orders: Order[]; bills?: Bill[] } | null>;
  createTable: (tableData: any) => Promise<any>;
  updateTable: (id: string, updates: any) => Promise<any>;
  deleteTable: (id: string) => Promise<boolean>;

  createUser: (userData: any) => Promise<User | null>;
  updateUser: (id: string, updates: any) => Promise<User | null>;
  deleteUser: (id: string) => Promise<boolean>;

  showNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

  updateOrderItemPrepared: (orderId: string, itemIndex: number, data: { preparedCount: number }) => Promise<Order | null>;
  updateOrderStatus: (orderId: string, status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled') => Promise<Order | null>;
  deliverItem: (orderId: string, itemIndex: number) => Promise<Order | null>;
  deliverOrderSection: (orderId: string, sectionId: string) => Promise<Order | null>;
  cancelOrder: (orderId: string, reason?: string) => Promise<Order | null>;
  createSessionWithExistingBill: (sessionData: any) => Promise<Session | null>;
  changeSessionTable: (sessionId: string, newTableId: string, options?: { silent?: boolean }) => Promise<any>;
  linkSessionToTable: (sessionId: string, tableId: string, options?: { silent?: boolean }) => Promise<any>;
  unlinkTableFromSession: (sessionId: string, customerName?: string, options?: { silent?: boolean }) => Promise<any>;
  updateSessionTimes: (sessionId: string, data: { startTime: string; endTime: string }, options?: { silent?: boolean }) => Promise<Session | null>;
  updateSessionStartTime: (sessionId: string, data: { startTime: string }) => Promise<Session | null>;
  updateControllersPeriodTime: (sessionId: string, periodIndex: number, newStartTime: string, newEndTime?: string, options?: { silent?: boolean }) => Promise<Session | null>;
  updateSessionCost: (sessionId: string) => Promise<any>;
  getRecentActivity: (limit?: number) => Promise<any[]>;

  getSalesReport: (filter: Filter, groupBy?: string) => Promise<any>;
  getSessionsReport: (filter: Filter, device?: string) => Promise<any>;
  getInventoryReport: (category?: string) => Promise<any>;
  getFinancialReport: (filter: Filter) => Promise<any>;

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

  exportReportToExcel: (reportType: string, filter: Filter) => Promise<void>;
  exportReportToPDF: (reportType: string, filter: Filter) => Promise<void>;

  updateUserProfile: (profileData: any) => Promise<boolean>;
  changePassword: (passwordData: any) => Promise<boolean>;
  updateNotificationSettings: (settings: any) => Promise<boolean>;
  updateGeneralSettings: (settings: any) => Promise<boolean>;
  getNotificationSettings: () => Promise<any>;
  getGeneralSettings: () => Promise<any>;

  getOrganization: () => Promise<any>;
  updateOrganization: (organizationData: any) => Promise<boolean>;
  updateOrganizationPermissions: (permissions: any) => Promise<boolean>;
  canEditOrganization: () => Promise<any>;
  getAvailableManagers: () => Promise<any>;

  getReportSettings: () => Promise<any>;
  updateReportSettings: (settings: any) => Promise<boolean>;
  canManageReports: () => Promise<any>;
  sendReportNow: () => Promise<boolean>;

  canManagePayroll: () => Promise<any>;
  updatePayrollPermissions: (permissions: any) => Promise<boolean>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser, setIsAuthenticated, setIsLoggingOut, setError: authSetError, setNotification: authSetNotification, setSubscriptionStatus, showNotification } = useAuth();

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
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [notifications, setNotifications] = useState<any[]>([]);

  const isApplyingSettingsRef = useRef(false);

  // Populate the shared ref so AuthProvider can clear data on logout
  useEffect(() => {
    setDataActionsRef({
      clearAllData: () => {
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
        setSettings({});
      },
      setSessions, setOrders, setInventory, setBills, setCosts, setDevices,
      setMenuItems, setInventoryItems, setUsers, setNotifications, setSettings,
      setError: authSetError,
      setNotification: authSetNotification,
    });
  }, []);

  const loadAndApplySettings = async (): Promise<void> => {
    if (!user || !localStorage.getItem('token')) return;
    if (isApplyingSettingsRef.current) return;

    try {
      isApplyingSettingsRef.current = true;

      const generalSettingsResponse = await api.getGeneralSettings();
      if (generalSettingsResponse.success && generalSettingsResponse.data) {
        const { theme, language } = generalSettingsResponse.data;

        if (theme) {
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            localStorage.setItem('darkMode', 'true');
          } else if (theme === 'light') {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('darkMode', 'false');
          } else if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
            localStorage.setItem('darkMode', prefersDark.toString());
          }
        }

        if (language && window.i18n) {
          localStorage.setItem('language', language);

          const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'ps', 'yi', 'sd', 'ug', 'dv', 'ku'];
          const isRTL = rtlLanguages.includes(language);

          document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
          document.body.dir = isRTL ? 'rtl' : 'ltr';
          document.documentElement.lang = language;

          if (window.i18n.language !== language) {
            await window.i18n.changeLanguage(language);
          }
        }
      }

      const orgResponse = await api.getOrganization();
      if (orgResponse.success && orgResponse.data) {
        const { currency, timezone } = orgResponse.data;
        if (currency) localStorage.setItem('organizationCurrency', currency);
        if (timezone) localStorage.setItem('organizationTimezone', timezone);
      }
    } catch (error) {
      console.error('loadAndApplySettings: Error loading and applying settings:', error);
    } finally {
      setTimeout(() => {
        isApplyingSettingsRef.current = false;
      }, 1000);
    }
  };

  useEffect(() => {
    loadAndApplySettings();
  }, [user]);

  const clearData = () => {
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
  };

  const updateNotificationCount = (increment: number = 0) => {
    const badge = document.querySelector('.notification-badge') as HTMLElement;
    if (badge) {
      const currentCount = parseInt(badge.textContent || '0');
      const newCount = Math.max(0, currentCount + increment);
      badge.textContent = newCount > 99 ? '99+' : newCount.toString();
      badge.style.display = newCount > 0 ? 'flex' : 'none';
    }
  };

  // Data fetching methods
  const fetchSessions = async (): Promise<void> => {
    if (!user) return;

    try {
      const response = await api.getActiveSessions();
      if (response.success && response.data) {
        setSessions(response.data);
      } else {
        setSessions([]);
      }
    } catch (error) {
      setSessions([]);
    }
  };

  const fetchOrders = async (): Promise<void> => {
    if (!user) return;

    try {
      const response = await api.getOrders();
      if (response.success && response.data) {
        const filteredOrders = response.data.filter((order: any) => {
          if (!order.bill) return true;
          if (typeof order.bill === 'object' && order.bill !== null) {
            const billStatus = order.bill.status;
            return billStatus !== 'paid' && billStatus !== 'cancelled';
          }
          return true;
        });

        setOrders(filteredOrders);
      } else {
        setOrders([]);
      }
    } catch (error) {
      if (user) {
        console.warn('Failed to fetch orders:', error);
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
    if (!user) return;

    try {
      const response = await api.getBills({ all: true, limit: 10000, fresh: true });
      if (response.success && response.data) {
        setBills(response.data);
      } else {
        setBills([]);
      }
    } catch (error) {
      if (user) {
        console.warn('Failed to fetch bills:', error);
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
      const response = await api.getMenuItems();
      if (response.success && response.data) {
        setMenuItems(response.data);
      }
    } catch (error) {
    }
  };

  const fetchAvailableMenuItems = async (): Promise<void> => {
    try {
      const response = await api.getMenuItems({ checkStock: false });
      if (response.success && response.data) {
        setMenuItems(response.data);
      }
    } catch (error) {
      console.error('Error fetching menu items:', error);
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

  const fetchWarehouseItems = async (): Promise<void> => {
    try {
      const response = await api.getWarehouseItems();
      if (response.success && response.data) {
        setWarehouseItems(response.data);
      }
    } catch (error) {
    }
  };

  const createWarehouseItem = async (itemData: any): Promise<WarehouseItem | null> => {
    try {
      const response = await api.createWarehouseItem(itemData);
      if (response.success && response.data) {
        setWarehouseItems(prev => [...prev, response.data!]);
        showNotification(t('toast.inventory.added'), 'success');
        return response.data;
      }
      showNotification(response.message || t('toast.inventory.addError'), 'error');
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.inventory.addError'), 'error');
      return null;
    }
  };

  const updateWarehouseItem = async (id: string, updates: any): Promise<WarehouseItem | null> => {
    try {
      const response = await api.updateWarehouseItem(id, updates);
      if (response.success && response.data) {
        setWarehouseItems(prev => prev.map(item => item.id === id ? response.data! : item));
        showNotification(t('toast.inventory.updated'), 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.inventory.updateError'), 'error');
      return null;
    }
  };

  const updateWarehouseStock = async (id: string, stockData: any): Promise<WarehouseItem | null> => {
    try {
      const response = await api.updateWarehouseStock(id, stockData);
      if (response.success && response.data) {
        setWarehouseItems(prev => prev.map(item => item.id === id ? response.data! : item));
        showNotification(t('toast.inventory.stockUpdated'), 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.inventory.stockError'), 'error');
      return null;
    }
  };

  const transferToInventory = async (data: { warehouseItemId: string; inventoryItemId?: string; quantity: number; price?: number; date?: string; reason?: string }): Promise<boolean> => {
    try {
      const response = await api.transferToInventory(data);
      if (response.success) {
        showNotification(t('toast.inventory.transferred'), 'success');
        await fetchWarehouseItems();
        await fetchInventoryItems();
        return true;
      }
      showNotification(response.message || t('toast.inventory.transferError'), 'error');
      return false;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.inventory.transferError'), 'error');
      return false;
    }
  };

  const returnToWarehouse = async (data: { inventoryItemId: string; warehouseItemId: string; quantity: number; price?: number; date?: string; reason?: string }): Promise<boolean> => {
    try {
      const response = await api.returnToWarehouse(data);
      if (response.success) {
        showNotification(t('toast.inventory.returned'), 'success');
        await fetchInventoryItems();
        await fetchWarehouseItems();
        return true;
      }
      showNotification(response.message || t('toast.inventory.returnError'), 'error');
      return false;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.inventory.returnError'), 'error');
      return false;
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

  const createSession = async (sessionData: any): Promise<Session | null> => {
    // ⚡ إدراج متفائل فوري: الجلسة والطاولة يتحدثان لحظياً قبل رد السيرفر.
    let tempId: string | null = null;
    try {
      tempId = `temp-session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimistic: any = {
        ...sessionData,
        _id: tempId,
        id: tempId,
        deviceName: sessionData.deviceName,
        deviceType: sessionData.deviceType,
        status: 'active',
        startTime: sessionData.startTime || new Date(),
        _optimistic: true,
      };
      setSessions(prev => [optimistic, ...prev]);
      const tempTableId = sessionData.table
        ? String((sessionData.table as any)?._id || (sessionData.table as any)?.id || sessionData.table)
        : null;
      if (tempTableId) {
        setTables(prev => prev.map((table: any) =>
          String(table._id || table.id) === tempTableId ? { ...table, status: 'occupied' } : table
        ));
      }
      const response = await api.createSession(sessionData);
      if (response.success && response.data) {
        const data = response.data as any;
        const session = data.session;
        const bill = data.bill;

        setSessions(prev => {
          const without = tempId ? prev.filter((s: any) => String(s._id || s.id) !== String(tempId)) : prev;
          const sid = String(session._id || session.id);
          const exists = without.some((s: any) => String(s._id || s.id) === sid);
          return exists
            ? without.map((s: any) => String(s._id || s.id) === sid ? { ...s, ...session } : s)
            : [session, ...without];
        });

        if (bill) {
          setBills(prev => {
            const bid = String(bill._id || bill.id);
            const exists = prev.some((b: any) => String(b._id || b.id) === bid);
            return exists
              ? prev.map((b: any) => String(b._id || b.id) === bid ? { ...b, ...bill } : b)
              : [bill, ...prev];
          });
          if (session.table) {
            const tid = String((session.table as any)?._id || (session.table as any)?.id || session.table);
            setTables(prev => prev.map((table: any) =>
              String(table._id || table.id) === tid ? { ...table, status: 'occupied' } : table
            ));
          }
          showNotification(t('toast.session.startedWithBill', { deviceName: session.deviceName, billNumber: bill.billNumber }), 'success');
        } else {
          showNotification(t('toast.session.started', { deviceName: session.deviceName }), 'success');
        }

        updateNotificationCount(1);
        return session;
      }
      if (tempId) setSessions(prev => prev.filter((s: any) => String(s._id || s.id) !== String(tempId)));
      // مسار الفشل نادر: صحح حالة الطاولة من السيرفر في الخلفية دون حجب الواجهة.
      try { void fetchTables(); } catch {}
      return null;
    } catch (error: unknown) {
      if (tempId) setSessions(prev => prev.filter((s: any) => String(s._id || s.id) !== String(tempId)));
      try { void fetchTables(); } catch {}
      const err = error as { message?: string };
      showNotification(err.message || t('toast.session.createError'), 'error');
      return null;
    }
  };

  const updateSession = async (id: string, updates: any): Promise<Session | null> => {
    // ⚡ تحديث متفائل فوري مع استرجاع عند الفشل.
    let snapshot: any = null;
    try {
      setSessions(prev => {
        snapshot = prev.find((s: any) => String(s._id || s.id) === String(id)) || null;
        return prev.map(session =>
          String((session as any)._id || (session as any).id) === String(id) ? { ...session, ...updates } : session
        );
      });
      const response = await api.updateSession(id, updates);
      if (response.success && response.data) {
        setSessions(prev => prev.map(session =>
          String((session as any)._id || (session as any).id) === String(id) ? response.data! : session
        ));
        showNotification(t('toast.session.updated'), 'success');
        return response.data;
      }
      if (snapshot) setSessions(prev => prev.map(session =>
        String((session as any)._id || (session as any).id) === String(id) ? snapshot : session
      ));
      return null;
    } catch (error: unknown) {
      if (snapshot) setSessions(prev => prev.map(session =>
        String((session as any)._id || (session as any).id) === String(id) ? snapshot : session
      ));
      const err = error as { message?: string };
      showNotification(err.message || t('toast.session.updateError'), 'error');
      return null;
    }
  };

  const endSession = async (id: string, customerName?: string): Promise<Session | null> => {
    let snapshot: Session[] = [];
    let ended: Session | null = null;
    try {
      setSessions(prev => {
        snapshot = [...prev];
        const found = prev.find((s: any) => String(s._id || s.id) === String(id));
        if (found) ended = found as any;
        return prev.map((s: any) => String(s._id || s.id) === String(id) ? { ...s, status: 'completed', endTime: new Date(), _optimistic: true } as any : s);
      });
      // optimistic bill update: mark session completed inside bill
      setBills(prev => prev.map((b: any) => ({ ...b, sessions: (b.sessions || []).map((s: any) => String(s._id || s.id || s) === String(id) ? { ...(typeof s === 'object' ? s : { _id: s }), status: 'completed', endTime: new Date() } : s) })));
      const response = await api.endSession(id, customerName);
      if (response.success && response.data) {
        const data = response.data as any;
        const session = data.session;
        const bill = data.bill;
        setSessions(prev => prev.filter((s: any) => String(s._id || s.id) !== String(id)));
        // update bills with server bill
        if (bill) {
          setBills(prev => {
            const bid = String(bill._id || bill.id);
            const exists = prev.some((b: any) => String(b._id || b.id) === bid);
            if (exists) return prev.map((b: any) => String(b._id || b.id) === bid ? { ...b, ...bill } : b);
            return [...prev, bill];
          });
          if (bill.table) {
            const tid = String((bill.table as any)?._id || (bill.table as any)?.id || bill.table);
            // keep table occupied until bill paid — but if session ended, table may still be occupied via other sessions/orders
            // socket will correct; optimistic keep occupied
          }
          showNotification(t('toast.session.ended', { deviceName: session.deviceName, cost: session.finalCost }), 'success');
        } else {
          showNotification(t('toast.session.endedSuccess', { deviceName: session.deviceName }), 'success');
        }
        return session;
      }
      // revert on failure
      setSessions(snapshot);
      setBills(prev => prev); // revert bills via re-fetch? For now restore snapshot bills via snapshot fetchBills
      fetchBills().catch(()=>{});
      throw new Error((response as any).message || t('toast.session.endError'));
    } catch (error: unknown) {
      setSessions(snapshot);
      fetchBills().catch(()=>{});
      const err = error as { message?: string };
      showNotification(err.message || t('toast.session.endError'), 'error');
      throw error;
    }
  };
  const createSessionWithExistingBill = async (sessionData: any): Promise<Session | null> => {
    let tempId: string | null = null;
    try {
      tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      const optimistic: any = { _id: tempId, id: tempId, deviceName: sessionData.deviceName, deviceType: sessionData.deviceType, status: 'active', startTime: new Date(), controllers: sessionData.controllers || 1, _optimistic: true, bill: sessionData.billId };
      setSessions(prev => [optimistic, ...prev]);
      const response = await api.createSessionWithExistingBill(sessionData);
      if (response.success && response.data) {
        const data = response.data as any;
        const session = data.session;
        const bill = data.bill;
        setSessions(prev => {
          const without = prev.filter((s: any) => String(s._id || s.id) !== String(tempId));
          const exists = without.some((s: any) => String(s._id || s.id) === String(session._id || session.id));
          if (exists) return without.map((s: any) => String(s._id || s.id) === String(session._id || session.id) ? { ...s, ...session } : s);
          return [session, ...without];
        });
        if (bill) setBills(prev => prev.map((b: any) => String(b._id || b.id) === String(bill._id || bill.id) ? { ...b, ...bill } : b));
        showNotification(t('toast.session.startedWithBill', { deviceName: session.deviceName, billNumber: bill?.billNumber || '' }), 'success');
        return session;
      }
      if (tempId) setSessions(prev => prev.filter((s: any) => String(s._id || s.id) !== String(tempId)));
      return null;
    } catch (e: unknown) {
      if (tempId) setSessions(prev => prev.filter((s: any) => String(s._id || s.id) !== String(tempId)));
      const err = e as { message?: string };
      showNotification(err.message || t('toast.session.createError'), 'error');
      return null;
    }
  };
  const changeSessionTable = async (sessionId: string, newTableId: string, options?: { silent?: boolean }): Promise<any> => {
    const silent = options?.silent === true;
    let snapSessions: Session[] = [];
    let snapBills: Bill[] = [];
    let snapTables: any[] = [];
    try {
      setSessions(prev => { snapSessions = [...prev]; return prev.map((s: any) => String(s._id || s.id) === String(sessionId) ? { ...s, table: newTableId, _optimistic: true } : s); });
      setBills(prev => { snapBills = [...prev]; return prev.map((b: any) => ({ ...b, sessions: (b.sessions || []).map((s: any) => String(s._id || s.id || s) === String(sessionId) ? { ...(typeof s === 'object' ? s : { _id: s }), table: newTableId } : s) })); });
      setTables(prev => { snapTables = [...prev]; return prev.map((t: any) => String(t._id || t.id) === String(newTableId) ? { ...t, status: 'occupied' } : t); });
      const response = await api.changeSessionTable(sessionId, newTableId);
      if (response.success && response.data) {
        const { session, bill } = response.data as any;
        if (session) setSessions(prev => prev.map((s: any) => String(s._id || s.id) === String(sessionId) ? { ...s, ...session, _optimistic: undefined } : s));
        if (bill) setBills(prev => {
          const bid = String(bill._id || bill.id);
          const exists = prev.some((b: any) => String(b._id || b.id) === bid);
          if (exists) return prev.map((b: any) => String(b._id || b.id) === bid ? { ...b, ...bill } : b);
          return [...prev, bill];
        });
        if (!silent) showNotification('تم نقل الجلسة بنجاح', 'success');
        return response.data;
      }
      setSessions(snapSessions); setBills(snapBills); setTables(snapTables);
      return null;
    } catch (e: unknown) {
      setSessions(snapSessions); setBills(snapBills); setTables(snapTables);
      const err = e as { message?: string };
      if (!silent) showNotification(err.message || 'خطأ في نقل الجلسة', 'error');
      return null;
    }
  };
  const linkSessionToTable = async (sessionId: string, tableId: string, options?: { silent?: boolean }): Promise<any> => {
    const silent = options?.silent === true;
    let snapSessions: Session[] = []; let snapBills: Bill[] = [];
    try {
      setSessions(prev => { snapSessions = [...prev]; return prev.map((s: any) => String(s._id || s.id) === String(sessionId) ? { ...s, table: tableId, _optimistic: true } : s); });
      setBills(prev => { snapBills = [...prev]; return prev; });
      setTables(prev => prev.map((t: any) => String(t._id || t.id) === String(tableId) ? { ...t, status: 'occupied' } : t));
      const response = await api.linkSessionToTable(sessionId, tableId);
      if (response.success && response.data) {
        const { session, bill } = response.data as any;
        if (session) setSessions(prev => prev.map((s: any) => String(s._id || s.id) === String(sessionId) ? { ...s, ...session, _optimistic: undefined } : s));
        if (bill) setBills(prev => {
          const bid = String(bill._id || bill.id);
          const exists = prev.some((b: any) => String(b._id || b.id) === bid);
          if (exists) return prev.map((b: any) => String(b._id || b.id) === bid ? { ...b, ...bill } : b);
          return [...prev, bill];
        });
        if (!silent) showNotification('تم ربط الجلسة بالطاولة', 'success');
        return response.data;
      }
      setSessions(snapSessions); setBills(snapBills);
      return null;
    } catch (e: unknown) {
      setSessions(snapSessions); setBills(snapBills);
      const err = e as { message?: string };
      if (!silent) showNotification(err.message || 'خطأ في ربط الجلسة', 'error');
      return null;
    }
  };
  const unlinkTableFromSession = async (sessionId: string, customerName?: string, options?: { silent?: boolean }): Promise<any> => {
    const silent = options?.silent === true;
    let snapSessions: Session[] = []; let snapBills: Bill[] = [];
    try {
      setSessions(prev => { snapSessions = [...prev]; return prev.map((s: any) => String(s._id || s.id) === String(sessionId) ? { ...s, table: null, customerName: customerName || s.customerName, _optimistic: true } : s); });
      setBills(prev => { snapBills = [...prev]; return prev; });
      const response = await api.unlinkTableFromSession(sessionId, customerName);
      if (response.success && response.data) {
        const { session, bill } = response.data as any;
        if (session) setSessions(prev => prev.map((s: any) => String(s._id || s.id) === String(sessionId) ? { ...s, ...session, _optimistic: undefined } : s));
        if (bill) setBills(prev => {
          const bid = String(bill._id || bill.id);
          const exists = prev.some((b: any) => String(b._id || b.id) === bid);
          if (exists) return prev.map((b: any) => String(b._id || b.id) === bid ? { ...b, ...bill } : b);
          return [...prev, bill];
        });
        if (!silent) showNotification('تم فك ربط الجلسة', 'success');
        return response.data;
      }
      setSessions(snapSessions); setBills(snapBills);
      return null;
    } catch (e: unknown) {
      setSessions(snapSessions); setBills(snapBills);
      const err = e as { message?: string };
      if (!silent) showNotification(err.message || 'خطأ في فك الربط', 'error');
      return null;
    }
  };
  const updateSessionTimes = async (sessionId: string, data: { startTime: string; endTime: string }, options?: { silent?: boolean }): Promise<Session | null> => {
    const silent = options?.silent === true;
    let snapshot: Session[] = [];
    let didOptimistic = false;
    try {
      setSessions(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((s: any) => String(s._id || s.id) === String(sessionId));
        if (idx !== -1) { didOptimistic = true; const copy = [...prev] as any[]; copy[idx] = { ...copy[idx], startTime: new Date(data.startTime), endTime: new Date(data.endTime), _optimistic: true }; return copy; }
        return prev;
      });
      // also update bills sessions nested
      setBills(prev => prev.map((b: any) => ({ ...b, sessions: (b.sessions || []).map((s: any) => String(s._id || s.id || s) === String(sessionId) ? { ...(typeof s === 'object' ? s : { _id: s }), startTime: new Date(data.startTime), endTime: new Date(data.endTime) } : s) })));
      const response = await api.updateSessionTimes(sessionId, data);
      if (response.success && response.data) {
        setSessions(prev => prev.map((s: any) => String(s._id || s.id) === String(sessionId) ? { ...s, ...response.data, _optimistic: undefined } : s));
        const sess = response.data as any;
        if (sess.bill) setBills(prev => prev.map((b: any) => String(b._id || b.id) === String(sess.bill?._id || sess.bill) ? { ...b, sessions: (b.sessions || []).map((ss: any) => String(ss._id || ss.id || ss) === String(sessionId) ? sess : ss) } : b));
        if (!silent) showNotification('تم تعديل أوقات الجلسة', 'success');
        return response.data;
      }
      if (didOptimistic) setSessions(snapshot);
      return null;
    } catch (e: unknown) {
      if (didOptimistic) setSessions(snapshot);
      const err = e as { message?: string };
      if (!silent) showNotification(err.message || 'خطأ في تعديل الوقت', 'error');
      return null;
    }
  };
  const updateSessionStartTime = async (sessionId: string, data: { startTime: string }): Promise<Session | null> => {
    let snapshot: Session[] = [];
    let didOptimistic = false;
    try {
      setSessions(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((s: any) => String(s._id || s.id) === String(sessionId));
        if (idx !== -1) { didOptimistic = true; const copy = [...prev] as any[]; copy[idx] = { ...copy[idx], startTime: new Date(data.startTime), _optimistic: true }; return copy; }
        return prev;
      });
      setBills(prev => prev.map((b: any) => ({ ...b, sessions: (b.sessions || []).map((s: any) => String(s._id || s.id || s) === String(sessionId) ? { ...(typeof s === 'object' ? s : { _id: s }), startTime: new Date(data.startTime) } : s) })));
      const response = await api.updateSessionStartTime(sessionId, data);
      if (response.success && response.data) {
        setSessions(prev => prev.map((s: any) => String(s._id || s.id) === String(sessionId) ? { ...s, ...response.data, _optimistic: undefined } : s));
        showNotification('تم تعديل وقت البداية', 'success');
        return response.data;
      }
      if (didOptimistic) setSessions(snapshot);
      return null;
    } catch (e: unknown) {
      if (didOptimistic) setSessions(snapshot);
      const err = e as { message?: string };
      showNotification(err.message || 'خطأ في تعديل الوقت', 'error');
      return null;
    }
  };
  const updateControllersPeriodTime = async (sessionId: string, periodIndex: number, newStartTime: string, newEndTime?: string, options?: { silent?: boolean }): Promise<Session | null> => {
    const silent = options?.silent === true;
    let snapshot: Session[] = [];
    let didOptimistic = false;
    try {
      setSessions(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((s: any) => String(s._id || s.id) === String(sessionId));
        if (idx !== -1 && Array.isArray((prev[idx] as any).controllersHistory)) {
          didOptimistic = true;
          const copy = [...prev] as any[];
          const sess: any = { ...copy[idx] };
          const hist = [...sess.controllersHistory];
          if (hist[periodIndex]) {
            hist[periodIndex] = { ...hist[periodIndex], from: new Date(newStartTime), ...(newEndTime ? { to: new Date(newEndTime) } : {}) };
            // also adjust adjacent periods optimistically
            if (periodIndex > 0 && hist[periodIndex - 1]) hist[periodIndex - 1] = { ...hist[periodIndex - 1], to: new Date(newStartTime) };
            if (newEndTime && hist[periodIndex + 1]) hist[periodIndex + 1] = { ...hist[periodIndex + 1], from: new Date(newEndTime) };
            sess.controllersHistory = hist;
            copy[idx] = { ...sess, _optimistic: true };
            return copy;
          }
        }
        return prev;
      });
      const response = await api.updateControllersPeriodTime(sessionId, periodIndex, newStartTime, newEndTime, true);
      if (response.success && response.data) {
        setSessions(prev => prev.map((s: any) => String(s._id || s.id) === String(sessionId) ? { ...s, ...response.data, _optimistic: undefined } : s));
        if (!silent) showNotification('تم تعديل فترة الدراعات', 'success');
        return response.data;
      }
      if (didOptimistic) setSessions(snapshot);
      // if conflict 409, revert and show message
      return null;
    } catch (e: unknown) {
      if (didOptimistic) setSessions(snapshot);
      const err = e as { message?: string };
      if (!silent) showNotification(err.message || 'خطأ في تعديل الفترة', 'error');
      return null;
    }
  };
  const updateSessionCost = async (sessionId: string): Promise<any> => {
    let snapshot: Session[] = [];
    try {
      setSessions(prev => { snapshot = [...prev]; return prev.map((s: any) => String(s._id || s.id) === String(sessionId) ? { ...s, _optimistic: true } : s); });
      const response = await api.updateSessionCost(sessionId);
      if (response.success && response.data) {
        const data: any = response.data;
        setSessions(prev => prev.map((s: any) => String(s._id || s.id) === String(sessionId) ? { ...s, totalCost: data.totalCost, finalCost: data.currentCost, _optimistic: undefined } : s));
        if (data.billUpdated) fetchBills().catch(()=>{});
        return response.data;
      }
      setSessions(snapshot);
      return null;
    } catch (e: unknown) { setSessions(snapshot); const err = e as { message?: string }; showNotification(err.message || 'خطأ في تحديث التكلفة', 'error'); return null; }
  };

  const createOrder = async (orderData: any): Promise<Order | null> => {
    let optimisticId: string | null = null;
    let optimisticOrder: any = null;
    try {
      if (!orderData.customerName || !orderData.items || orderData.items.length === 0) {
        showNotification(t('toast.order.incompleteData'), 'error');
        return null;
      }

      for (const item of orderData.items) {
        if (!item.name || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
          showNotification(t('toast.order.incompleteItems'), 'error');
          return null;
        }
      }

      if (orderData.table && typeof orderData.table !== 'string') {
        showNotification(t('toast.order.invalidTable'), 'error');
        return null;
      }

      // ── Optimistic UI — instant (<100ms) before API response ──
      optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      optimisticOrder = {
        _id: optimisticId,
        id: optimisticId,
        orderNumber: `TMP-${optimisticId.slice(-4)}`,
        status: 'pending',
        items: orderData.items,
        table: orderData.table ? { _id: orderData.table, number: orderData.table } : undefined,
        customerName: orderData.customerName,
        createdAt: new Date(),
        subtotal: orderData.items.reduce((s: number, it: any) => s + (it.price || 0) * (it.quantity || 1), 0),
        _optimistic: true,
      } as any;
      setOrders(prev => [optimisticOrder, ...prev]);

      const response = await api.createOrder(orderData);

      if (response.success && response.data) {
        const newOrder = response.data as any;
        // replace optimistic with real, dedupe
        setOrders(prev => {
          const withoutOptimistic = prev.filter((o: any) => o._id !== optimisticId && o.id !== optimisticId);
          // if socket already inserted real order, replace
          const exists = withoutOptimistic.some((o: any) => o._id === newOrder._id || o.id === newOrder.id || o._id === newOrder.id);
          if (exists) {
            return withoutOptimistic.map((o: any) => (o._id === newOrder._id || o.id === newOrder.id || o._id === newOrder.id || o.id === newOrder._id) ? newOrder : o);
          }
          return [newOrder, ...withoutOptimistic];
        });

        if (newOrder.bill) {
          fetchBills().catch(() => {});
        }

        showNotification(t('toast.order.created', { orderNumber: newOrder.orderNumber }), 'success');
        updateNotificationCount(1);
        return newOrder;
      } else {
        // remove optimistic on any failure
        if (optimisticId) setOrders(prev => prev.filter((o: any) => o._id !== optimisticId && o.id !== optimisticId));
        const responseWithErrors = response as any;
        const currentLang = window.i18n?.language || 'ar';
        if (response.data && typeof response.data === 'object' && 'details' in response.data && Array.isArray((response.data as any).details) && (response.data as any).details.length > 0) {
          const detailsMessage = (response.data as any).details
            .map((d: any) => `${d.name}: ${t('common.required')} ${formatNumber(d.required, currentLang)} ${d.unit}, ${t('common.available')} ${formatNumber(d.available, currentLang)} ${d.unit}`)
            .join('\n');
          showNotification(`${t('toast.order.insufficientStock')}\n\n${detailsMessage}`, 'error');
        } else if (response.data && typeof response.data === 'object' && 'errors' in response.data && Array.isArray((response.data as any).errors) && (response.data as any).errors.length > 0) {
          const errorsArray = (response.data as any).errors;
          const errorsMessage = typeof errorsArray[0] === 'object' && errorsArray[0] !== null
            ? errorsArray.map((e: any) => e.message || e.msg || JSON.stringify(e)).join('\n')
            : errorsArray.join('\n');
          showNotification(`${t('toast.order.insufficientStock')}\n\n${errorsMessage}`, 'error');
        } else if (responseWithErrors.errors && Array.isArray(responseWithErrors.errors) && responseWithErrors.errors.length > 0) {
          const errorsArray = responseWithErrors.errors;
          const errorsMessage = typeof errorsArray[0] === 'object' && errorsArray[0] !== null
            ? errorsArray.map((e: any) => e.message || e.msg || JSON.stringify(e)).join('\n')
            : errorsArray.join('\n');
          showNotification(`${t('toast.order.insufficientStock')}\n\n${errorsMessage}`, 'error');
        } else if (responseWithErrors.details && Array.isArray(responseWithErrors.details) && responseWithErrors.details.length > 0) {
          const detailsMessage = responseWithErrors.details
            .map((d: any) => `${d.name}: ${t('common.required')} ${formatNumber(d.required, currentLang)} ${d.unit}, ${t('common.available')} ${formatNumber(d.available, currentLang)} ${d.unit}`)
            .join('\n');
          showNotification(`${t('toast.order.insufficientStock')}\n\n${detailsMessage}`, 'error');
        } else {
          // remove optimistic on failure (non-exception)
          if (optimisticId) setOrders(prev => prev.filter((o: any) => o._id !== optimisticId && o.id !== optimisticId));
          const errorMessage = response.message || t('toast.order.createError');
          showNotification(errorMessage, 'error');
        }
        return null;
      }
    } catch (error: unknown) {
      // remove optimistic on error
      if (optimisticId) {
        setOrders(prev => prev.filter((o: any) => o._id !== optimisticId && o.id !== optimisticId));
      }
      const err = error as { message?: string; response?: { data?: any } };
      const currentLang = window.i18n?.language || 'ar';

      if (err.response?.data) {
        const errorData = err.response.data;
        if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
          const detailsMessage = errorData.details
            .map((d: any) => `${d.name}: ${t('common.required')} ${formatNumber(d.required, currentLang)} ${d.unit}, ${t('common.available')} ${formatNumber(d.available, currentLang)} ${d.unit}`)
            .join('\n');
          showNotification(`${t('toast.order.insufficientStock')}\n\n${detailsMessage}`, 'error');
        } else if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          const errorsMessage = errorData.errors.join('\n');
          showNotification(`${t('toast.order.insufficientStock')}\n\n${errorsMessage}`, 'error');
        } else {
          showNotification(errorData.message || err.message || t('toast.order.createError'), 'error');
        }
      } else {
        showNotification(err.message || t('toast.order.createError'), 'error');
      }
      return null;
    }
  };

  const updateOrder = async (id: string, updates: any): Promise<Order | null> => {
    let snapshot: Order[] = [];
    let didOptimistic = false;
    try {
      // ── optimistic <50ms ──
      setOrders(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((o: any) => String(o._id || o.id) === String(id));
        if (idx !== -1) {
          didOptimistic = true;
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...updates, _optimistic: true } as any;
          return copy;
        }
        return prev;
      });
      const response = await api.updateOrder(id, updates);
      if (response.success && response.data) {
        setOrders(prev => prev.map((order: any) =>
          String(order._id || order.id) === String(id) ? { ...order, ...response.data, _optimistic: undefined } : order
        ));
        // also update bills if order belongs to a bill — instant cross-collection sync
        if ((response.data as any).bill) {
          setBills(prev => prev.map((b: any) => {
            const bid = (response.data as any).bill?._id || (response.data as any).bill;
            if (String(b._id || b.id) === String(bid)) {
              return { ...b, orders: (b.orders || []).map((o: any) => String(o._id || o.id) === String(id) ? response.data : o) };
            }
            return b;
          }));
        }
        showNotification(t('toast.order.updated'), 'success');
        return response.data;
      }
      if (didOptimistic) setOrders(snapshot);
      if (response && !response.success) {
        const responseWithErrors = response as any;
        const currentLang = window.i18n?.language || 'ar';
        if (response.data && typeof response.data === 'object' && 'details' in response.data && Array.isArray((response.data as any).details) && (response.data as any).details.length > 0) {
          const detailsMessage = (response.data as any).details
            .map((d: any) => `${d.name}: ${t('common.required')} ${formatNumber(d.required, currentLang)} ${d.unit}, ${t('common.available')} ${formatNumber(d.available, currentLang)} ${d.unit}`)
            .join('\n');
          showNotification(`${t('toast.order.insufficientStock')}\n\n${detailsMessage}`, 'error');
        } else if (response.data && typeof response.data === 'object' && 'errors' in response.data && Array.isArray((response.data as any).errors) && (response.data as any).errors.length > 0) {
          const errorsArray = (response.data as any).errors;
          const errorsMessage = typeof errorsArray[0] === 'object' && errorsArray[0] !== null
            ? errorsArray.map((e: any) => e.message || e.msg || JSON.stringify(e)).join('\n')
            : errorsArray.join('\n');
          showNotification(`${t('toast.order.insufficientStock')}\n\n${errorsMessage}`, 'error');
        } else if (responseWithErrors.errors && Array.isArray(responseWithErrors.errors) && responseWithErrors.errors.length > 0) {
          const errorsArray = responseWithErrors.errors;
          const errorsMessage = typeof errorsArray[0] === 'object' && errorsArray[0] !== null
            ? errorsArray.map((e: any) => e.message || e.msg || JSON.stringify(e)).join('\n')
            : errorsArray.join('\n');
          showNotification(`${t('toast.order.insufficientStock')}\n\n${errorsMessage}`, 'error');
        } else if (responseWithErrors.details && Array.isArray(responseWithErrors.details) && responseWithErrors.details.length > 0) {
          const detailsMessage = responseWithErrors.details
            .map((d: any) => `${d.name}: ${t('common.required')} ${formatNumber(d.required, currentLang)} ${d.unit}, ${t('common.available')} ${formatNumber(d.available, currentLang)} ${d.unit}`)
            .join('\n');
          showNotification(`${t('toast.order.insufficientStock')}\n\n${detailsMessage}`, 'error');
        } else {
          showNotification(response.message || t('toast.order.updateError'), 'error');
        }
        return null;
      }

      return null;
    } catch (error: unknown) {
      if (didOptimistic) setOrders(snapshot);
      const err = error as { message?: string };
      showNotification(err.message || t('toast.order.updateError'), 'error');
      return null;
    }
  };

  const updateOrderItemPrepared = async (orderId: string, itemIndex: number, data: { preparedCount: number }): Promise<Order | null> => {
    let snapshot: Order[] = [];
    let didOptimistic = false;
    try {
      setOrders(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((o: any) => String(o._id || o.id) === String(orderId));
        if (idx !== -1) {
          didOptimistic = true;
          const copy = [...prev] as any[];
          const orderCopy: any = { ...copy[idx] };
          if (Array.isArray(orderCopy.items) && orderCopy.items[itemIndex]) {
            const itemsCopy = [...orderCopy.items];
            itemsCopy[itemIndex] = { ...itemsCopy[itemIndex], preparedCount: data.preparedCount };
            orderCopy.items = itemsCopy;
          }
          orderCopy._optimistic = true;
          copy[idx] = orderCopy;
          return copy;
        }
        return prev;
      });
      const response = await api.updateOrderItemPrepared(orderId, itemIndex, data);
      if (response.success && response.data) {
        setOrders(prev => prev.map((order: any) =>
          String(order._id || order.id) === String(orderId) ? { ...order, ...response.data, _optimistic: undefined } : order
        ));
        showNotification(t('toast.order.preparingUpdated'), 'success');
        return response.data;
      }
      if (didOptimistic) setOrders(snapshot);
      return null;
    } catch (error: unknown) {
      if (didOptimistic) setOrders(snapshot);
      const err = error as { message?: string };
      showNotification(err.message || t('toast.order.preparingError'), 'error');
      return null;
    }
  };

  const updateOrderStatus = async (orderId: string, status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'): Promise<Order | null> => {
    let snapshot: Order[] = [];
    let didOptimistic = false;
    try {
      setOrders(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((o: any) => String(o._id || o.id) === String(orderId));
        if (idx !== -1) {
          didOptimistic = true;
          const copy = [...prev] as any[];
          copy[idx] = { ...copy[idx], status, _optimistic: true };
          return copy;
        }
        return prev;
      });
      const response = await api.updateOrderStatus(orderId, status);
      if (response.success && response.data) {
        setOrders(prev => prev.map((order: any) => String(order._id || order.id) === String(orderId) ? { ...order, ...response.data, _optimistic: undefined } : order));
        const statusKey = `toast.order.status${status.charAt(0).toUpperCase() + status.slice(1)}`;
        showNotification(t(statusKey), 'success');
        updateNotificationCount(1);
        return response.data;
      }
      if (didOptimistic) setOrders(snapshot);
      return null;
    } catch (error: unknown) {
      if (didOptimistic) setOrders(snapshot);
      const err = error as { message?: string };
      showNotification(err.message || t('toast.order.statusError'), 'error');
      return null;
    }
  };

  const deleteOrder = async (id: string): Promise<boolean> => {
    let snapshot: Order[] = [];
    let deleted: Order | null = null;
    try {
      setOrders(prev => {
        snapshot = [...prev];
        const found = prev.find((o: any) => String(o._id || o.id) === String(id));
        if (found) deleted = found as any;
        return prev.filter((order: any) => String(order._id || order.id) !== String(id));
      });
      const response = await api.deleteOrder(id);
      if (response && response.success === true) {
        // also remove from bills optimistically
        setBills(prev => prev.map((b: any) => ({ ...b, orders: (b.orders || []).filter((o: any) => String(o._id || o.id || o) !== String(id)) })));
        return true;
      }
      if (deleted) setOrders(snapshot);
      return false;
    } catch (error: unknown) {
      if (deleted) setOrders(snapshot);
      const err = error as { message?: string };
      console.error('Error deleting order:', err);
      return false;
    }
  };

  const deliverItem = async (orderId: string, itemIndex: number): Promise<Order | null> => {
    let snapshot: Order[] = [];
    let didOptimistic = false;
    try {
      setOrders(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((o: any) => String(o._id || o.id) === String(orderId));
        if (idx !== -1 && Array.isArray((prev[idx] as any).items)) {
          didOptimistic = true;
          const copy = [...prev] as any[];
          const oc: any = { ...copy[idx] };
          const items = [...oc.items];
          if (items[itemIndex]) items[itemIndex] = { ...items[itemIndex], deliveredCount: items[itemIndex].quantity, preparedCount: items[itemIndex].quantity };
          oc.items = items;
          // if all items delivered, mark order delivered
          if (items.every((it: any) => (it.deliveredCount || 0) >= (it.quantity || 0))) oc.status = 'delivered';
          copy[idx] = { ...oc, _optimistic: true };
          return copy;
        }
        return prev;
      });
      const response = await api.deliverItem(orderId, itemIndex);
      if (response.success && response.data) {
        setOrders(prev => prev.map((o: any) => String(o._id || o.id) === String(orderId) ? { ...o, ...response.data, _optimistic: undefined } : o));
        return response.data;
      }
      if (didOptimistic) setOrders(snapshot);
      return null;
    } catch (e: unknown) {
      if (didOptimistic) setOrders(snapshot);
      const err = e as { message?: string };
      showNotification(err.message || 'delivery error', 'error');
      return null;
    }
  };
  const deliverOrderSection = async (orderId: string, sectionId: string): Promise<Order | null> => {
    let snapshot: Order[] = [];
    let didOptimistic = false;
    try {
      setOrders(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((o: any) => String(o._id || o.id) === String(orderId));
        if (idx !== -1) {
          didOptimistic = true;
          const copy = [...prev] as any[];
          const oc: any = { ...copy[idx] };
          if (Array.isArray(oc.items)) {
            oc.items = oc.items.map((it: any) => (String(it.section) === String(sectionId) ? { ...it, deliveredCount: it.quantity, preparedCount: it.quantity } : it));
            if (oc.items.every((it: any) => (it.deliveredCount || 0) >= (it.quantity || 0))) oc.status = 'delivered';
          }
          copy[idx] = { ...oc, _optimistic: true };
          return copy;
        }
        return prev;
      });
      const response = await api.deliverOrderSection(orderId, sectionId);
      if (response.success && response.data) {
        setOrders(prev => prev.map((o: any) => String(o._id || o.id) === String(orderId) ? { ...o, ...response.data, _optimistic: undefined } : o));
        return response.data;
      }
      if (didOptimistic) setOrders(snapshot);
      return null;
    } catch (e: unknown) {
      if (didOptimistic) setOrders(snapshot);
      const err = e as { message?: string };
      showNotification(err.message || 'delivery error', 'error');
      return null;
    }
  };
  const cancelOrder = async (orderId: string, reason?: string): Promise<Order | null> => {
    let snapshot: Order[] = [];
    let didOptimistic = false;
    try {
      setOrders(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((o: any) => String(o._id || o.id) === String(orderId));
        if (idx !== -1) {
          didOptimistic = true;
          const copy = [...prev] as any[];
          copy[idx] = { ...copy[idx], status: 'cancelled', _optimistic: true };
          return copy;
        }
        return prev;
      });
      const response = await api.cancelOrder(orderId);
      if (response.success && response.data) {
        setOrders(prev => prev.map((o: any) => String(o._id || o.id) === String(orderId) ? { ...o, ...response.data, _optimistic: undefined } : o));
        return response.data;
      }
      if (didOptimistic) setOrders(snapshot);
      return null;
    } catch (e: unknown) {
      if (didOptimistic) setOrders(snapshot);
      const err = e as { message?: string };
      showNotification(err.message || 'cancel error', 'error');
      return null;
    }
  };

  const createInventoryItem = async (itemData: any): Promise<InventoryItem | null> => {
    try {
      const response = await api.createInventoryItem(itemData);
      if (response.success && response.data) {
        setInventory(prev => [...prev, response.data!]);
        showNotification(t('toast.inventory.added'), 'success');
        updateNotificationCount(1);
        return response.data;
      }
      const responseWithErrors = response as any;
      if (responseWithErrors.errors && Array.isArray(responseWithErrors.errors)) {
        const errorMessages = responseWithErrors.errors.map((e: any) => `${e.field}: ${e.message}`).join('\n');
        showNotification(`${response.message}\n${errorMessages}`, 'error');
      } else {
        showNotification(response.message || t('toast.inventory.addError'), 'error');
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.inventory.addError'), 'error');
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
        showNotification(t('toast.inventory.updated'), 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.inventory.updateError'), 'error');
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
        const operationKey = operation === 'add' ? 'stockAdded' : operation === 'subtract' ? 'stockSubtracted' : 'stockUpdated';
        showNotification(t(`toast.inventory.${operationKey}`, { quantity }), 'success');
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.inventory.stockError'), 'error');
      return null;
    }
  };

  const createBill = async (billData: any): Promise<Bill | null> => {
    try {
      const response = await api.createBill(billData);
      if (response.success && response.data) {
        setBills(prev => [...prev, response.data!]);
        showNotification(t('toast.bill.created'), 'success');
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.bill.createError'), 'error');
      return null;
    }
  };

  const updateBill = async (id: string, updates: any): Promise<Bill | null> => {
    let snapshot: Bill[] = [];
    let didOptimistic = false;
    try {
      setBills(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((b: any) => String(b._id || b.id) === String(id));
        if (idx !== -1) {
          didOptimistic = true;
          const copy = [...prev] as any[];
          copy[idx] = { ...copy[idx], ...updates, _optimistic: true };
          return copy;
        }
        return prev;
      });
      // optimistic table status if table changed
      if (updates.table) {
        setTables(prev => prev.map((t: any) => String(t._id || t.id) === String(updates.table) ? { ...t, status: 'occupied' } : t));
      }
      const response = await api.updateBill(id, updates);
      if (response.success && response.data) {
        setBills(prev => prev.map((bill: any) =>
          String(bill._id || bill.id) === String(id) ? { ...bill, ...response.data, _optimistic: undefined } : bill
        ));
        if ((response.data as any).table) {
          const tid = String((response.data as any).table?._id || (response.data as any).table?.id || (response.data as any).table);
          if (tid) setTables(prev => prev.map((t: any) => String(t._id || t.id) === tid ? { ...t, status: (response.data as any).status === 'paid' || (response.data as any).status === 'cancelled' ? 'empty' : 'occupied' } : t));
        }
        showNotification(t('toast.bill.updated'), 'success');
        return response.data;
      }
      if (didOptimistic) setBills(snapshot);
      return null;
    } catch (error: unknown) {
      if (didOptimistic) setBills(snapshot);
      const err = error as { message?: string };
      showNotification(err.message || t('toast.bill.updateError'), 'error');
      return null;
    }
  };

  const addPayment = async (id: string, paymentData: any): Promise<Bill | null> => {
    let snapshot: Bill[] = [];
    let didOptimistic = false;
    try {
      setBills(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((b: any) => String(b._id || b.id) === String(id));
        if (idx !== -1) {
          didOptimistic = true;
          const copy = [...prev] as any[];
          const b: any = { ...copy[idx] };
          const amt = Number(paymentData.amount || paymentData.paymentAmount || 0);
          b.paid = (Number(b.paid) || 0) + amt;
          b.remaining = Math.max(0, (Number(b.total) || 0) - b.paid);
          if (b.remaining <= 0) b.status = 'paid'; else if (b.paid > 0) b.status = 'partial';
          copy[idx] = { ...b, _optimistic: true };
          return copy;
        }
        return prev;
      });
      const response = await api.addPayment(id, paymentData);
      if (response.success && response.data) {
        setBills(prev => prev.map((bill: any) => String(bill._id || bill.id) === String(id) ? { ...bill, ...response.data, _optimistic: undefined } : bill));
        const { amount, method } = paymentData;
        const methodText = t(`toast.paymentMethods.${method}`, method);
        showNotification(t('toast.bill.paymentAdded', { amount, method: methodText }), 'success');
        updateNotificationCount(1);
        // table status update optimistically
        const tbl = (response.data as any).table;
        if (tbl) {
          const tid = String((tbl as any)._id || (tbl as any).id || tbl);
          setTables(prev => prev.map((t: any) => String(t._id || t.id) === tid ? { ...t, status: (response.data as any).status === 'paid' ? 'empty' : 'occupied' } : t));
        }
        return response.data;
      }
      if (didOptimistic) setBills(snapshot);
      return null;
    } catch (error: unknown) {
      if (didOptimistic) setBills(snapshot);
      const err = error as { message?: string };
      showNotification(err.message || t('toast.bill.paymentError'), 'error');
      return null;
    }
  };

  const cancelBill = async (id: string): Promise<boolean> => {
    let snapshot: Bill[] = [];
    let didOptimistic = false;
    try {
      setBills(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((b: any) => String(b._id || b.id) === String(id));
        if (idx !== -1) {
          didOptimistic = true;
          const copy = [...prev] as any[];
          copy[idx] = { ...copy[idx], status: 'cancelled' as const, _optimistic: true };
          return copy;
        }
        return prev;
      });
      const response = await api.cancelBill(id);
      if (response.success) {
        setBills(prev => prev.map((bill: any) =>
          String(bill._id || bill.id) === String(id) ? { ...bill, status: 'cancelled' as const, _optimistic: undefined } : bill
        ));
        showNotification(t('toast.bill.cancelled'), 'success');
        return true;
      } else {
        if (didOptimistic) setBills(snapshot);
        return false;
      }
    } catch (error: unknown) {
      if (didOptimistic) setBills(snapshot);
      const err = error as { message?: string };
      showNotification(err.message || t('toast.bill.cancelError'), 'error');
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
    let snapshot: Bill[] = [];
    let didOptimistic = false;
    try {
      setBills(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((b: any) => String(b._id || b.id) === String(id));
        if (idx !== -1 && paymentData?.items) {
          didOptimistic = true;
          const copy = [...prev] as any[];
          const b: any = { ...copy[idx] };
          const addAmt = (paymentData.items || []).reduce((s: number, it: any) => s + (Number(it.price || 0) * Number(it.quantity || 0) || 0), 0);
          // fallback: if no price in paymentData.items, estimate via bill items
          b.paid = (Number(b.paid) || 0) + (addAmt || 0);
          b.remaining = Math.max(0, (Number(b.total) || 0) - b.paid);
          if (b.remaining <= 0) b.status = 'paid'; else if (b.paid > 0) b.status = 'partial';
          copy[idx] = { ...b, _optimistic: true };
          return copy;
        } else if (idx !== -1) {
          didOptimistic = true;
          const copy = [...prev] as any[];
          copy[idx] = { ...copy[idx], _optimistic: true };
          return copy;
        }
        return prev;
      });
      const response = await api.addPartialPayment(id, paymentData);
      if (response.success && response.data) {
        setBills(prev => prev.map((bill: any) =>
          String(bill._id || bill.id) === String(id) ? { ...bill, ...response.data, _optimistic: undefined } : bill
        ));
        showNotification(t('toast.bill.partialPayment'), 'success');
        return response.data;
      }
      if (didOptimistic) setBills(snapshot);
      return null;
    } catch (error: unknown) {
      if (didOptimistic) setBills(snapshot);
      const err = error as { message?: string };
      showNotification(err.message || t('toast.bill.partialPaymentError'), 'error');
      return null;
    }
  };
  const addPartialPaymentAggregated = async (id: string, paymentData: any): Promise<Bill | null> => {
    let snapshot: Bill[] = [];
    let didOptimistic = false;
    try {
      setBills(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((b: any) => String(b._id || b.id) === String(id));
        if (idx !== -1) { didOptimistic = true; const copy = [...prev] as any[]; copy[idx] = { ...copy[idx], _optimistic: true }; return copy; }
        return prev;
      });
      const response = await api.addPartialPaymentAggregated(id, paymentData);
      if (response.success && response.data) {
        setBills(prev => prev.map((b: any) => String(b._id || b.id) === String(id) ? { ...b, ...response.data, _optimistic: undefined } : b));
        showNotification(t('toast.bill.partialPayment'), 'success');
        return response.data;
      }
      if (didOptimistic) setBills(snapshot);
      return null;
    } catch (e: unknown) { if (didOptimistic) setBills(snapshot); const err = e as { message?: string }; showNotification(err.message || t('toast.bill.partialPaymentError'), 'error'); return null; }
  };
  const payForItems = async (id: string, paymentData: any): Promise<Bill | null> => {
    let snapshot: Bill[] = [];
    let didOptimistic = false;
    try {
      setBills(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((b: any) => String(b._id || b.id) === String(id));
        if (idx !== -1) { didOptimistic = true; const copy = [...prev] as any[]; copy[idx] = { ...copy[idx], _optimistic: true }; return copy; }
        return prev;
      });
      const response = await api.payForItems(id, paymentData);
      if (response.success && response.data) {
        setBills(prev => prev.map((b: any) => String(b._id || b.id) === String(id) ? { ...b, ...response.data, _optimistic: undefined } : b));
        showNotification(t('toast.bill.partialPayment'), 'success');
        return response.data;
      }
      if (didOptimistic) setBills(snapshot);
      return null;
    } catch (e: unknown) { if (didOptimistic) setBills(snapshot); const err = e as { message?: string }; showNotification(err.message || t('toast.bill.partialPaymentError'), 'error'); return null; }
  };
  const paySessionPartial = async (id: string, paymentData: any): Promise<Bill | null> => {
    let snapshot: Bill[] = [];
    let didOptimistic = false;
    try {
      setBills(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((b: any) => String(b._id || b.id) === String(id));
        if (idx !== -1) { didOptimistic = true; const copy = [...prev] as any[]; const b:any = { ...copy[idx] }; b.paid = (Number(b.paid)||0) + Number(paymentData.amount||0); b.remaining = Math.max(0, (Number(b.total)||0)-b.paid); if (b.remaining<=0) b.status='paid'; else if (b.paid>0) b.status='partial'; copy[idx] = { ...b, _optimistic: true }; return copy; }
        return prev;
      });
      const response = await api.paySessionPartial(id, paymentData);
      if (response.success && response.data) {
        setBills(prev => prev.map((b: any) => String(b._id || b.id) === String(id) ? { ...b, ...response.data, _optimistic: undefined } : b));
        showNotification(t('toast.bill.partialPayment'), 'success');
        return response.data;
      }
      if (didOptimistic) setBills(snapshot);
      return null;
    } catch (e: unknown) { if (didOptimistic) setBills(snapshot); const err = e as { message?: string }; showNotification(err.message || t('toast.bill.partialPaymentError'), 'error'); return null; }
  };
  const updateBillAggregatedItems = async (id: string, data: any): Promise<Bill | null> => {
    let snapshot: Bill[] = [];
    let didOptimistic = false;
    try {
      setBills(prev => {
        snapshot = [...prev];
        const idx = prev.findIndex((b: any) => String(b._id || b.id) === String(id));
        if (idx !== -1) { didOptimistic = true; const copy = [...prev] as any[]; copy[idx] = { ...copy[idx], _optimistic: true }; return copy; }
        return prev;
      });
      const response = await api.updateBillAggregatedItems(id, data);
      if (response.success && response.data) {
        setBills(prev => prev.map((b: any) => String(b._id || b.id) === String(id) ? { ...b, ...response.data, _optimistic: undefined } : b));
        showNotification(t('toast.bill.updated'), 'success');
        return response.data;
      }
      if (didOptimistic) setBills(snapshot);
      return null;
    } catch (e: unknown) { if (didOptimistic) setBills(snapshot); const err = e as { message?: string }; showNotification(err.message || t('toast.bill.updateError'), 'error'); return null; }
  };
  const deleteBill = async (id: string): Promise<boolean> => {
    let snapshot: Bill[] = [];
    let deleted: Bill | null = null;
    try {
      setBills(prev => {
        snapshot = [...prev];
        const found = prev.find((b: any) => String(b._id || b.id) === String(id));
        if (found) deleted = found as any;
        return prev.filter((b: any) => String(b._id || b.id) !== String(id));
      });
      const response = await api.deleteBill(id);
      if (response.success) {
        showNotification(t('toast.bill.deleted') || 'تم حذف الفاتورة', 'success');
        // update tables optimistically to empty if no other unpaid bills for that table
        if ((deleted as any)?.table) {
          const tid = String(((deleted as any).table as any)?._id || ((deleted as any).table as any)?.id || (deleted as any).table);
          setTables(prev => prev.map((t: any) => String(t._id || t.id) === tid ? { ...t, status: 'empty' } : t));
        }
        return true;
      }
      if (deleted) setBills(snapshot);
      return false;
    } catch (e: unknown) { if (deleted) setBills(snapshot); const err = e as { message?: string }; showNotification(err.message || 'delete error', 'error'); return false; }
  };

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
      const response = await api.updateDeviceStatus(id, { status });
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

  const mergeMenuItems = async (itemIds: string[], name?: string): Promise<MenuItem | null> => {
    try {
      const response = await api.mergeMenuItems(itemIds, name);
      if (response.success && response.data) {
        await fetchMenuItems();
        showNotification('تم دمج العناصر بنجاح', 'success');
        return response.data;
      }
      showNotification((response as any).message || 'خطأ في دمج العناصر', 'error');
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في دمج العناصر', 'error');
      return null;
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

  const fetchTableSections = async () => {
    try {
      const response = await api.getTableSections();
      if (response.success && response.data) {
        const normalized = response.data.map((s: any) => ({ ...s, _id: s._id || s.id, id: s._id || s.id }));
        const unique = Array.from(new Map(normalized.filter((s: any) => s.id).map((s: any) => [String(s.id), s])).values());
        setTableSections(unique);
        return unique;
      }
      throw new Error(response.message || 'Failed to load table sections');
    } catch (error) {
      console.error('Failed to load table sections:', error);
      throw error;
    }
  };

  const createTableSection = async (sectionData: any): Promise<any> => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticSection: any = {
      _id: tempId,
      id: tempId,
      name: sectionData.name?.trim() || sectionData.name,
      description: sectionData.description ?? null,
      sortOrder: sectionData.sortOrder ?? 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };
    setTableSections(prev => [...prev, optimisticSection]);
    try {
      const response = await api.createTableSection(sectionData);
      if (response.success && response.data) {
        const real: any = { ...response.data, _id: response.data._id || response.data.id, id: response.data._id || response.data.id };
        setTableSections(prev => {
          if (prev.some((s: any) => String(s._id || s.id) === tempId)) {
            return prev.map((s: any) => String(s._id || s.id) === tempId ? { ...real } : s);
          }
          if (prev.some((s: any) => String(s._id || s.id) === String(real._id || real.id))) {
            return prev.map((s: any) => String(s._id || s.id) === String(real._id || real.id) ? { ...s, ...real } : s).filter((s: any) => String(s._id || s.id) !== tempId);
          }
          return [...prev.filter((s: any) => String(s._id || s.id) !== tempId), real];
        });
        showNotification('تم إضافة القسم بنجاح', 'success');
        return response.data;
      }
      setTableSections(prev => prev.filter((s: any) => String(s._id || s.id) !== tempId));
      showNotification((response as any)?.message || 'خطأ في إضافة القسم', 'error');
      return null;
    } catch (error: unknown) {
      setTableSections(prev => prev.filter((s: any) => String(s._id || s.id) !== tempId));
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في إضافة القسم', 'error');
      return null;
    }
  };

  const updateTableSection = async (id: string, updates: any): Promise<any> => {
    let revertData: any = null;
    setTableSections(prev => {
      const found = prev.find((s: any) => String(s._id || s.id) === String(id));
      if (found) revertData = { ...found };
      return prev.map((s: any) => String(s._id || s.id) === String(id) ? { ...s, ...updates } : s);
    });
    try {
      const response = await api.updateTableSection(id, updates);
      if (response.success && response.data) {
        const real: any = { ...response.data, _id: response.data._id || response.data.id, id: response.data._id || response.data.id };
        setTableSections(prev => prev.map((s: any) => String(s._id || s.id) === String(id) ? { ...s, ...real } : s));
        showNotification('تم تحديث القسم بنجاح', 'success');
        return response.data;
      }
      if (revertData) setTableSections(prev => prev.map((s: any) => String(s._id || s.id) === String(id) ? revertData : s));
      showNotification((response as any)?.message || 'خطأ في تحديث القسم', 'error');
      return null;
    } catch (error: unknown) {
      if (revertData) setTableSections(prev => prev.map((s: any) => String(s._id || s.id) === String(id) ? revertData : s));
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في تحديث القسم', 'error');
      return null;
    }
  };

  const deleteTableSection = async (id: string): Promise<boolean> => {
    let deleted: any = null;
    setTableSections(prev => {
      deleted = prev.find((s: any) => String(s._id || s.id) === String(id));
      return prev.filter((s: any) => String(s._id || s.id) !== String(id));
    });
    try {
      const response = await api.deleteTableSection(id);
      if (response.success) {
        showNotification('تم حذف القسم بنجاح', 'success');
        return true;
      }
      if (deleted) setTableSections(prev => [...prev, deleted]);
      showNotification((response as any)?.message || 'خطأ في حذف القسم', 'error');
      return false;
    } catch (error: unknown) {
      if (deleted) setTableSections(prev => [...prev, deleted]);
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في حذف القسم', 'error');
      return false;
    }
  };

  const fetchTables = async (sectionId?: string) => {
    try {
      const response = await api.getTables(sectionId ? { section: sectionId } : undefined);
      if (response.success && response.data) {
        const uniqueTables = Array.from(
          new Map(
            response.data
              .map((table: any) => ({
                ...table,
                id: table._id || table.id,
              }))
              .filter((table: any) => table.id)
              .map((table: any) => [String(table.id), table])
          ).values()
        );
        setTables(uniqueTables);
        return uniqueTables;
      }
      throw new Error(response.message || 'Failed to load tables');
    } catch (error) {
      console.error('Failed to load tables:', error);
      throw error;
    }
  };

  const getTableStatus = async (id: string): Promise<{ table: any; hasUnpaidOrders: boolean; orders: Order[]; bills?: Bill[] } | null> => {
    try {
      const response = await api.getTableStatus(id);
      if (response.success && response.data) {
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
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticTable: any = {
      _id: tempId,
      id: tempId,
      number: typeof tableData.number === 'string' ? tableData.number.trim() : tableData.number,
      section: tableData.section,
      status: 'empty',
      isActive: true,
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };
    setTables(prev => [...prev, optimisticTable]);
    try {
      const response = await api.createTable(tableData);
      if (response.success && response.data) {
        const real: any = { ...response.data, _id: response.data._id || response.data.id, id: response.data._id || response.data.id };
        // ensure section id is normalized
        setTables(prev => {
          if (prev.some((t: any) => String(t._id || t.id) === tempId)) {
            return prev.map((t: any) => String(t._id || t.id) === tempId ? { ...t, ...real, _optimistic: undefined, id: real._id, _id: real._id } : t);
          }
          const realIdStr = String(real._id || real.id);
          if (prev.some((t: any) => String(t._id || t.id) === realIdStr)) {
            return prev.map((t: any) => String(t._id || t.id) === realIdStr ? { ...t, ...real, _optimistic: undefined } : t).filter((t: any) => String(t._id || t.id) !== tempId);
          }
          // if socket already inserted optimistic replacement via number+section, ensure dedup by filtering temp
          // also handle socket race: remove any remaining temp with same number+section
          const filtered = prev.filter((t: any) => String(t._id || t.id) !== tempId);
          // if there was an optimistic with same number+section still lingering (matching logic in socket), it's already filtered
          return [...filtered, { ...optimisticTable, ...real, _id: real._id, id: real._id, _optimistic: undefined }];
        });
        showNotification('تم إضافة الطاولة بنجاح', 'success');
        return response.data;
      }
      setTables(prev => prev.filter((t: any) => String(t._id || t.id) !== tempId));
      showNotification((response as any)?.message || 'خطأ في إضافة الطاولة', 'error');
      return null;
    } catch (error: unknown) {
      setTables(prev => prev.filter((t: any) => String(t._id || t.id) !== tempId));
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في إضافة الطاولة', 'error');
      return null;
    }
  };

  const updateTable = async (id: string, updates: any): Promise<any> => {
    let revertData: any = null;
    const normalizedUpdates: any = { ...updates };
    if (normalizedUpdates.number !== undefined) {
      normalizedUpdates.number = typeof normalizedUpdates.number === 'string' ? normalizedUpdates.number.trim() : normalizedUpdates.number;
    }
    setTables(prev => {
      const found = prev.find((t: any) => String(t._id || t.id) === String(id));
      if (found) revertData = { ...found };
      return prev.map((t: any) => String(t._id || t.id) === String(id) ? { ...t, ...normalizedUpdates } : t);
    });
    try {
      const response = await api.updateTable(id, updates);
      if (response.success && response.data) {
        const real: any = { ...response.data, _id: response.data._id || response.data.id, id: response.data._id || response.data.id };
        setTables(prev => prev.map((t: any) => String(t._id || t.id) === String(id) ? { ...t, ...real } : t));
        showNotification('تم تحديث الطاولة بنجاح', 'success');
        return response.data;
      }
      if (revertData) setTables(prev => prev.map((t: any) => String(t._id || t.id) === String(id) ? revertData : t));
      showNotification((response as any)?.message || 'خطأ في تحديث الطاولة', 'error');
      return null;
    } catch (error: unknown) {
      if (revertData) setTables(prev => prev.map((t: any) => String(t._id || t.id) === String(id) ? revertData : t));
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في تحديث الطاولة', 'error');
      return null;
    }
  };

  const deleteTable = async (id: string): Promise<boolean> => {
    let deleted: any = null;
    setTables(prev => {
      deleted = prev.find((t: any) => String(t._id || t.id) === String(id));
      return prev.filter((t: any) => String(t._id || t.id) !== String(id));
    });
    try {
      const response = await api.deleteTable(id);
      if (response.success) {
        showNotification('تم حذف الطاولة بنجاح', 'success');
        return true;
      }
      if (deleted) setTables(prev => [...prev, deleted]);
      showNotification((response as any)?.message || 'خطأ في حذف الطاولة', 'error');
      return false;
    } catch (error: unknown) {
      if (deleted) setTables(prev => [...prev, deleted]);
      const err = error as { message?: string };
      showNotification(err.message || 'خطأ في حذف الطاولة', 'error');
      return false;
    }
  };

  const createUser = async (userData: any): Promise<User | null> => {
    try {
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
    } catch (error: any) {
      console.error('Delete user error:', error);

      let errorMessage = 'فشل في حذف المستخدم';

      if (error.response?.status === 403) {
        errorMessage = error.response?.data?.message || 'ليس لديك صلاحية لحذف هذا المستخدم. تحتاج لصلاحية إدارة المستخدمين أو دور مدير.';
      } else if (error.response?.status === 401) {
        errorMessage = 'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.';
      } else if (error.response?.status === 404) {
        errorMessage = 'المستخدم غير موجود أو تم حذفه مسبقاً.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      showNotification(errorMessage, 'error');
      return false;
    }
  };

  const fetchDashboardData = async (): Promise<void> => {
    if (!user) return;
    await Promise.all([
      fetchBills(),
      fetchOrders(),
      fetchSessions(),
      fetchTables(),
    ]);
  };

  const refreshData = async (retryCount = 0): Promise<void> => {
    if (!user) return;

    try {
      await Promise.all([
        fetchOrders(),
        fetchBills(),
        fetchSessions(),
        fetchInventory(),
        fetchCosts(),
        fetchDevices(),
        fetchMenuItems(),
        fetchAvailableMenuItems(),
        fetchMenuSections(),
        fetchMenuCategories(),
        fetchInventoryItems(),
        fetchUsers(),
        fetchSettings(),
      ]);
    } catch (error) {
      console.warn('Error in refreshData:', error);

      if (retryCount < 1 && user) {
        setTimeout(() => {
          refreshData(retryCount + 1);
        }, 1000);
      }
    }
  };

  const forceRefreshData = async (): Promise<void> => {
    if (!user) return;

    setOrders([]);
    setBills([]);
    setSessions([]);


    await refreshData(0);
  };

  // ── Global real-time sync — كل الـ schemas لحظياً (أولوية قصوى + ثانوية) ──
  const globalSocketRef = useRef<Socket | null>(null);
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const debouncedFetch = (key: string, fn: () => void | Promise<void>) => {
    const existing = debounceTimersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const id = setTimeout(() => {
      debounceTimersRef.current.delete(key);
      fn();
    }, 300);
    debounceTimersRef.current.set(key, id);
  };
  // Keep latest fetchers in ref to avoid stale closures
  const fetchersRef = useRef({
    fetchBills, fetchOrders, fetchSessions, fetchInventory, fetchInventoryItems,
    fetchWarehouseItems, fetchMenuItems, fetchAvailableMenuItems, fetchMenuSections,
    fetchMenuCategories, fetchCosts, fetchDevices, fetchTables, fetchTableSections,
    fetchUsers, fetchSettings,
  } as any);
  useEffect(() => {
    fetchersRef.current = {
      fetchBills, fetchOrders, fetchSessions, fetchInventory, fetchInventoryItems,
      fetchWarehouseItems, fetchMenuItems, fetchAvailableMenuItems, fetchMenuSections,
      fetchMenuCategories, fetchCosts, fetchDevices, fetchTables, fetchTableSections,
      fetchUsers, fetchSettings,
    } as any;
  });
  useEffect(() => {
    if (!user) {
      if (globalSocketRef.current) {
        globalSocketRef.current.disconnect();
        globalSocketRef.current = null;
      }
      return;
    }
    if (globalSocketRef.current) return;
    const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');
    const token = localStorage.getItem('token') || undefined;
    const socket: Socket = io(socketUrl, {
      auth: { token },
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 5,
    });
    globalSocketRef.current = socket;

    // Helper to trigger fetch with debounce
    const on = (event: string, key: string, fn: () => void | Promise<void>) => {
      socket.on(event, () => debouncedFetch(key, fn));
    };

    // ── أولوية قصوى: فواتير / طلبات / جلسات / حالة طاولات ──
    on('bill-update', 'bills', () => fetchersRef.current.fetchBills());
    on('payment-received', 'bills', () => fetchersRef.current.fetchBills());
    on('partial-payment-received', 'bills', () => fetchersRef.current.fetchBills());
    on('order-update', 'orders', () => fetchersRef.current.fetchOrders());
    on('new-order', 'orders', () => fetchersRef.current.fetchOrders());
    on('order-ready', 'orders', () => fetchersRef.current.fetchOrders());
    on('session-update', 'sessions', () => fetchersRef.current.fetchSessions());
    on('table-status-update', 'tables', () => fetchersRef.current.fetchTables());
    // المخزون — على كل تعديل (ليس فقط low-stock)
    on('inventory-update', 'inventory', () => {
      debouncedFetch('inventory', () => fetchersRef.current.fetchInventoryItems());
      debouncedFetch('warehouse', () => fetchersRef.current.fetchWarehouseItems());
    });
    on('low-stock-alert', 'inventory', () => fetchersRef.current.fetchInventoryItems());

    // ── ثانوية: أصناف / تكاليف / أجهزة / طاولات / أقسام / إعدادات ──
    on('menu-update', 'menu', () => {
      debouncedFetch('menuItems', () => fetchersRef.current.fetchMenuItems());
      debouncedFetch('availableMenu', () => fetchersRef.current.fetchAvailableMenuItems());
      debouncedFetch('menuSections', () => fetchersRef.current.fetchMenuSections());
      debouncedFetch('menuCategories', () => fetchersRef.current.fetchMenuCategories());
    });
    on('cost-update', 'costs', () => fetchersRef.current.fetchCosts());
    on('device-update', 'devices', () => fetchersRef.current.fetchDevices());
    on('table-update', 'tables', () => fetchersRef.current.fetchTables());
    on('table-section-update', 'tableSections', () => fetchersRef.current.fetchTableSections());
    on('settings-update', 'settings', () => fetchersRef.current.fetchSettings());

    // ── Instant (<100ms) directly mutate state — Orders/Tables real-time ──
    const normalizeId = (id: any) => String(id);
    const onOrderCreated = (order: any) => {
      if (!order) return;
      const oid = order._id || order.id;
      if (!oid) return;
      setOrders(prev => {
        const optimisticIdx = prev.findIndex((o: any) => String(o._id).startsWith('temp-') || (o as any)._optimistic);
        if (optimisticIdx !== -1) {
          const withoutOptimistic = prev.filter((_, i) => i !== optimisticIdx);
          if (withoutOptimistic.some((o: any) => normalizeId(o._id) === normalizeId(oid) || normalizeId(o.id) === normalizeId(oid))) {
            return withoutOptimistic.map((o: any) => (normalizeId(o._id) === normalizeId(oid) || normalizeId(o.id) === normalizeId(oid)) ? { ...o, ...order, id: oid, _id: oid } : o);
          }
          const normalized = { ...order, id: oid, _id: oid };
          const before = withoutOptimistic.slice(0, optimisticIdx);
          const after = withoutOptimistic.slice(optimisticIdx);
          return [...before, normalized, ...after];
        }
        const filtered = prev.filter((o: any) => !String(o._id).startsWith('temp-') || o._id !== oid);
        if (filtered.some((o: any) => normalizeId(o._id) === normalizeId(oid) || normalizeId(o.id) === normalizeId(oid))) {
          return filtered.map((o: any) => (normalizeId(o._id) === normalizeId(oid) || normalizeId(o.id) === normalizeId(oid)) ? { ...o, ...order, id: oid, _id: oid } : o);
        }
        const normalized = { ...order, id: oid, _id: oid };
        return [normalized, ...filtered];
      });
      // ── cross-collection instant sync: bills + tables ──
      try {
        const billId = (order as any).bill?._id || (order as any).bill?.id || (order as any).bill;
        if (billId) {
          setBills(prev => {
            const bid = String(billId);
            const idx = prev.findIndex((b: any) => String(b._id || b.id) === bid);
            if (idx !== -1) {
              const copy = [...prev] as any[];
              const b: any = { ...copy[idx] };
              const ordersArr = Array.isArray(b.orders) ? [...b.orders] : [];
              if (!ordersArr.some((o: any) => String(o._id || o.id || o) === String(oid))) {
                ordersArr.push(order);
                b.orders = ordersArr;
              } else {
                b.orders = ordersArr.map((o: any) => String(o._id || o.id || o) === String(oid) ? order : o);
              }
              copy[idx] = b;
              return copy;
            }
            return prev;
          });
        }
      } catch {}
      try {
        const tid = (order as any).table?._id || (order as any).table?.id || (order as any).table;
        if (tid) setTables(prev => prev.map((t: any) => String(t._id || t.id) === String(tid) ? { ...t, status: 'occupied' } : t));
      } catch {}
    };
    const onOrderUpdated = (order: any) => {
      if (!order || !(order._id || order.id)) return;
      const oid = order._id || order.id;
      setOrders(prev => prev.map((o: any) => (normalizeId(o._id) === normalizeId(oid) || normalizeId(o.id) === normalizeId(oid)) ? { ...o, ...order, id: oid, _id: oid } : o));
      // cross-sync bill
      try {
        const billId = (order as any).bill?._id || (order as any).bill?.id || (order as any).bill;
        if (billId) {
          setBills(prev => prev.map((b: any) => {
            const bid = String(billId);
            if (String(b._id || b.id) !== bid) return b;
            const ordersArr = Array.isArray(b.orders) ? b.orders.map((o: any) => String(o._id || o.id || o) === String(oid) ? order : o) : [order];
            return { ...b, orders: ordersArr };
          }));
        }
      } catch {}
      try {
        const tid = (order as any).table?._id || (order as any).table?.id || (order as any).table;
        if (tid) setTables(prev => prev.map((t: any) => String(t._id || t.id) === String(tid) ? { ...t, status: 'occupied' } : t));
      } catch {}
    };
    const onOrderDeleted = (payload: any) => {
      const oid = payload?._id || payload?.id || payload;
      if (!oid) return;
      setOrders(prev => prev.filter((o: any) => normalizeId(o._id) !== normalizeId(oid) && normalizeId(o.id) !== normalizeId(oid)));
      // cross-sync bill + table
      try {
        setBills(prev => prev.map((b: any) => ({ ...b, orders: (b.orders || []).filter((o: any) => String(o._id || o.id || o) !== String(oid)) })));
      } catch {}
    };
    const onBillUpdated = (bill: any, eventType?: string) => {
      if (!bill) return;
      const bid = bill._id || bill.id;
      if (!bid) {
        if (bill._id) setBills(prev => prev.filter((b: any) => normalizeId(b._id) !== normalizeId(bill._id) && normalizeId(b.id) !== normalizeId(bill._id)));
        return;
      }
      if (eventType === 'deleted') {
        setBills(prev => prev.filter((b: any) => normalizeId(b._id) !== normalizeId(bid) && normalizeId(b.id) !== normalizeId(bid)));
        // table status will be handled via table:statusChanged event; optimistic empty
        try {
          const tbl = (bill as any).table?._id || (bill as any).table?.id || (bill as any).table;
          if (tbl) setTables(prev => prev.map((t: any) => String(t._id || t.id) === String(tbl) ? { ...t, status: 'empty' } : t));
        } catch {}
        return;
      }
      setBills(prev => {
        const exists = prev.some((b: any) => normalizeId(b._id) === normalizeId(bid) || normalizeId(b.id) === normalizeId(bid));
        const normalized = { ...bill, id: bid, _id: bid };
        if (exists) return prev.map((b: any) => (normalizeId(b._id) === normalizeId(bid) || normalizeId(b.id) === normalizeId(bid)) ? { ...b, ...normalized } : b);
        if (bill.status && ['paid','cancelled'].includes(bill.status)) return prev.filter((b: any) => normalizeId(b._id) !== normalizeId(bid));
        return [...prev, normalized];
      });
      // cross-sync tables instantly
      try {
        const tbl = (bill as any).table?._id || (bill as any).table?.id || (bill as any).table;
        if (tbl) {
          const isPaid = bill.status === 'paid' || bill.status === 'cancelled';
          setTables(prev => prev.map((t: any) => String(t._id || t.id) === String(tbl) ? { ...t, status: isPaid ? 'empty' : 'occupied' } : t));
        }
      } catch {}
      // cross-sync orders that belong to this bill — update their bill reference status
      try {
        if (Array.isArray((bill as any).orders)) {
          const orderIds = new Set((bill as any).orders.map((o: any) => String(o._id || o.id || o)));
          setOrders(prev => prev.map((o: any) => orderIds.has(String(o._id || o.id)) ? { ...o, bill: { _id: bid, status: bill.status } } : o));
        }
      } catch {}
    };
    const onTableStatusChanged = (payload: any) => {
      const tid = payload?.tableId || payload?._id || payload?.id;
      const status = payload?.status;
      if (!tid || !status) return;
      setTables(prev => prev.map((t: any) => (normalizeId(t._id) === normalizeId(tid) || normalizeId(t.id) === normalizeId(tid)) ? { ...t, status } : t));
    };
    const getTableSectionIdForMatch = (sec: any): string => {
      if (!sec) return '';
      if (typeof sec === 'object') return String((sec as any)._id || (sec as any).id || '');
      return String(sec);
    };
    const onTableCreated = (table: any) => {
      if (!table || !(table._id || table.id)) return;
      const tid = table._id || table.id;
      const normalized = { ...table, id: tid, _id: tid } as any;
      setTables(prev => {
        if (prev.some((t: any) => normalizeId(t._id || t.id) === normalizeId(tid))) {
          return prev.map((t: any) => normalizeId(t._id || t.id) === normalizeId(tid) ? { ...t, ...normalized } : t);
        }
        // replace optimistic temp with same number+section if exists
        const realNum = String(table.number ?? '').trim();
        const realSec = getTableSectionIdForMatch(table.section);
        const optIdx = prev.findIndex((t: any) => {
          const isOpt = (t as any)._optimistic || String(t._id || t.id).startsWith('temp-');
          if (!isOpt) return false;
          const oNum = String(t.number ?? '').trim();
          const oSec = getTableSectionIdForMatch(t.section);
          return oNum === realNum && oSec === realSec;
        });
        if (optIdx !== -1) {
          const copy = [...prev];
          copy[optIdx] = normalized;
          return copy;
        }
        return [...prev.filter((t: any) => normalizeId(t._id || t.id) !== normalizeId(tid)), normalized];
      });
    };
    const onTableUpdated = (table: any) => {
      if (!table || !(table._id || table.id)) return;
      const tid = table._id || table.id;
      const normalized = { ...table, id: tid, _id: tid } as any;
      setTables(prev => {
        const exists = prev.some((t: any) => normalizeId(t._id || t.id) === normalizeId(tid));
        if (exists) return prev.map((t: any) => normalizeId(t._id || t.id) === normalizeId(tid) ? { ...t, ...normalized } : t);
        // if not found but is an update, treat as create with optimistic check
        const realNum = String(table.number ?? '').trim();
        const realSec = getTableSectionIdForMatch(table.section);
        const optIdx = prev.findIndex((t: any) => {
          const isOpt = (t as any)._optimistic || String(t._id || t.id).startsWith('temp-');
          if (!isOpt) return false;
          return String(t.number ?? '').trim() === realNum && getTableSectionIdForMatch(t.section) === realSec;
        });
        if (optIdx !== -1) {
          const copy = [...prev];
          copy[optIdx] = normalized;
          return copy;
        }
        return [...prev, normalized];
      });
    };
    const onTableCreatedOrUpdated = (table: any) => {
      if (!table || !(table._id || table.id)) return;
      const tid = table._id || table.id;
      if (String(tid).startsWith('temp-')) return;
      // delegate to update logic which handles both
      onTableUpdated(table);
    };
    const onTableDeleted = (payload: any) => {
      const tid = payload?._id || payload?.id || payload;
      if (!tid) return;
      setTables(prev => prev.filter((t: any) => normalizeId(t._id) !== normalizeId(tid) && normalizeId(t.id) !== normalizeId(tid)));
    };
    const onTableSectionCreated = (section: any) => {
      if (!section || !(section._id || section.id)) return;
      const sid = section._id || section.id;
      const normalized = { ...section, id: sid, _id: sid } as any;
      setTableSections(prev => {
        if (prev.some((s: any) => normalizeId(s._id || s.id) === normalizeId(sid))) {
          return prev.map((s: any) => normalizeId(s._id || s.id) === normalizeId(sid) ? { ...s, ...normalized } : s);
        }
        const realName = String(section.name ?? '').trim();
        const optIdx = prev.findIndex((s: any) => ((s as any)._optimistic || String(s._id || s.id).startsWith('temp-')) && String(s.name ?? '').trim() === realName);
        if (optIdx !== -1) {
          const copy = [...prev];
          copy[optIdx] = normalized;
          return copy;
        }
        return [...prev.filter((s: any) => normalizeId(s._id || s.id) !== normalizeId(sid)), normalized];
      });
    };
    const onTableSectionUpdated = (section: any) => {
      if (!section || !(section._id || section.id)) return;
      const sid = section._id || section.id;
      const normalized = { ...section, id: sid, _id: sid } as any;
      setTableSections(prev => {
        const exists = prev.some((s: any) => normalizeId(s._id || s.id) === normalizeId(sid));
        if (exists) return prev.map((s: any) => normalizeId(s._id || s.id) === normalizeId(sid) ? { ...s, ...normalized } : s);
        const optIdx = prev.findIndex((s: any) => ((s as any)._optimistic || String(s._id || s.id).startsWith('temp-')) && String(s.name ?? '').trim() === String(section.name ?? '').trim());
        if (optIdx !== -1) {
          const copy = [...prev];
          copy[optIdx] = normalized;
          return copy;
        }
        return [...prev, normalized];
      });
    };
    const onTableSectionDeleted = (payload: any) => {
      const sid = payload?._id || payload?.id || payload;
      if (!sid) return;
      setTableSections(prev => prev.filter((s: any) => normalizeId(s._id || s.id) !== normalizeId(sid) && normalizeId(s.id) !== normalizeId(sid)));
    };
    const onSessionUpdated = (session: any) => {
      if (!session || !(session._id || session.id)) return;
      const sid = session._id || session.id;
      setSessions(prev => {
        const exists = prev.some((s: any) => normalizeId(s._id) === normalizeId(sid) || normalizeId(s.id) === normalizeId(sid));
        const normalized = { ...session, id: sid, _id: sid };
        if (exists) return prev.map((s: any) => (normalizeId(s._id) === normalizeId(sid) || normalizeId(s.id) === normalizeId(sid)) ? { ...s, ...normalized } : s);
        if (session.status === 'active') return [...prev, normalized];
        return prev;
      });
      // Bills carry their sessions and are the source used by the tables
      // screen to calculate occupancy. Keep that nested data in sync too.
      const sessionBillId = session.bill?._id || session.bill?.id || session.bill;
      setBills(prev => prev.map((bill: any) => {
        const bid = bill._id || bill.id;
        const belongsToBill = sessionBillId && normalizeId(sessionBillId) === normalizeId(bid);
        const sessions = Array.isArray(bill.sessions) ? bill.sessions : [];
        const hasSession = sessions.some((s: any) =>
          normalizeId(s?._id || s?.id || s) === normalizeId(sid)
        );
        if (!belongsToBill && !hasSession) return bill;
        const nextSessions = hasSession
          ? sessions.map((s: any) =>
              normalizeId(s?._id || s?.id || s) === normalizeId(sid) ? session : s)
          : [...sessions, session];
        return { ...bill, sessions: nextSessions };
      }));
      if (session.table) {
        const tid = session.table?._id || session.table?.id || session.table;
        setTables(prev => prev.map((table: any) =>
          normalizeId(table._id || table.id) === normalizeId(tid)
            ? { ...table, status: session.status === 'active' ? 'occupied' : table.status }
            : table
        ));
      }
    };

    // Register colon events (instant)
    socket.on('order:created', onOrderCreated);
    socket.on('order:updated', onOrderUpdated);
    socket.on('order:deleted', onOrderDeleted);
    socket.on('bill:updated', onBillUpdated);
    socket.on('bill:created', onBillUpdated);
    socket.on('bill:deleted', (bill: any) => onBillUpdated(bill, 'deleted'));
    socket.on('table:statusChanged', onTableStatusChanged);
    socket.on('table:created', onTableCreated);
    socket.on('table:updated', onTableUpdated);
    socket.on('table:deleted', onTableDeleted);
    // table sections instant
    socket.on('tableSection:created', onTableSectionCreated);
    socket.on('tableSection:updated', onTableSectionUpdated);
    socket.on('tableSection:deleted', onTableSectionDeleted);
    socket.on('tableSections:created', onTableSectionCreated);
    socket.on('tableSections:updated', onTableSectionUpdated);
    socket.on('session:updated', onSessionUpdated);
    socket.on('session:created', onSessionUpdated);
    socket.on('session:ended', onSessionUpdated);

    // Also handle hyphen events instantly (backward compat)
    socket.on('order-update', (data: any) => {
      if (!data) return;
      if (data.type === 'created' && data.order) onOrderCreated(data.order);
      else if (data.type === 'deleted') onOrderDeleted(data.order || data);
      else if (data.order) onOrderUpdated(data.order);
      else if (data._id) onOrderUpdated(data);
    });
    socket.on('bill-update', (data: any) => {
      if (data?.bill) onBillUpdated(data.bill, data.type);
      else if (data?._id) onBillUpdated(data);
    });
    socket.on('table-status-update', onTableStatusChanged);
    socket.on('table-update', (data: any) => {
      if (data?.type === 'created') onTableCreated(data.table || data);
      else if (data?.type === 'updated') onTableUpdated(data.table || data);
      else if (data?.type === 'deleted') onTableDeleted(data.table || data);
      else if (data?.table) onTableUpdated(data.table);
    });
    socket.on('table-section-update', (data: any) => {
      if (!data) return;
      if (data.type === 'created' && data.section) onTableSectionCreated(data.section);
      else if (data.type === 'deleted') onTableSectionDeleted(data.section || data);
      else if (data.section) onTableSectionUpdated(data.section);
      else if (data._id) onTableSectionUpdated(data);
    });
    socket.on('session-update', (data: any) => {
      if (data?.session) onSessionUpdated(data.session);
      else if (data?._id) onSessionUpdated(data);
    });

    // fallback polling every 30s if socket disconnected
    const fallbackInterval = setInterval(() => {
      if (!socket.connected) {
        fetchersRef.current.fetchOrders().catch(()=>{});
        fetchersRef.current.fetchBills().catch(()=>{});
        fetchersRef.current.fetchTables().catch(()=>{});
      }
    }, 30000);

    socket.on('reconnect', () => {
      // عند إعادة الاتصال — جلب كل شيء
      debouncedFetch('reconnect', () => {
        fetchersRef.current.fetchBills();
        fetchersRef.current.fetchOrders();
        fetchersRef.current.fetchSessions();
        fetchersRef.current.fetchTables();
      });
    });

    return () => {
      clearInterval(fallbackInterval);
      debounceTimersRef.current.forEach(t => clearTimeout(t));
      debounceTimersRef.current.clear();
      socket.off('bill-update'); socket.off('payment-received'); socket.off('partial-payment-received');
      socket.off('order-update'); socket.off('new-order'); socket.off('order-ready');
      socket.off('session-update'); socket.off('table-status-update');
      socket.off('inventory-update'); socket.off('low-stock-alert');
      socket.off('menu-update'); socket.off('cost-update'); socket.off('device-update');
      socket.off('table-update'); socket.off('table-section-update'); socket.off('settings-update');
      socket.off('order:created', onOrderCreated); socket.off('order:updated', onOrderUpdated); socket.off('order:deleted', onOrderDeleted);
      socket.off('bill:updated', onBillUpdated); socket.off('bill:created', onBillUpdated);
      socket.off('bill:deleted');
      socket.off('table:statusChanged', onTableStatusChanged);
      socket.off('table:created', onTableCreated); socket.off('table:updated', onTableUpdated); socket.off('table:deleted', onTableDeleted);
      socket.off('tableSection:created', onTableSectionCreated); socket.off('tableSection:updated', onTableSectionUpdated); socket.off('tableSection:deleted', onTableSectionDeleted);
      socket.off('tableSections:created', onTableSectionCreated); socket.off('tableSections:updated', onTableSectionUpdated);
      socket.off('session:updated', onSessionUpdated); socket.off('session:created', onSessionUpdated); socket.off('session:ended', onSessionUpdated);
      socket.off('reconnect');
      socket.disconnect();
      globalSocketRef.current = null;
    };
  }, [user]);

  const getRecentActivity = async (limit?: number): Promise<any[]> => {
    try {
      const response = await api.getRecentActivity(limit);
      return response.success && response.data ? response.data : [];
    } catch (error) {
      return [];
    }
  };

  const getSalesReport = async (filter: Filter, groupBy?: string): Promise<any> => {
    try {
      const response = await api.getSalesReport(filter, groupBy);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error getting sales report:', error);
      return null;
    }
  };

  const getSessionsReport = async (filter: Filter, device?: string): Promise<any> => {
    try {
      const response = await api.getSessionsReport(filter, device);
      return response.success ? response.data : null;
    } catch (error) {
      return null;
    }
  };

  const getInventoryReport = async (category?: string): Promise<any> => {
    try {
      const response = await api.getInventoryReport(category);
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

  const getNotifications = async (options?: { category?: string; unreadOnly?: boolean; limit?: number }): Promise<Notification[]> => {
    try {
      const response = await api.getNotifications(options);
      return response.success && response.data ? response.data : [];
    } catch (error) {
      return [];
    }
  };

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
        const notifs = await getNotifications();
        setNotifications(notifs);
      }
      return response.success;
    } catch (error) {
      return false;
    }
  };

  const createNotification = async (notificationData: any): Promise<any> => {
    try {
      const response = await api.createNotification(notificationData);
      if (response.success && response.data) {
        showNotification('تم إنشاء الإشعار بنجاح', 'success');
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

  const updateUserProfile = async (profileData: any): Promise<boolean> => {
    try {
      const response = await api.updateUserProfile(profileData);

      if (response.success) {
        if (response.data) {
          setUser(prev => {
            const newUser = prev ? { ...prev, ...response.data } : null;
            return newUser;
          });
        } else {
          setUser(prev => prev ? { ...prev, ...profileData } : null);
        }

        try {
          const userResponse = await api.getMe();
          if (userResponse.success && userResponse.data?.user) {
            setUser(userResponse.data.user);
          }
        } catch (refreshError) {
          console.warn('Failed to refresh user data:', refreshError);
        }

        showNotification('تم تحديث الملف الشخصي بنجاح', 'success');
        return true;
      } else {
        showNotification(response.message || 'فشل في تحديث الملف الشخصي', 'error');
        return false;
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
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

  const updateNotificationSettings = async (settingsData: any): Promise<boolean> => {
    try {
      localStorage.setItem('notificationSettings', JSON.stringify(settingsData));

      const response = await api.updateNotificationSettings(settingsData);
      if (response.success) {
        showNotification('تم حفظ إعدادات الإشعارات بنجاح', 'success');
        return true;
      } else {
        showNotification(response.message || 'فشل في حفظ إعدادات الإشعارات', 'error');
        return false;
      }
    } catch (error) {
      showNotification('تم حفظ إعدادات الإشعارات محلياً', 'warning');
      return true;
    }
  };

  const updateGeneralSettings = async (settingsData: any): Promise<boolean> => {
    try {
      const response = await api.updateGeneralSettings(settingsData);
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

  const getNotificationSettings = async (): Promise<any> => {
    try {
      const response = await api.getNotificationSettings();
      if (response.success) {
        return response.data;
      } else {
        return {
          sessionNotifications: true,
          orderNotifications: true,
          inventoryNotifications: true,
          billingNotifications: true,
          soundEnabled: true,
          emailNotifications: false,
          showNotificationCount: true,
          autoMarkAsRead: false,
        };
      }
    } catch (error) {
      return {
        sessionNotifications: true,
        orderNotifications: true,
        inventoryNotifications: true,
        billingNotifications: true,
        soundEnabled: true,
        emailNotifications: false,
        showNotificationCount: true,
        autoMarkAsRead: false,
      };
    }
  };

  const getGeneralSettings = async (): Promise<any> => {
    try {
      const response = await api.getGeneralSettings();
      if (response.success) {
        return response.data;
      } else {
        return {
          theme: 'light',
          language: 'ar',
          timezone: 'Africa/Cairo',
          currency: 'EGP',
        };
      }
    } catch (error) {
      return {
        theme: 'light',
        language: 'ar',
        timezone: 'Africa/Cairo',
        currency: 'EGP',
      };
    }
  };

  const getOrganization = async (): Promise<any> => {
    try {
      const response = await api.getOrganization();

      if (response.success) {
        return response.data;
      } else {
        console.warn('Failed to fetch organization:', response.message);
        showNotification(response.message || 'فشل في جلب بيانات المنشأة', 'error');
        return null;
      }
    } catch (error) {
      console.error('Error fetching organization:', error);
      showNotification('فشل في جلب بيانات المنشأة', 'error');
      return null;
    }
  };

  const updateOrganization = async (organizationData: any): Promise<boolean> => {
    try {
      const response = await api.updateOrganization(organizationData);
      if (response.success) {
        showNotification('تم تحديث بيانات المنشأة بنجاح', 'success');
        return true;
      } else {
        showNotification(response.message || 'فشل في تحديث بيانات المنشأة', 'error');
        return false;
      }
    } catch (error) {
      showNotification('فشل في تحديث بيانات المنشأة', 'error');
      return false;
    }
  };

  const updateOrganizationPermissions = async (permissions: any): Promise<boolean> => {
    try {
      const response = await api.updateOrganizationPermissions(permissions);
      if (response.success) {
        showNotification('تم تحديث صلاحيات المنشأة بنجاح', 'success');
        return true;
      } else {
        showNotification(response.message || 'فشل في تحديث صلاحيات المنشأة', 'error');
        return false;
      }
    } catch (error) {
      showNotification('فشل في تحديث صلاحيات المنشأة', 'error');
      return false;
    }
  };

  const canEditOrganization = async (): Promise<any> => {
    try {
      const response = await api.canEditOrganization();

      if (response.success) {
        return response.data;
      } else {
        return {
          canEdit: false,
          isOwner: false,
          isAuthorizedAdmin: false,
          allowManagersToEditOrganization: false,
          authorizedManagers: []
        };
      }
    } catch (error) {
      return {
        canEdit: false,
        isOwner: false,
        isAuthorizedAdmin: false,
        allowManagersToEditOrganization: false,
        authorizedManagers: []
      };
    }
  };

  const getAvailableManagers = async (): Promise<any> => {
    try {
      const response = await api.getAvailableManagers();
      if (response.success) {
        return response.data;
      } else {
        showNotification(response.message || 'فشل في جلب قائمة المديرين', 'error');
        return [];
      }
    } catch (error) {
      showNotification('فشل في جلب قائمة المديرين', 'error');
      return [];
    }
  };

  const getReportSettings = async (): Promise<any> => {
    try {
      const response = await api.getReportSettings();
      if (response.success) {
        return response.data;
      } else {
        showNotification(response.message || 'فشل في جلب إعدادات التقارير', 'error');
        return null;
      }
    } catch (error) {
      showNotification('فشل في جلب إعدادات التقارير', 'error');
      return null;
    }
  };

  const updateReportSettings = async (reportSettings: any): Promise<boolean> => {
    try {
      const response = await api.updateReportSettings(reportSettings);
      if (response.success) {
        showNotification('تم تحديث إعدادات التقارير بنجاح', 'success');
        return true;
      } else {
        showNotification(response.message || 'فشل في تحديث إعدادات التقارير', 'error');
        return false;
      }
    } catch (error) {
      showNotification('فشل في تحديث إعدادات التقارير', 'error');
      return false;
    }
  };

  const canManageReports = async (): Promise<any> => {
    try {
      const response: any = await api.canManageReports();
      if (response.success) return response.data ?? response;
      else return { canManage: false, isOwner: false };
    } catch (error) {
      return { canManage: false, isOwner: false };
    }
  };

  const sendReportNow = async (): Promise<boolean> => {
    try {
      const response = await api.sendReportNow();
      if (response.success) {
        showNotification(response.message || 'تم إرسال التقرير بنجاح', 'success');
        return true;
      } else {
        showNotification(response.message || 'فشل في إرسال التقرير', 'error');
        return false;
      }
    } catch (error) {
      showNotification('فشل في إرسال التقرير', 'error');
      return false;
    }
  };

  const canManagePayroll = async (): Promise<any> => {
    try {
      const response: any = await api.canManagePayroll();
      if (response.success) return response.data ?? response;
      else return { canManage: false, isOwner: false };
    } catch (error) {
      return { canManage: false, isOwner: false };
    }
  };

  const updatePayrollPermissions = async (permissions: any): Promise<boolean> => {
    try {
      const response = await api.updatePayrollPermissions(permissions);
      if (response.success) {
        showNotification(response.message || 'تم تحديث صلاحيات المرتبات بنجاح', 'success');
        return true;
      } else {
        showNotification(response.message || 'فشل في تحديث صلاحيات المرتبات', 'error');
        return false;
      }
    } catch (error) {
      showNotification('فشل في تحديث صلاحيات المرتبات', 'error');
      return false;
    }
  };

  const value: DataContextType = {
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
    warehouseItems,
    users,
    notifications,

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
    fetchWarehouseItems,
    fetchDashboardData,
    setBills,
    setOrders,
    setTables,
    setTableSections,

    refreshData,
    forceRefreshData,

    createSession,
    updateSession,
    endSession,
    createOrder,
    updateOrder,
    deleteOrder,
    createInventoryItem,
    updateInventoryItem,
    updateStock,
    createWarehouseItem,
    updateWarehouseItem,
    updateWarehouseStock,
    transferToInventory,
    returnToWarehouse,
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
    mergeMenuItems,
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

    showNotification,
    updateOrderItemPrepared,
    updateOrderStatus,
    deliverItem,
    deliverOrderSection,
    cancelOrder,
    createSessionWithExistingBill,
    changeSessionTable,
    linkSessionToTable,
    unlinkTableFromSession,
    updateSessionTimes,
    updateSessionStartTime,
    updateControllersPeriodTime,
    updateSessionCost,
    addPartialPaymentAggregated,
    payForItems,
    paySessionPartial,
    updateBillAggregatedItems,
    deleteBill,
    getRecentActivity,
    getSalesReport,
    getSessionsReport,
    getInventoryReport,
    getFinancialReport,
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
    exportReportToExcel,
    exportReportToPDF,
    updateUserProfile,
    changePassword,
    updateNotificationSettings,
    updateGeneralSettings,
    getNotificationSettings,
    getGeneralSettings,
    getOrganization,
    updateOrganization,
    updateOrganizationPermissions,
    canEditOrganization,
    getAvailableManagers,
    getReportSettings,
    updateReportSettings,
    canManageReports,
    sendReportNow,
    canManagePayroll,
    updatePayrollPermissions,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
