/**
 * Permission Groups — single source of truth for organizing the permissions UI.
 * Used by PermissionPicker (add/edit user form + standalone permissions window).
 * Every permission id from the Users catalog must appear in exactly one group.
 */

export interface PermissionGroupDef {
  id: string;
  /** i18n key: users.permissionGroups.<id> */
  titleKey: string;
  /** icon key resolved inside PermissionPicker */
  icon: string;
  permissionIds: string[];
}

export const PERMISSION_GROUPS: PermissionGroupDef[] = [
  {
    id: 'general',
    titleKey: 'users.permissionGroups.general',
    icon: 'crown',
    permissionIds: ['all'],
  },
  {
    id: 'pages',
    titleKey: 'users.permissionGroups.pages',
    icon: 'layout',
    permissionIds: [
      'dashboard', 'playstation', 'computer', 'tables', 'takeaway', 'delivery',
      'cafe', 'billing', 'menu', 'kitchenDisplay', 'reports', 'consumption',
      'soldItems', 'inventory', 'warehouse', 'costs', 'payroll', 'users',
      'settings', 'shifts', 'auditLog', 'syncStatus', 'notifications', 'subscription',
    ],
  },
  {
    id: 'orders',
    titleKey: 'users.permissionGroups.orders',
    icon: 'cart',
    permissionIds: ['canAddOrder', 'canEditOrder', 'canDeleteOrder', 'canEditItemPrice'],
  },
  {
    id: 'bills',
    titleKey: 'users.permissionGroups.bills',
    icon: 'receipt',
    permissionIds: [
      'canPayFullBill', 'canPartialPayment', 'canEditPartialPayment',
      'canDeleteBill', 'view_all_bills', 'viewCustomerContacts',
    ],
  },
  {
    id: 'sessions',
    titleKey: 'users.permissionGroups.sessions',
    icon: 'timer',
    permissionIds: ['canEditSessionTime', 'canManageShifts'],
  },
  {
    id: 'menu',
    titleKey: 'users.permissionGroups.menu',
    icon: 'menu',
    permissionIds: ['canAddMenuItem', 'canEditMenuItem', 'canDeleteMenuItem'],
  },
  {
    id: 'devices',
    titleKey: 'users.permissionGroups.devices',
    icon: 'gamepad',
    permissionIds: ['canAddDevice', 'canEditDevice', 'canDeleteDevice'],
  },
  {
    id: 'inventory',
    titleKey: 'users.permissionGroups.inventory',
    icon: 'package',
    permissionIds: [
      'canViewInventory', 'canAddInventoryItem', 'canEditInventoryItem',
      'canDeleteInventoryItem', 'canAddStock', 'canRemoveStock', 'canAdjustStock',
      'canViewStockMovements', 'canEditStockMovement', 'canDeleteStockMovement',
    ],
  },
  {
    id: 'warehouse',
    titleKey: 'users.permissionGroups.warehouse',
    icon: 'warehouse',
    permissionIds: [
      'canTransferToInventory', 'canReturnToWarehouse', 'canAddWarehouseItem',
      'canEditWarehouseItem', 'canDeleteWarehouseItem', 'canViewWarehouseMovements',
      'canAdjustWarehouseStock', 'canEditWarehouseMovement', 'canDeleteWarehouseMovement',
    ],
  },
  {
    id: 'costs',
    titleKey: 'users.permissionGroups.costs',
    icon: 'wallet',
    permissionIds: ['canAddCost', 'canEditCost', 'canDeleteCost'],
  },
  {
    id: 'payroll',
    titleKey: 'users.permissionGroups.payroll',
    icon: 'payroll',
    permissionIds: ['canAddEmployee', 'canEditEmployee', 'canDeleteEmployee', 'canApproveAdvance'],
  },
  {
    id: 'kitchen',
    titleKey: 'users.permissionGroups.kitchen',
    icon: 'chef',
    permissionIds: ['canUpdateOrderStatus'],
  },
  {
    id: 'extras',
    titleKey: 'users.permissionGroups.extras',
    icon: 'tools',
    permissionIds: ['canDeleteNotification', 'canExportReports'],
  },
];

/**
 * Toggle one permission id, preserving the special 'all' semantics:
 * checking 'all' selects only 'all'; checking anything else drops 'all'.
 */
export const togglePermissionSelection = (selected: string[], permissionId: string, checked: boolean): string[] => {
  if (permissionId === 'all') {
    return checked ? ['all'] : selected.filter(p => p !== 'all');
  }
  if (checked) {
    const filtered = selected.filter(p => p !== 'all');
    return filtered.includes(permissionId) ? filtered : [...filtered, permissionId];
  }
  return selected.filter(p => p !== permissionId);
};
