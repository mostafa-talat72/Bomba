/**
 * Permission Helper Utility
 * Provides functions to check user permissions for various actions
 */

export interface UserPermissions {
  permissions?: string[];
  role?: string;
}

/**
 * Check if user has a specific permission
 * @param user - User object with permissions array
 * @param permission - Permission to check
 * @returns boolean - true if user has permission
 */
export const hasPermission = (user: UserPermissions | null, permission: string): boolean => {
  if (!user || !user.permissions) return false;
  
  // Admin role or 'all' permission grants access to everything
  if (user.role === 'admin' || user.permissions.includes('all')) {
    return true;
  }
  
  return user.permissions.includes(permission);
};

/**
 * Check if user can add orders
 */
export const canAddOrder = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canAddOrder');
};

/**
 * Check if user can edit orders
 */
export const canEditOrder = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditOrder');
};

/**
 * Check if user can delete orders
 */
export const canDeleteOrder = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canDeleteOrder');
};

/**
 * Check if user can make partial payments
 */
export const canPartialPayment = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canPartialPayment');
};

/**
 * Check if user can edit session time after completion
 */
export const canEditSessionTime = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditSessionTime');
};

/**
 * Check if user can pay full bill
 */
export const canPayFullBill = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canPayFullBill');
};

/**
 * Check if user can delete bills
 */
export const canDeleteBill = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canDeleteBill');
};

/**
 * Check if user can edit partial payments (for items or sessions)
 */
export const canEditPartialPayment = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditPartialPayment');
};

/**
 * Check if user can edit item price in order
 */
export const canEditItemPrice = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditItemPrice');
};

/**
 * Check if user can view customer phone numbers and addresses (delivery privacy).
 * Admins and 'all' always pass; cashiers need the explicit permission.
 */
export const canViewCustomerContacts = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'viewCustomerContacts');
};

/**
 * Check if user can add menu items/sections/categories
 */
export const canAddMenuItem = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canAddMenuItem');
};

/**
 * Check if user can edit menu items/sections/categories
 */
export const canEditMenuItem = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditMenuItem');
};

/**
 * Check if user can delete menu items/sections/categories (also merge-as-sizes)
 */
export const canDeleteMenuItem = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canDeleteMenuItem');
};

/**
 * Check if user can add gaming devices (playstation/computer)
 */
export const canAddDevice = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canAddDevice');
};

/**
 * Check if user can edit gaming devices
 */
export const canEditDevice = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditDevice');
};

/**
 * Check if user can delete gaming devices
 */
export const canDeleteDevice = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canDeleteDevice');
};

/**
 * Check if user can add costs
 */
export const canAddCost = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canAddCost');
};

/**
 * Check if user can edit costs (also payments and categories)
 */
export const canEditCost = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditCost');
};

/**
 * Check if user can delete costs
 */
export const canDeleteCost = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canDeleteCost');
};

/**
 * Check if user can open/close shifts
 */
export const canManageShifts = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canManageShifts');
};

/**
 * Check if user can add employees
 */
export const canAddEmployee = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canAddEmployee');
};

/**
 * Check if user can edit employees (profile, payments, attendance, advances, deductions, bonuses)
 */
export const canEditEmployee = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditEmployee');
};

/**
 * Check if user can delete/terminate employees
 */
export const canDeleteEmployee = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canDeleteEmployee');
};

/**
 * Check if user can approve/reject employee advances
 */
export const canApproveAdvance = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canApproveAdvance');
};

/**
 * Check if user can change order status on the kitchen display
 */
export const canUpdateOrderStatus = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canUpdateOrderStatus');
};

/**
 * Check if user can delete notifications
 */
export const canDeleteNotification = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canDeleteNotification');
};

/**
 * Check if user can export reports (PDF/Excel)
 */
export const canExportReports = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canExportReports');
};

/**
 * Check if user has any of the specified permissions
 */
export const hasAnyPermission = (user: UserPermissions | null, permissions: string[]): boolean => {
  if (!user || !user.permissions) return false;
  
  // Admin role or 'all' permission grants access to everything
  if (user.role === 'admin' || user.permissions.includes('all')) {
    return true;
  }
  
  return permissions.some(permission => user.permissions?.includes(permission));
};

/**
 * Check if user has all of the specified permissions
 */
export const hasAllPermissions = (user: UserPermissions | null, permissions: string[]): boolean => {
  if (!user || !user.permissions) return false;
  
  // Admin role or 'all' permission grants access to everything
  if (user.role === 'admin' || user.permissions.includes('all')) {
    return true;
  }
  
  return permissions.every(permission => user.permissions?.includes(permission));
};
