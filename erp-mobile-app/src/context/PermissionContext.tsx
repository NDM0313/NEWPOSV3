import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as permissionsApi from '../api/permissions';
import { FEATURE_MOBILE_PERMISSION_V2 } from '../config/featureFlags';
import type { RolePermissionRow } from '../api/permissions';

interface PermissionState {
  permissions: RolePermissionRow[];
  branchIds: string[];
  loaded: boolean;
  isAdminOrOwner: boolean;
}

interface PermissionContextValue extends PermissionState {
  hasPermission: (module: string, action?: string) => boolean;
  hasBranchAccess: (branchId: string) => boolean;
  reload: (userId: string, appRole: string, profileId?: string) => Promise<void>;
}

const defaultState: PermissionState = {
  permissions: [],
  branchIds: [],
  loaded: false,
  isAdminOrOwner: false,
};

const PermissionContext = createContext<PermissionContextValue>({
  ...defaultState,
  hasPermission: () => true,
  hasBranchAccess: () => true,
  reload: async () => {},
});

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PermissionState>(defaultState);

  const reload = useCallback(async (userId: string, appRole: string, profileId?: string) => {
    if (!FEATURE_MOBILE_PERMISSION_V2) {
      setState({ permissions: [], branchIds: [], loaded: true, isAdminOrOwner: true });
      return;
    }
    const branchUserId = profileId ?? userId;
    try {
      const [perms, branchIds] = await Promise.all([
        permissionsApi.getRolePermissions(appRole),
        permissionsApi.getUserBranchIds(branchUserId),
      ]);
      const r = (appRole || '').toLowerCase();
      const isAdminOrOwner = ['owner', 'admin', 'super admin', 'superadmin'].includes(r);
      setState({
        permissions: perms,
        branchIds,
        loaded: true,
        isAdminOrOwner,
      });
    } catch {
      setState({ permissions: [], branchIds: [], loaded: true, isAdminOrOwner: false });
    }
  }, []);

  const hasPermission = useCallback(
    (module: string, action: string = 'view'): boolean => {
      if (!FEATURE_MOBILE_PERMISSION_V2) return true;
      if (!state.loaded) return true;
      if (state.isAdminOrOwner) return true;
      return permissionsApi.hasModuleAction(state.permissions, module, action) ||
        permissionsApi.canViewModule(state.permissions, module);
    },
    [state.loaded, state.permissions, state.isAdminOrOwner]
  );

  const hasBranchAccess = useCallback(
    (branchId: string): boolean => {
      if (!FEATURE_MOBILE_PERMISSION_V2) return true;
      if (!state.loaded) return true;
      if (state.isAdminOrOwner) return true;
      if (state.branchIds.length === 0) return false;
      return state.branchIds.includes(branchId);
    },
    [state.loaded, state.branchIds, state.isAdminOrOwner]
  );

  return (
    <PermissionContext.Provider
      value={{
        ...state,
        hasPermission,
        hasBranchAccess,
        reload,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionContext);
  return ctx;
}

/** Screen-level: can user view this module? (sales, purchase, pos, studio, rentals, reports, inventory, products, contacts, accounts, expense, settings, dashboard) */
export function useCanViewModule(module: string): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(module, 'view');
}
