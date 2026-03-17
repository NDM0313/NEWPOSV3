/**
 * Hook for permission checks. Uses SettingsContext currentUser.
 * Unified API: use hasPermission('module.action') so Web and Mobile share the same check.
 */
import { useCallback } from 'react';
import { useSettings } from '@/app/context/SettingsContext';
import {
  checkPermission as checkPermissionUtil,
  type PermissionModule,
  type PermissionAction,
} from '@/app/utils/checkPermission';

export function useCheckPermission() {
  const { currentUser } = useSettings();

  const checkPermission = useCallback(
    (module: PermissionModule, action: PermissionAction): boolean => {
      return checkPermissionUtil(currentUser, module, action);
    },
    [currentUser]
  );

  /** Unified: hasPermission('studio.view'), hasPermission('pos.view') — same as Mobile. */
  const hasPermission = useCallback(
    (code: string): boolean => {
      const [module, action] = code.split('.');
      const act = (action || 'view') as PermissionAction;
      return checkPermissionUtil(currentUser, module as PermissionModule, act);
    },
    [currentUser]
  );

  return {
    checkPermission,
    hasPermission,
    canEditSale: checkPermissionUtil(currentUser, 'sales', 'edit'),
    canDeleteSale: checkPermissionUtil(currentUser, 'sales', 'delete'),
    canCancelSale: checkPermissionUtil(currentUser, 'sales', 'cancel'),
    canDeletePurchase: checkPermissionUtil(currentUser, 'purchases', 'delete'),
    canViewReports: checkPermissionUtil(currentUser, 'reports', 'view'),
    canAccessAccounting: checkPermissionUtil(currentUser, 'accounting', 'view'),
    /** Can post accounting (manual entry, reversal, add account, pay courier). Admin/Manager only when they have accounting access. */
    canPostAccounting: checkPermissionUtil(currentUser, 'accounting', 'create'),
    canManageSettings: checkPermissionUtil(currentUser, 'settings', 'view'),
    canManageUsers: checkPermissionUtil(currentUser, 'users', 'view'),
    canAccessPurchases: checkPermissionUtil(currentUser, 'purchases', 'view'),
    canUsePos: checkPermissionUtil(currentUser, 'pos', 'use'),
    canViewSales: checkPermissionUtil(currentUser, 'sales', 'view'),
    canAccessStudio: checkPermissionUtil(currentUser, 'studio', 'view'),
    canManageRentals: checkPermissionUtil(currentUser, 'rentals', 'view'),
    canViewContacts: checkPermissionUtil(currentUser, 'contacts', 'view'),
    canManageProducts: checkPermissionUtil(currentUser, 'products', 'view'),
    canManageExpenses: checkPermissionUtil(currentUser, 'expenses', 'view'),
  };
}
