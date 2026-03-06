import React, { createContext, useContext, useState, useCallback } from 'react';
import * as permissionsApi from '../api/permissions';
import { getModuleConfigs, type ModuleToggles } from '../api/settings';
import { getBranches } from '../api/branches';
import { FEATURE_MOBILE_PERMISSION_V2 } from '../config/featureFlags';
import type { RolePermissionRow } from '../api/permissions';
import type { Screen } from '../types';

interface PermissionState {
  permissions: RolePermissionRow[];
  branchIds: string[];
  moduleToggles: ModuleToggles;
  isPermissionLoaded: boolean;
  isAdminOrOwner: boolean;
  isOwner: boolean;
}

interface PermissionContextValue extends PermissionState {
  hasPermission: (module: string, action?: string) => boolean;
  hasBranchAccess: (branchId: string) => boolean;
  /** Company Module Toggles (same as Web): apply to all users/roles in this business. If module is off, hidden for everyone. */
  isModuleEnabled: (screenId: Screen) => boolean;
  /** profileId = public users.id for user_branches; companyId = fallback when user has no assigned branches (single-branch company). */
  reload: (userId: string, appRole: string, profileId?: string, companyId?: string) => Promise<void>;
}

const defaultModuleToggles: ModuleToggles = {
  rentalModuleEnabled: true,
  studioModuleEnabled: true,
  accountingModuleEnabled: true,
  posModuleEnabled: true,
};

/** When API fails or company not set: hide toggleable modules so Staff don't see POS/Rental etc. */
const safeModuleTogglesWhenFail: ModuleToggles = {
  rentalModuleEnabled: false,
  studioModuleEnabled: false,
  accountingModuleEnabled: false,
  posModuleEnabled: false,
};

const defaultState: PermissionState = {
  permissions: [],
  branchIds: [],
  moduleToggles: defaultModuleToggles,
  isPermissionLoaded: false,
  isAdminOrOwner: false,
  isOwner: false,
};

const PermissionContext = createContext<PermissionContextValue>({
  ...defaultState,
  hasPermission: () => false,
  hasBranchAccess: () => false,
  isModuleEnabled: () => true,
  reload: async () => {},
});

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PermissionState>(defaultState);

  const reload = useCallback(async (userId: string, appRole: string, profileId?: string, companyId?: string) => {
    const branchUserId = profileId ?? userId;
    if (!FEATURE_MOBILE_PERMISSION_V2) {
      const moduleRes = companyId ? await getModuleConfigs(companyId) : { data: null, error: new Error('No company') };
      const toggles = (moduleRes.error || !moduleRes.data) ? safeModuleTogglesWhenFail : moduleRes.data;
      setState({
        permissions: [],
        branchIds: [],
        moduleToggles: toggles,
        isPermissionLoaded: true,
        isAdminOrOwner: true,
        isOwner: true,
      });
      return;
    }
    try {
      const [perms, userBranchIds, moduleRes] = await Promise.all([
        permissionsApi.getRolePermissions(appRole),
        permissionsApi.getUserBranchIds(branchUserId),
        companyId ? getModuleConfigs(companyId) : Promise.resolve({ data: null, error: new Error('No company') }),
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
      const moduleToggles = (moduleRes.error || !moduleRes.data) ? safeModuleTogglesWhenFail : moduleRes.data;

      setState({
        permissions: perms,
        branchIds,
        moduleToggles,
        isPermissionLoaded: true,
        isAdminOrOwner,
        isOwner,
      });
    } catch (err) {
      console.error("[PermissionContext] Error loading permissions:", err);
      setState({
        permissions: [],
        branchIds: [],
        moduleToggles: safeModuleTogglesWhenFail,
        isPermissionLoaded: true,
        isAdminOrOwner: false,
        isOwner: false,
      });
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

  const isModuleEnabled = useCallback(
    (screenId: Screen): boolean => {
      const t = state.moduleToggles;
      switch (screenId) {
        case 'rental': return t.rentalModuleEnabled;
        case 'studio': return t.studioModuleEnabled;
        case 'pos': return t.posModuleEnabled;
        case 'accounts': return t.accountingModuleEnabled;
        default: return true;
      }
    },
    [state.moduleToggles]
  );

  return (
    <PermissionContext.Provider
      value={{
        ...state,
        hasPermission,
        hasBranchAccess,
        isModuleEnabled,
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
