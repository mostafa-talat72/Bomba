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
