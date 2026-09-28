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
 * Active session controls — one permission per action (PlayStation / Computer / Tables)
 */
export const canStartSession = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canStartSession');
};

export const canEndSession = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEndSession');
};

export const canEditActiveSessionTime = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditActiveSessionTime');
};

export const canEditControllers = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditControllers');
};

export const canEditControllersTime = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditControllersTime');
};

export const canLinkSessionTable = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canLinkSessionTable');
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
 * Check if user can add manual deductions for employees
 */
export const canAddManualDeduction = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canAddManualDeduction');
};

/**
 * Check if user can apply manual discounts on orders/bills (POS)
 */
export const canApplyManualDiscount = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canApplyManualDiscount');
};

/**
 * Check if user can move an order from one table to another
 */
export const canMoveOrderTableToTable = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canMoveOrderTableToTable');
};

/**
 * Check if user can move a bill from one table to another
 */
export const canMoveBillTableToTable = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canMoveBillTableToTable');
};

/**
 * Check if user can move a takeaway bill to a table
 */
export const canMoveBillTakeawayToTable = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canMoveBillTakeawayToTable');
};

/**
 * Check if user can move a delivery bill to a table
 */
export const canMoveBillDeliveryToTable = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canMoveBillDeliveryToTable');
};

/**
 * Check if user can change order status on the kitchen display
 */
export const canUpdateOrderStatus = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canUpdateOrderStatus');
};

/**
 * Check if user can review customer (QR) order requests — accept/reject/edit pending
 */
export const canReviewCustomerOrders = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canReviewCustomerOrders');
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
 * Check if user can create a new takeaway order
 */
export const canCreateTakeaway = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canCreateTakeaway');
};

/**
 * Check if user can create a new delivery order
 */
export const canCreateDelivery = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canCreateDelivery');
};

/**
 * Check if user can edit a takeaway bill (items / move)
 */
export const canEditTakeaway = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditTakeaway');
};

/**
 * Check if user can edit a delivery bill (items / move)
 */
export const canEditDelivery = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditDelivery');
};

/**
 * Check if user can edit bills from the Bills page (items / move)
 */
export const canEditBill = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditBill');
};

/**
 * Customers page: view / add / edit / delete.
 */
export const canViewCustomers = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'customers');
};

export const canAddCustomer = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canAddCustomer');
};

export const canEditCustomer = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditCustomer');
};

export const canDeleteCustomer = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canDeleteCustomer');
};

/**
 * Takeaway / delivery scoped payments: full vs partial.
 */
export const canPayFullTakeaway = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canPayFullTakeaway');
};

export const canPayPartialTakeaway = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canPayPartialTakeaway');
};

export const canPayFullDelivery = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canPayFullDelivery');
};

export const canPayPartialDelivery = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canPayPartialDelivery');
};

/**
 * Check if user can open the Bills page
 */
export const canViewBills = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'bills');
};

/**
 * Organization owner check (role owner or matches organization.owner id).
 * Mirrors the inline logic previously used by Reports/Consumption pages.
 */
export const isOrganizationOwner = (user: any): boolean => {
  if (!user) return false;
  if (user.role === 'owner') return true;
  try {
    const owner = user.organization?.owner;
    const ownerId = typeof owner === 'object' && owner !== null
      ? String((owner as any)._id || (owner as any).id || owner)
      : String(owner || '');
    const uid = String(user._id || user.id || '');
    return !!ownerId && !!uid && ownerId === uid;
  } catch {
    return false;
  }
};

/**
 * Check if user can edit date/time filters (Bills / Reports / Consumption).
 * Admins/'all' pass via hasPermission; organization owners always pass.
 */
export const canEditDateFilters = (user: UserPermissions | null): boolean => {
  return hasPermission(user, 'canEditDateFilters') || isOrganizationOwner(user);
};

const DAY_MS = 86400000;

/**
 * Max selectable date-range length in days for this user.
 * null = unlimited (admins, 'all', owners, and users without an explicit limit).
 */
export function getMaxDateRangeDays(user: any): number | null {
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return null;
  if (Array.isArray(user.permissions) && user.permissions.includes('all')) return null;
  if (isOrganizationOwner(user)) return null;
  const v = Number((user as any).maxDateRangeDays);
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.floor(v);
}

/**
 * Is [start, end] within the user's allowed day limit?
 */
export function isDateRangeAllowed(start: Date, end: Date, user: any): boolean {
  const maxDays = getMaxDateRangeDays(user);
  if (maxDays == null) return true;
  const s = start instanceof Date ? start.getTime() : new Date(start).getTime();
  const e = end instanceof Date ? end.getTime() : new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return false;
  return e - s <= maxDays * DAY_MS;
}

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
