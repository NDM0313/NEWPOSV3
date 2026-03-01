/**
 * Hook for permission checks. Uses SettingsContext currentUser.
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

  return {
    checkPermission,
    canEditSale: checkPermissionUtil(currentUser, 'sales', 'edit'),
    canDeleteSale: checkPermissionUtil(currentUser, 'sales', 'delete'),
    canCancelSale: checkPermissionUtil(currentUser, 'sales', 'cancel'),
    canDeletePurchase: checkPermissionUtil(currentUser, 'purchases', 'delete'),
    canViewReports: checkPermissionUtil(currentUser, 'reports', 'view'),
    canAccessAccounting: checkPermissionUtil(currentUser, 'accounting', 'view'),
    canManageSettings: checkPermissionUtil(currentUser, 'settings', 'view'),
    canManageUsers: checkPermissionUtil(currentUser, 'users', 'view'),
    canAccessPurchases: checkPermissionUtil(currentUser, 'purchases', 'view'),
    canUsePos: checkPermissionUtil(currentUser, 'pos', 'use'),
    canViewSales: checkPermissionUtil(currentUser, 'sales', 'view'),
    canAccessStudio: checkPermissionUtil(currentUser, 'studio', 'view'),
    canManageRentals: checkPermissionUtil(currentUser, 'rentals', 'view'),
  };
}
