/**
 * Centralized permission utility for ERP.
 * Use everywhere - no UI-only checks. Backend must validate separately via RLS.
 *
 * Maps: module + action -> UserPermissions flags
 *
 * Backend: Use has_module_permission(module_name, permission_type) RPC in Supabase.
 * UI: Use checkPermission(permissions, module, action) or useCheckPermission() hook.
 */

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'cancel' | 'use';

export interface UserPermissions {
  role: 'Admin' | 'Manager' | 'Staff';
  canCreateSale: boolean;
  canEditSale: boolean;
  canDeleteSale: boolean;
  /** Cancel invoice: Admin + Manager only (Cashier cannot cancel) */
  canCancelSale?: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
  canManageUsers: boolean;
  canAccessAccounting: boolean;
  canMakePayments: boolean;
  canReceivePayments: boolean;
  canManageExpenses: boolean;
  canManageProducts: boolean;
  canManagePurchases: boolean;
  canManageRentals: boolean;
  canEditPurchase?: boolean;
  canDeletePurchase?: boolean;
  /** POS access from role_permissions (pos.use / pos.view) */
  canUsePos?: boolean;
  /** Studio Production access from role_permissions (studio.view / create / edit / delete) */
  canAccessStudio?: boolean;
}

/** Module names for permission checks */
export type PermissionModule =
  | 'sales'
  | 'purchases'
  | 'pos'
  | 'studio'
  | 'rentals'
  | 'reports'
  | 'settings'
  | 'users'
  | 'accounting'
  | 'payments'
  | 'expenses'
  | 'products';

/**
 * Check if user has permission for given module + action.
 * Admin always has full access. Manager/Staff use granular flags.
 */
export function checkPermission(
  permissions: UserPermissions,
  module: PermissionModule,
  action: PermissionAction
): boolean {
  if (!permissions) return false;

  // Admin bypass - full access
  if (permissions.role === 'Admin') return true;

  switch (module) {
    case 'sales':
      if (action === 'view') return permissions.canCreateSale || permissions.canEditSale || permissions.canDeleteSale || (permissions.canCancelSale ?? false);
      if (action === 'create') return permissions.canCreateSale;
      if (action === 'edit') return permissions.canEditSale;
      if (action === 'delete') return permissions.canDeleteSale;
      if (action === 'cancel') return permissions.canCancelSale ?? false;
      return false;

    case 'purchases':
      if (action === 'view') return permissions.canManagePurchases === true;
      if (action === 'create') return permissions.canManagePurchases === true;
      if (action === 'edit') return permissions.canEditPurchase ?? permissions.canManagePurchases === true;
      if (action === 'delete') return permissions.canDeletePurchase ?? false; // Delete restricted by default
      return false;

    case 'pos':
      return (action === 'view' || action === 'use') && permissions.canUsePos === true;

    case 'studio':
      return (action === 'view' || action === 'create' || action === 'edit' || action === 'delete') && permissions.canAccessStudio === true;

    case 'rentals':
      return (action === 'view' || action === 'create' || action === 'edit' || action === 'delete') && permissions.canManageRentals === true;

    case 'reports':
      return action === 'view' && permissions.canViewReports === true;

    case 'settings':
      return permissions.canManageSettings === true;

    case 'users':
      return permissions.canManageUsers === true;

    case 'accounting':
      return action === 'view' && permissions.canAccessAccounting === true;

    case 'payments':
      if (action === 'view') return permissions.canMakePayments || permissions.canReceivePayments;
      if (action === 'create') return permissions.canMakePayments || permissions.canReceivePayments;
      return permissions.canMakePayments || permissions.canReceivePayments;

    case 'expenses':
      return permissions.canManageExpenses === true;

    case 'products':
      return permissions.canManageProducts === true;

    case 'rentals':
      return permissions.canManageRentals === true;

    default:
      return false;
  }
}

/** Convenience: can user edit sales? */
export function canEditSale(p: UserPermissions): boolean {
  return checkPermission(p, 'sales', 'edit');
}

/** Convenience: can user delete sales? */
export function canDeleteSale(p: UserPermissions): boolean {
  return checkPermission(p, 'sales', 'delete');
}

/** Convenience: can user cancel invoice? (Admin + Manager; Cashier cannot) */
export function canCancelSale(p: UserPermissions): boolean {
  return checkPermission(p, 'sales', 'cancel');
}

/** Convenience: can user delete purchases? (restricted) */
export function canDeletePurchase(p: UserPermissions): boolean {
  return checkPermission(p, 'purchases', 'delete');
}

/** Convenience: can user view financial reports? */
export function canViewReports(p: UserPermissions): boolean {
  return checkPermission(p, 'reports', 'view');
}

/**
 * Backend-friendly: check by role + module + action.
 * Use when only role is available (e.g. from get_user_role() RPC).
 * Admin always allowed. Manager/Staff require full permissions - use checkPermission().
 * Backend must validate via RLS / has_module_permission().
 */
export type UserRole = 'Admin' | 'Manager' | 'Staff';

export function checkPermissionByRole(
  role: UserRole | string,
  _module: PermissionModule,
  _action: PermissionAction
): boolean {
  const r = (role || '').toString();
  if (r === 'Admin' || r.toLowerCase() === 'admin') return true;
  return false;
}
