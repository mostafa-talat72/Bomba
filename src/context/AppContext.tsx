import React, { createContext, useContext, ReactNode, useRef, useMemo } from 'react';
import { User } from '../services/api';
import { AuthProvider, useAuth } from './AuthContext';
import { DataProvider, useData, Filter } from './DataContext';
import { setDataActionsRef, DataActions } from './dataActionsRef';

export type { Filter };

interface AppContextType {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
  error: string | null;
  notification: { message: string; type: 'success' | 'error' | 'warning' | 'info' } | null;
  subscriptionStatus: 'active' | 'expired' | 'pending' | 'loading';

  // Data state
  sessions: any[];
  orders: any[];
  inventory: any[];
  bills: any[];
  costs: any[];
  devices: any[];
  menuItems: any[];
  menuSections: any[];
  menuCategories: any[];
  tableSections: any[];
  tables: any[];
  settings: any;
  inventoryItems: any[];
  warehouseItems: any[];
  users: any[];
  notifications: any[];

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
  setBills: React.Dispatch<React.SetStateAction<any[]>>;
  setOrders: React.Dispatch<React.SetStateAction<any[]>>;
  setTables: React.Dispatch<React.SetStateAction<any[]>>;
  setTableSections: React.Dispatch<React.SetStateAction<any[]>>;
  fetchCosts: () => Promise<void>;
  fetchMenuItems: () => Promise<void>;
  fetchAvailableMenuItems: () => Promise<void>;
  fetchMenuSections: () => Promise<void>;
  fetchMenuCategories: (sectionId?: string) => Promise<void>;
  fetchDevices: () => Promise<void>;
  fetchInventoryItems: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchDashboardData: () => Promise<void>;

  // CRUD methods
  createSession: (sessionData: any) => Promise<any>;
  updateSession: (id: string, updates: any) => Promise<any>;
  endSession: (id: string, customerName?: string) => Promise<any>;
  createOrder: (orderData: any) => Promise<any>;
  updateOrder: (id: string, updates: any) => Promise<any>;
  deleteOrder: (id: string) => Promise<boolean>;
  createInventoryItem: (itemData: any) => Promise<any>;
  updateInventoryItem: (id: string, updates: any) => Promise<any>;
  updateStock: (id: string, stockData: any) => Promise<any>;
  fetchWarehouseItems: () => Promise<void>;
  createWarehouseItem: (itemData: any) => Promise<any>;
  updateWarehouseItem: (id: string, updates: any) => Promise<any>;
  updateWarehouseStock: (id: string, stockData: any) => Promise<any>;
  transferToInventory: (data: any) => Promise<boolean>;
  returnToWarehouse: (data: any) => Promise<boolean>;
  createBill: (billData: any) => Promise<any>;
  updateBill: (id: string, updates: any) => Promise<any>;
  addPayment: (id: string, paymentData: any) => Promise<any>;
  cancelBill: (id: string) => Promise<boolean>;
  getBillItems: (id: string) => Promise<any>;
  addPartialPayment: (id: string, paymentData: any) => Promise<any>;
  addPartialPaymentAggregated: (id: string, paymentData: any) => Promise<any>;
  payForItems: (id: string, paymentData: any) => Promise<any>;
  paySessionPartial: (id: string, paymentData: any) => Promise<any>;
  updateBillAggregatedItems: (id: string, data: any) => Promise<any>;
  deleteBill: (id: string) => Promise<boolean>;
  createCost: (costData: any) => Promise<any>;
  updateCost: (id: string, updates: any) => Promise<any>;
  deleteCost: (id: string) => Promise<boolean>;
  createDevice: (deviceData: any) => Promise<any>;
  updateDevice: (id: string, updates: any) => Promise<any>;
  updateDeviceStatus: (id: string, status: string) => Promise<any>;
  deleteDevice: (id: string) => Promise<boolean>;
  getDeviceStats: () => Promise<any>;
  createMenuItem: (itemData: any) => Promise<any>;
  updateMenuItem: (id: string, updates: any) => Promise<any>;
  deleteMenuItem: (id: string) => Promise<boolean>;
  mergeMenuItems: (itemIds: string[], name?: string) => Promise<any>;
  getMenuItemsByCategory: (category: string) => Promise<any>;
  getPopularMenuItems: (limit?: number) => Promise<any>;
  getMenuStats: () => Promise<any>;
  createMenuSection: (sectionData: any) => Promise<any>;
  updateMenuSection: (id: string, updates: any) => Promise<any>;
  deleteMenuSection: (id: string) => Promise<boolean>;
  createMenuCategory: (categoryData: any) => Promise<any>;
  updateMenuCategory: (id: string, updates: any) => Promise<any>;
  deleteMenuCategory: (id: string) => Promise<boolean>;
  fetchTableSections: () => Promise<void>;
  createTableSection: (sectionData: any) => Promise<any>;
  updateTableSection: (id: string, updates: any) => Promise<any>;
  deleteTableSection: (id: string) => Promise<boolean>;
  fetchTables: (sectionId?: string) => Promise<void>;
  getTableStatus: (id: string) => Promise<any>;
  createTable: (tableData: any) => Promise<any>;
  updateTable: (id: string, updates: any) => Promise<any>;
  deleteTable: (id: string) => Promise<boolean>;
  createUser: (userData: any) => Promise<any>;
  updateUser: (id: string, updates: any) => Promise<any>;
  deleteUser: (id: string) => Promise<boolean>;

  // Permission methods
  hasPermission: (permission: string) => boolean;
  canDeleteUsers: () => boolean;
  canManageUsers: () => boolean;
  canEditUser: (targetUser: any) => boolean;
  canDeleteUser: (targetUser: any) => boolean;

  // Utility
  showNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

  // Other data methods
  updateOrderItemPrepared: (orderId: string, itemIndex: number, data: { preparedCount: number }) => Promise<any>;
  updateOrderStatus: (orderId: string, status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled') => Promise<any>;
  deliverItem: (orderId: string, itemIndex: number) => Promise<any>;
  deliverOrderSection: (orderId: string, sectionId: string) => Promise<any>;
  cancelOrder: (orderId: string, reason?: string) => Promise<any>;
  createSessionWithExistingBill: (sessionData: any) => Promise<any>;
  changeSessionTable: (sessionId: string, newTableId: string, options?: { silent?: boolean }) => Promise<any>;
  linkSessionToTable: (sessionId: string, tableId: string, options?: { silent?: boolean }) => Promise<any>;
  unlinkTableFromSession: (sessionId: string, customerName?: string, options?: { silent?: boolean }) => Promise<any>;
  updateSessionTimes: (sessionId: string, data: { startTime: string; endTime: string }, options?: { silent?: boolean }) => Promise<any>;
  updateSessionStartTime: (sessionId: string, data: { startTime: string }) => Promise<any>;
  updateControllersPeriodTime: (sessionId: string, periodIndex: number, newStartTime: string, newEndTime?: string, options?: { silent?: boolean }) => Promise<any>;
  updateSessionCost: (sessionId: string) => Promise<any>;
  getRecentActivity: (limit?: number) => Promise<any>;
  getSalesReport: (filter: any, groupBy?: string) => Promise<any>;
  getSessionsReport: (filter: any, device?: string) => Promise<any>;
  getInventoryReport: (category?: string) => Promise<any>;
  getFinancialReport: (filter: any) => Promise<any>;
  getNotifications: (options?: any) => Promise<any>;
  getNotificationStats: () => Promise<any>;
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

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContextInner>
          {children}
        </AppContextInner>
      </DataProvider>
    </AuthProvider>
  );
};

const AppContextInner: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const data = useData();

  const value: AppContextType = useMemo(() => ({
    // Auth state
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    isLoggingOut: auth.isLoggingOut,
    error: auth.error,
    notification: auth.notification,
    subscriptionStatus: auth.subscriptionStatus,

    // Data state
    sessions: data.sessions,
    orders: data.orders,
    inventory: data.inventory,
    bills: data.bills,
    costs: data.costs,
    devices: data.devices,
    menuItems: data.menuItems,
    menuSections: data.menuSections,
    menuCategories: data.menuCategories,
    tableSections: data.tableSections,
    tables: data.tables,
    settings: data.settings,
    inventoryItems: data.inventoryItems,
    warehouseItems: data.warehouseItems,
    users: data.users,
    notifications: data.notifications,

    // Auth methods
    login: auth.login,
    logout: auth.logout,
    resendVerification: auth.resendVerification,
    forgotPassword: auth.forgotPassword,
    resetPassword: auth.resetPassword,

    // Data methods
    refreshData: data.refreshData,
    forceRefreshData: data.forceRefreshData,
    fetchSessions: data.fetchSessions,
    fetchOrders: data.fetchOrders,
    fetchInventory: data.fetchInventory,
    fetchBills: data.fetchBills,
    setBills: data.setBills as any,
    setOrders: data.setOrders as any,
    setTables: data.setTables as any,
    setTableSections: (data as any).setTableSections as any,
    fetchCosts: data.fetchCosts,
    fetchMenuItems: data.fetchMenuItems,
    fetchAvailableMenuItems: data.fetchAvailableMenuItems,
    fetchMenuSections: data.fetchMenuSections,
    fetchMenuCategories: data.fetchMenuCategories,
    fetchDevices: data.fetchDevices,
    fetchInventoryItems: data.fetchInventoryItems,
    fetchUsers: data.fetchUsers,
    fetchSettings: data.fetchSettings,
    fetchDashboardData: data.fetchDashboardData,

    // CRUD methods
    createSession: data.createSession,
    updateSession: data.updateSession,
    endSession: data.endSession,
    createOrder: data.createOrder,
    updateOrder: data.updateOrder,
    deleteOrder: data.deleteOrder,
    createInventoryItem: data.createInventoryItem,
    updateInventoryItem: data.updateInventoryItem,
    updateStock: data.updateStock,
    fetchWarehouseItems: data.fetchWarehouseItems,
    createWarehouseItem: data.createWarehouseItem,
    updateWarehouseItem: data.updateWarehouseItem,
    updateWarehouseStock: data.updateWarehouseStock,
    transferToInventory: data.transferToInventory,
    returnToWarehouse: data.returnToWarehouse,
    createBill: data.createBill,
    updateBill: data.updateBill,
    addPayment: data.addPayment,
    cancelBill: data.cancelBill,
    getBillItems: data.getBillItems,
    addPartialPayment: data.addPartialPayment,
    addPartialPaymentAggregated: (data as any).addPartialPaymentAggregated,
    payForItems: (data as any).payForItems,
    paySessionPartial: (data as any).paySessionPartial,
    updateBillAggregatedItems: (data as any).updateBillAggregatedItems,
    deleteBill: (data as any).deleteBill,
    createCost: data.createCost,
    updateCost: data.updateCost,
    deleteCost: data.deleteCost,
    createDevice: data.createDevice,
    updateDevice: data.updateDevice,
    updateDeviceStatus: data.updateDeviceStatus,
    deleteDevice: data.deleteDevice,
    getDeviceStats: data.getDeviceStats,
    createMenuItem: data.createMenuItem,
    updateMenuItem: data.updateMenuItem,
    deleteMenuItem: data.deleteMenuItem,
    mergeMenuItems: (data as any).mergeMenuItems,
    getMenuItemsByCategory: data.getMenuItemsByCategory,
    getPopularMenuItems: data.getPopularMenuItems,
    getMenuStats: data.getMenuStats,
    createMenuSection: data.createMenuSection,
    updateMenuSection: data.updateMenuSection,
    deleteMenuSection: data.deleteMenuSection,
    createMenuCategory: data.createMenuCategory,
    updateMenuCategory: data.updateMenuCategory,
    deleteMenuCategory: data.deleteMenuCategory,
    fetchTableSections: data.fetchTableSections,
    createTableSection: data.createTableSection,
    updateTableSection: data.updateTableSection,
    deleteTableSection: data.deleteTableSection,
    fetchTables: data.fetchTables,
    getTableStatus: data.getTableStatus,
    createTable: data.createTable,
    updateTable: data.updateTable,
    deleteTable: data.deleteTable,
    createUser: data.createUser,
    updateUser: data.updateUser,
    deleteUser: data.deleteUser,

    // Permission methods
    hasPermission: auth.hasPermission,
    canDeleteUsers: auth.canDeleteUsers,
    canManageUsers: auth.canManageUsers,
    canEditUser: auth.canEditUser,
    canDeleteUser: auth.canDeleteUser,

    // Utility
    showNotification: data.showNotification,

    // Other data methods
    updateOrderItemPrepared: data.updateOrderItemPrepared,
    updateOrderStatus: data.updateOrderStatus,
    deliverItem: (data as any).deliverItem,
    deliverOrderSection: (data as any).deliverOrderSection,
    cancelOrder: (data as any).cancelOrder,
    createSessionWithExistingBill: (data as any).createSessionWithExistingBill,
    changeSessionTable: (data as any).changeSessionTable,
    linkSessionToTable: (data as any).linkSessionToTable,
    unlinkTableFromSession: (data as any).unlinkTableFromSession,
    updateSessionTimes: (data as any).updateSessionTimes,
    updateSessionStartTime: (data as any).updateSessionStartTime,
    updateControllersPeriodTime: (data as any).updateControllersPeriodTime,
    updateSessionCost: (data as any).updateSessionCost,
    getRecentActivity: data.getRecentActivity,
    getSalesReport: data.getSalesReport,
    getSessionsReport: data.getSessionsReport,
    getInventoryReport: data.getInventoryReport,
    getFinancialReport: data.getFinancialReport,
    getNotifications: data.getNotifications,
    getNotificationStats: data.getNotificationStats,
    markNotificationAsRead: data.markNotificationAsRead,
    markAllNotificationsAsRead: data.markAllNotificationsAsRead,
    deleteNotification: data.deleteNotification,
    createNotification: data.createNotification,
    sendNotificationToRole: data.sendNotificationToRole,
    sendNotificationToPermission: data.sendNotificationToPermission,
    broadcastNotification: data.broadcastNotification,
    forceRefreshNotifications: data.forceRefreshNotifications,
    exportReportToExcel: data.exportReportToExcel,
    exportReportToPDF: data.exportReportToPDF,
    updateUserProfile: data.updateUserProfile,
    changePassword: data.changePassword,
    updateNotificationSettings: data.updateNotificationSettings,
    updateGeneralSettings: data.updateGeneralSettings,
    getNotificationSettings: data.getNotificationSettings,
    getGeneralSettings: data.getGeneralSettings,
    getOrganization: data.getOrganization,
    updateOrganization: data.updateOrganization,
    updateOrganizationPermissions: data.updateOrganizationPermissions,
    canEditOrganization: data.canEditOrganization,
    getAvailableManagers: data.getAvailableManagers,
    getReportSettings: data.getReportSettings,
    updateReportSettings: data.updateReportSettings,
    canManageReports: data.canManageReports,
    sendReportNow: data.sendReportNow,
    canManagePayroll: data.canManagePayroll,
    updatePayrollPermissions: data.updatePayrollPermissions,
  }), [
    auth.user, auth.isAuthenticated, auth.isLoading, auth.isLoggingOut, auth.error, auth.notification, auth.subscriptionStatus,
    data.sessions, data.orders, data.inventory, data.bills, data.costs, data.devices, data.menuItems, data.menuSections, data.menuCategories, data.tableSections, data.tables, data.settings, data.inventoryItems, data.warehouseItems, data.users, data.notifications
  ]);

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
