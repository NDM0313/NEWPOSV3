/**
 * usePermissions – read cached permissions from PermissionEngine (no DB during session).
 * Use for UI permission checks. Permissions are loaded once at login via SettingsContext.
 */
import { useMemo } from 'react';
import { useSettings } from '@/app/context/SettingsContext';
import { getDerivedPermissions, has } from '@/app/services/permissionEngine';
import { checkPermission, type PermissionModule, type PermissionAction } from '@/app/utils/checkPermission';

export function usePermissions() {
  const { currentUser } = useSettings();
  const derived = getDerivedPermissions();

  const permissions = useMemo(() => derived ?? currentUser ?? null, [derived, currentUser]);
  const isLoaded = Boolean(permissions);

  const checkPermissionFn = useMemo(() => {
    return (module: PermissionModule, action: PermissionAction): boolean => {
      if (permissions) return checkPermission(permissions, module, action);
      return false;
    };
  }, [permissions]);

  const hasPermission = useMemo(() => {
    return (code: string): boolean => {
      if (!permissions) return false;
      const [module, action] = code.split('.');
      const act = (action || 'view') as PermissionAction;
      return checkPermission(permissions, module as PermissionModule, act);
    };
  }, [permissions]);

  return {
    permissions,
    isLoaded,
    has: (module: string, action: string) => has(module, action),
    hasPermission,
    checkPermission: checkPermissionFn,
  };
}
