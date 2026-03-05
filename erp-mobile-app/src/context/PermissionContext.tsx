import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as permissionsApi from '../api/permissions';
import { getBranches } from '../api/branches';
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
  /** profileId = public users.id for user_branches; companyId = fallback when user has no assigned branches (single-branch company). */
  reload: (userId: string, appRole: string, profileId?: string, companyId?: string) => Promise<void>;
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

  const reload = useCallback(async (userId: string, appRole: string, profileId?: string, companyId?: string) => {
    if (!FEATURE_MOBILE_PERMISSION_V2) {
      setState({ permissions: [], branchIds: [], isPermissionLoaded: true, isAdminOrOwner: true, isOwner: true });
      return;
    }
    const branchUserId = profileId ?? userId;
    try {
      const [perms, userBranchIds] = await Promise.all([
        permissionsApi.getRolePermissions(appRole),
        permissionsApi.getUserBranchIds(branchUserId),
      ]);
      let branchIds = userBranchIds;
      if (branchIds.length === 0 && companyId) {
        const { data: companyBranches } = await getBranches(companyId);
        if (companyBranches?.length === 1) {
          branchIds = [companyBranches[0].id];
        }
      }
      const r = (appRole || '').toLowerCase();
      const isAdminOrOwner = ['owner', 'admin', 'super admin', 'superadmin'].includes(r);
      const isOwner = r === 'owner';
      
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
      
      return permissionsApi.hasModuleAction(state.permissions, module, action) ||
        (action === 'view' && permissionsApi.canViewModule(state.permissions, module));
    },
    [state.isPermissionLoaded, state.permissions, state.isOwner]
  );

  const hasBranchAccess = useCallback(
    (branchId: string): boolean => {
      if (!FEATURE_MOBILE_PERMISSION_V2) return true;
      if (!state.isPermissionLoaded) return false;
      if (state.isAdminOrOwner) return true;
      if (!branchId) return false;
      
      return state.branchIds.includes(branchId);
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
