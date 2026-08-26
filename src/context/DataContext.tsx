import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import api, { Session, Order, InventoryItem, WarehouseItem, Bill, Cost, Device, MenuItem, MenuSection, MenuCategory, BillItem, User } from '../services/api';
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
  getMenuItemsByCategory: (category: string) => Promise<MenuItem[]>;
  getPopularMenuItems: (limit?: number) => Promise<MenuItem[]>;
  getMenuStats: () => Promise<any>;

  createMenuSection: (sectionData: any) => Promise<MenuSection | null>;
  updateMenuSection: (id: string, updates: any) => Promise<MenuSection | null>;
  deleteMenuSection: (id: string) => Promise<boolean>;

  createMenuCategory: (categoryData: any) => Promise<MenuCategory | null>;
  updateMenuCategory: (id: string, updates: any) => Promise<MenuCategory | null>;
  deleteMenuCategory: (id: string) => Promise<boolean>;

  fetchTableSections: () => Promise<void>;
  createTableSection: (sectionData: any) => Promise<any>;
  updateTableSection: (id: string, updates: any) => Promise<any>;
  deleteTableSection: (id: string) => Promise<boolean>;

  fetchTables: (sectionId?: string) => Promise<void>;
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
  }, []);

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
      const response = await api.getBills();
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
    try {
      const response = await api.createSession(sessionData);
      if (response.success && response.data) {
        const data = response.data as any;
        const session = data.session;
        const bill = data.bill;

        setSessions(prev => [...prev, session]);

        if (bill) {
          setBills(prev => [...prev, bill]);
          showNotification(t('toast.session.startedWithBill', { deviceName: session.deviceName, billNumber: bill.billNumber }), 'success');
        } else {
          showNotification(t('toast.session.started', { deviceName: session.deviceName }), 'success');
        }

        updateNotificationCount(1);
        return session;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.session.createError'), 'error');
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
        showNotification(t('toast.session.updated'), 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.session.updateError'), 'error');
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

        setSessions(prev => prev.filter(s => s.id !== id));

        if (bill) {
          setBills(prev => prev.map(b => b.id === bill.id ? bill : b));
          showNotification(t('toast.session.ended', { deviceName: session.deviceName, cost: session.finalCost }), 'success');
        } else {
          showNotification(t('toast.session.endedSuccess', { deviceName: session.deviceName }), 'success');
        }

        return session;
      }
      throw new Error(response.message || t('toast.session.endError'));
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.session.endError'), 'error');
      throw error;
    }
  };

  const createOrder = async (orderData: any): Promise<Order | null> => {
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

      const response = await api.createOrder(orderData);

      if (response.success && response.data) {
        const newOrder = response.data;
        setOrders(prev => [...prev, newOrder]);

        if (newOrder.bill) {
          await fetchBills();
        }

        showNotification(t('toast.order.created', { orderNumber: newOrder.orderNumber }), 'success');
        updateNotificationCount(1);
        return newOrder;
      } else {
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
          const errorMessage = response.message || t('toast.order.createError');
          showNotification(errorMessage, 'error');
        }
        return null;
      }
    } catch (error: unknown) {
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
    try {
      const response = await api.updateOrder(id, updates);
      if (response.success && response.data) {
        setOrders(prev => prev.map(order =>
          order.id === id ? response.data! : order
        ));
        showNotification(t('toast.order.updated'), 'success');
        return response.data;
      }

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
      const err = error as { message?: string };
      showNotification(err.message || t('toast.order.updateError'), 'error');
      return null;
    }
  };

  const updateOrderItemPrepared = async (orderId: string, itemIndex: number, data: { preparedCount: number }): Promise<Order | null> => {
    try {
      const response = await api.updateOrderItemPrepared(orderId, itemIndex, data);
      if (response.success && response.data) {
        setOrders(prev => prev.map(order =>
          order.id === orderId ? response.data! : order
        ));
        showNotification(t('toast.order.preparingUpdated'), 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.order.preparingError'), 'error');
      return null;
    }
  };

  const updateOrderStatus = async (orderId: string, status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'): Promise<Order | null> => {
    try {
      const response = await api.updateOrderStatus(orderId, status);
      if (response.success && response.data) {
        setOrders(prev => prev.map(order => order.id === orderId ? response.data! : order));

        const statusKey = `toast.order.status${status.charAt(0).toUpperCase() + status.slice(1)}`;
        showNotification(t(statusKey), 'success');
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.order.statusError'), 'error');
      return null;
    }
  };

  const deleteOrder = async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteOrder(id);

      if (response && response.success === true) {
        setOrders(prev => prev.filter(order => order.id !== id));
        return true;
      }

      return false;
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Error deleting order:', err);
      return false;
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
    try {
      const response = await api.updateBill(id, updates);
      if (response.success && response.data) {
        setBills(prev => prev.map(bill =>
          bill.id === id ? response.data! : bill
        ));
        showNotification(t('toast.bill.updated'), 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.bill.updateError'), 'error');
      return null;
    }
  };

  const addPayment = async (id: string, paymentData: any): Promise<Bill | null> => {
    try {
      const response = await api.addPayment(id, paymentData);
      if (response.success && response.data) {
        setBills(prev => prev.map(bill => bill.id === id ? response.data! : bill));

        const { amount, method } = paymentData;
        const methodText = t(`toast.paymentMethods.${method}`, method);
        showNotification(t('toast.bill.paymentAdded', { amount, method: methodText }), 'success');
        updateNotificationCount(1);
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.bill.paymentError'), 'error');
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
        showNotification(t('toast.bill.cancelled'), 'success');
        return true;
      } else {
        return false;
      }
    } catch (error: unknown) {
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
    try {
      const response = await api.addPartialPayment(id, paymentData);
      if (response.success && response.data) {
        setBills(prev => prev.map(bill =>
          bill.id === id ? response.data! : bill
        ));
        showNotification(t('toast.bill.partialPayment'), 'success');
        return response.data;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      showNotification(err.message || t('toast.bill.partialPaymentError'), 'error');
      return null;
    }
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

      console.warn('Frontend: Response not successful:', response);
      return null;
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Frontend: Error creating table:', error);
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
      const response = await api.canManageReports();
      if (response.success) {
        return response;
      } else {
        return { canManage: false, isOwner: false };
      }
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
      const response = await api.canManagePayroll();
      if (response.success) {
        return response;
      } else {
        return { canManage: false, isOwner: false };
      }
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
