import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as permissionsApi from '../api/permissions';
import { FEATURE_MOBILE_PERMISSION_V2 } from '../config/featureFlags';
import type { RolePermissionRow } from '../api/permissions';

interface PermissionState {
  permissions: RolePermissionRow[];
  branchIds: string[];
  isPermissionLoaded: boolean;
  isAdminOrOwner: boolean;
  isOwner: boolean;
}

interface PermissionContextValue extends PermissionState {
  hasPermission: (module: string, action?: string) => boolean;
  hasBranchAccess: (branchId: string) => boolean;
  reload: (userId: string, appRole: string, profileId?: string) => Promise<void>;
}

const defaultState: PermissionState = {
  permissions: [],
  branchIds: [],
  isPermissionLoaded: false,
  isAdminOrOwner: false,
  isOwner: false,
};

const PermissionContext = createContext<PermissionContextValue>({
  ...defaultState,
  hasPermission: () => false,
  hasBranchAccess: () => false,
  reload: async () => {},
});

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PermissionState>(defaultState);

  const reload = useCallback(async (userId: string, appRole: string, profileId?: string) => {
    if (!FEATURE_MOBILE_PERMISSION_V2) {
      setState({ permissions: [], branchIds: [], isPermissionLoaded: true, isAdminOrOwner: true, isOwner: true });
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
      const isOwner = r === 'owner';
      
      console.log("[PermissionContext] Loaded permissions:", perms);
      console.log("[PermissionContext] Loaded branches:", branchIds);
      console.log("[PermissionContext] User Role:", r, "isAdminOrOwner:", isAdminOrOwner);

      setState({
        permissions: perms,
        branchIds,
        isPermissionLoaded: true,
        isAdminOrOwner,
        isOwner,
      });
    } catch (err) {
      console.error("[PermissionContext] Error loading permissions:", err);
      setState({ permissions: [], branchIds: [], isPermissionLoaded: true, isAdminOrOwner: false, isOwner: false });
    }
  }, []);

  const hasPermission = useCallback(
    (code: string): boolean => {
      if (!FEATURE_MOBILE_PERMISSION_V2) return true;
      if (!state.isPermissionLoaded) return false;
      if (state.isOwner) return true;
      
      const [module, action = 'view'] = code.split('.');
      
      const result = permissionsApi.hasModuleAction(state.permissions, module, action) ||
        (action === 'view' && permissionsApi.canViewModule(state.permissions, module));
        
      console.log(`[PermissionContext] hasPermission('${code}') = ${result}`);
      return result;
    },
    [state.isPermissionLoaded, state.permissions, state.isOwner]
  );

  const hasBranchAccess = useCallback(
    (branchId: string): boolean => {
      if (!FEATURE_MOBILE_PERMISSION_V2) return true;
      if (!state.isPermissionLoaded) return false;
      if (state.isAdminOrOwner) return true;
      if (!branchId) return false;
      
      const result = state.branchIds.includes(branchId);
      console.log(`[PermissionContext] hasBranchAccess('${branchId}') = ${result} (User has: ${JSON.stringify(state.branchIds)})`);
      return result;
    },
    [state.isPermissionLoaded, state.branchIds, state.isAdminOrOwner]
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
