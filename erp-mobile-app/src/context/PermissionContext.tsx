import React, { createContext, useContext, useState, useCallback } from 'react';
import * as permissionsApi from '../api/permissions';
import { getModuleConfigs, type ModuleToggles } from '../api/settings';
import { getBranches } from '../api/branches';
import { listCacheKeys, listCacheRemove } from '../lib/listCache';
import { FEATURE_MOBILE_PERMISSION_V2 } from '../config/featureFlags';
import { isAdminOrOwnerAppRole, canViewFinancialBalances } from '../config/functionalRoles';
import type { RolePermissionRow } from '../api/permissions';
import type { Screen } from '../types';

export type ModuleConfigStatus = 'loading' | 'ok' | 'load_error' | 'no_company';

interface PermissionState {
  permissions: RolePermissionRow[];
  branchIds: string[];
  moduleToggles: ModuleToggles;
  moduleConfigStatus: ModuleConfigStatus;
  isPermissionLoaded: boolean;
  isAdminOrOwner: boolean;
  isOwner: boolean;
  canViewBalances: boolean;
}

interface PermissionContextValue extends PermissionState {
  hasPermission: (code: string) => boolean;
  hasBranchAccess: (branchId: string) => boolean;
  canUseFullAccounting: boolean;
  canViewCustomerLedger: boolean;
  canViewSupplierLedger: boolean;
  shouldScopeStudioToOwnOnly: boolean;
  /** Company Module Toggles (same as Web): apply to all users/roles in this business. If module is off, hidden for everyone. */
  isModuleEnabled: (screenId: Screen) => boolean;
  /** User-facing hint when modules are hidden due to config load failure or admin toggles. */
  moduleConfigBanner: string | null;
  /** profileId = public users.id for user_branches; companyId = fallback when user has no assigned branches (single-branch company). */
  reload: (
    userId: string,
    appRole: string,
    profileId?: string,
    companyId?: string,
    options?: { fresh?: boolean },
  ) => Promise<void>;
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
  moduleConfigStatus: 'loading',
  isPermissionLoaded: false,
  isAdminOrOwner: false,
  isOwner: false,
  canViewBalances: false,
};

function resolveModuleConfigStatus(
  companyId: string | undefined,
  moduleRes: { data: ModuleToggles | null; error: unknown }
): ModuleConfigStatus {
  if (!companyId) return 'no_company';
  if (moduleRes.error || !moduleRes.data) return 'load_error';
  return 'ok';
}

function buildModuleConfigBanner(
  status: ModuleConfigStatus,
  toggles: ModuleToggles,
  isAdminOrOwner: boolean
): string | null {
  if (status === 'no_company') {
    return 'Company not linked to your account. Contact your administrator.';
  }
  if (status === 'load_error') {
    return 'Could not load company modules. Check internet connection and try logging out and back in.';
  }
  const companyOff =
    !toggles.posModuleEnabled ||
    !toggles.rentalModuleEnabled ||
    !toggles.studioModuleEnabled ||
    !toggles.accountingModuleEnabled;
  if (status === 'ok' && companyOff && isAdminOrOwner) {
    return 'Some modules are off for this business. As admin or owner, turn them on here under Settings → Company modules, or in Web ERP → Settings.';
  }
  return null;
}

const PermissionContext = createContext<PermissionContextValue>({
  ...defaultState,
  hasPermission: () => false,
  hasBranchAccess: () => false,
  canUseFullAccounting: true,
  canViewCustomerLedger: true,
  canViewSupplierLedger: true,
  shouldScopeStudioToOwnOnly: false,
  isModuleEnabled: () => true,
  moduleConfigBanner: null,
  reload: async () => {},
});

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PermissionState>(defaultState);

  const reload = useCallback(async (
    userId: string,
    appRole: string,
    profileId?: string,
    companyId?: string,
    options?: { fresh?: boolean },
  ) => {
    const branchUserId = profileId ?? userId;
    const useFresh = Boolean(options?.fresh);
    if (!FEATURE_MOBILE_PERMISSION_V2) {
      const moduleRes = companyId ? await getModuleConfigs(companyId) : { data: null, error: new Error('No company') };
      const moduleConfigStatus = resolveModuleConfigStatus(companyId, moduleRes);
      const toggles = moduleConfigStatus === 'ok' && moduleRes.data ? moduleRes.data : safeModuleTogglesWhenFail;
      setState({
        permissions: [],
        branchIds: [],
        moduleToggles: toggles,
        moduleConfigStatus,
        isPermissionLoaded: true,
        isAdminOrOwner: true,
        isOwner: true,
        canViewBalances: true,
      });
      return;
    }
    try {
      if (companyId && useFresh) {
        await listCacheRemove(listCacheKeys.branches(companyId));
      }
      const branchResult = await permissionsApi.getUserAccessibleBranches(
        userId,
        profileId ?? branchUserId,
        companyId,
        companyId && useFresh ? { fresh: true } : undefined,
      );
      const [perms, moduleRes] = await Promise.all([
        permissionsApi.getRolePermissions(appRole),
        companyId ? getModuleConfigs(companyId) : Promise.resolve({ data: null, error: new Error('No company') }),
      ]);
      let branchIds = branchResult.branchIds;
      if (branchIds.length === 0 && companyId && branchResult.branchCount <= 1) {
        const { data: companyBranches } = await getBranches(companyId);
        if ((companyBranches ?? []).length === 1) {
          branchIds = [companyBranches![0].id];
        }
      }
      const isAdminOrOwner = isAdminOrOwnerAppRole(appRole);
      const isOwner = (appRole || '').toLowerCase() === 'owner';
      const canViewBalances = canViewFinancialBalances(appRole);
      const moduleConfigStatus = resolveModuleConfigStatus(companyId, moduleRes);
      const moduleToggles =
        moduleConfigStatus === 'ok' && moduleRes.data ? moduleRes.data : safeModuleTogglesWhenFail;

      setState((prev) => {
        if (companyId && branchIds.length > prev.branchIds.length) {
          void listCacheRemove(listCacheKeys.branches(companyId));
        }
        return {
          permissions: perms,
          branchIds,
          moduleToggles,
          moduleConfigStatus,
          isPermissionLoaded: true,
          isAdminOrOwner,
          isOwner,
          canViewBalances,
        };
      });
    } catch (err) {
      console.error("[PermissionContext] Error loading permissions:", err);
      setState({
        permissions: [],
        branchIds: [],
        moduleToggles: safeModuleTogglesWhenFail,
        moduleConfigStatus: 'load_error',
        isPermissionLoaded: true,
        isAdminOrOwner: false,
        isOwner: false,
        canViewBalances: false,
      });
    }
  }, []);

  const hasPermission = useCallback(
    (code: string): boolean => {
      if (!FEATURE_MOBILE_PERMISSION_V2) return true;
      if (!state.isPermissionLoaded) return false;
      if (state.isAdminOrOwner) return true;

      const [module, action = 'view'] = code.split('.');

      return permissionsApi.hasModuleAction(state.permissions, module, action) ||
        (action === 'view' && permissionsApi.canViewModule(state.permissions, module));
    },
    [state.isPermissionLoaded, state.permissions, state.isAdminOrOwner]
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

  const moduleConfigBanner = state.isPermissionLoaded
    ? buildModuleConfigBanner(state.moduleConfigStatus, state.moduleToggles, state.isAdminOrOwner)
    : null;

  const fullAccounting = !FEATURE_MOBILE_PERMISSION_V2
    ? true
    : permissionsApi.canUseFullAccounting(state.permissions, state.isAdminOrOwner);
  const customerLedger = !FEATURE_MOBILE_PERMISSION_V2
    ? true
    : permissionsApi.canViewCustomerLedger(state.permissions, state.isAdminOrOwner);
  const supplierLedger = !FEATURE_MOBILE_PERMISSION_V2
    ? true
    : permissionsApi.canViewSupplierLedger(state.permissions, state.isAdminOrOwner);
  const studioOwnOnly = !FEATURE_MOBILE_PERMISSION_V2
    ? false
    : permissionsApi.shouldScopeStudioToOwnOnly(state.permissions, state.isAdminOrOwner);

  return (
    <PermissionContext.Provider
      value={{
        ...state,
        hasPermission,
        hasBranchAccess,
        canUseFullAccounting: fullAccounting,
        canViewCustomerLedger: customerLedger,
        canViewSupplierLedger: supplierLedger,
        shouldScopeStudioToOwnOnly: studioOwnOnly,
        isModuleEnabled,
        moduleConfigBanner,
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
  return hasPermission(`${module}.view`);
}
