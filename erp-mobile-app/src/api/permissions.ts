/**
 * Mobile: fetch role_permissions and user_branches from backend (same as Web ERP).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getBranches } from './branches';
import {
  mapAppRoleToEngineRole,
  type EngineRole,
} from '../config/functionalRoles';

const branchAccessLogKeys = new Set<string>();
const BRANCH_ACCESS_TTL_MS = 60_000;
const branchAccessSessionCache = new Map<
  string,
  { expires: number; result: UserAccessibleBranchesResult }
>();

export interface BranchAccessOptions {
  fresh?: boolean;
}

export function invalidateBranchAccessSessionCache(): void {
  branchAccessSessionCache.clear();
  branchAccessLogKeys.clear();
}

export type { EngineRole };

/** Subset editable from mobile (admin/owner + `FEATURE_MOBILE_ROLE_MATRIX_EDITOR`). Owner/admin rows: Web ERP only. */
export const MOBILE_EDITABLE_ENGINE_ROLES: readonly ('manager' | 'user')[] = ['manager', 'user'];

export interface RolePermissionRow {
  role: string;
  module: string;
  action: string;
  allowed: boolean;
}

/** Fetch role_permissions for the given app role. */
export async function getRolePermissions(
  appRole: string
): Promise<RolePermissionRow[]> {
  if (!isSupabaseConfigured) return [];
  const engineRole = mapAppRoleToEngineRole(appRole);
  return getRolePermissionsByEngineRole(engineRole);
}

/** Fetch role_permissions by engine role (owner, admin, manager, user). */
export async function getRolePermissionsByEngineRole(
  engineRole: EngineRole
): Promise<RolePermissionRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('role_permissions')
    .select('role, module, action, allowed')
    .eq('role', engineRole)
    .order('module')
    .order('action');

  if (error) return [];
  return (data ?? []) as RolePermissionRow[];
}

/** Admin/owner may pick any company branch (and "All Branches"). Others: user_branches only. */
export function canPickAllCompanyBranches(role: string | undefined): boolean {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'owner';
}

export interface UserAccessibleBranchesResult {
  branchIds: string[];
  branchCount: number;
  effectiveBranchId: string | null;
  requiresBranchSelection: boolean;
}

function parseAccessibleBranchIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    try {
      return parseAccessibleBranchIds(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x : (x as { id?: string })?.id ?? String(x)))
    .filter(Boolean);
}

async function fetchUserBranchesDualId(
  authUserId: string | null | undefined,
  profileId?: string | null,
): Promise<UserAccessibleBranchesResult> {
  const uniqueIds = [...new Set([authUserId, profileId].filter((id): id is string => !!id?.trim()))];
  if (!uniqueIds.length) {
    return { branchIds: [], branchCount: 0, effectiveBranchId: null, requiresBranchSelection: false };
  }

  let query = supabase.from('user_branches').select('branch_id, is_default');
  if (uniqueIds.length > 1) {
    query = query.or(`user_id.eq.${uniqueIds[0]},user_id.eq.${uniqueIds[1]}`);
  } else {
    query = query.eq('user_id', uniqueIds[0]);
  }

  const { data, error } = await query;
  if (error || !data?.length) {
    return { branchIds: [], branchCount: 0, effectiveBranchId: null, requiresBranchSelection: false };
  }

  const branchIds = [
    ...new Set(data.map((r: { branch_id: string }) => r.branch_id).filter(Boolean)),
  ];
  const defaultRow =
    data.find((r: { is_default?: boolean | null }) => r.is_default === true) ?? data[0];
  const effectiveBranchId =
    (defaultRow as { branch_id?: string })?.branch_id ?? branchIds[0] ?? null;

  return {
    branchIds,
    branchCount: branchIds.length,
    effectiveBranchId,
    requiresBranchSelection: branchIds.length > 1 && !effectiveBranchId,
  };
}

/** Direct user_branches lookup — no company-wide branch merge (for restricted users / workers). */
export async function getUserAssignedBranchIds(
  authUserId: string | null | undefined,
  profileId?: string | null,
): Promise<UserAccessibleBranchesResult> {
  if (!isSupabaseConfigured) {
    return { branchIds: [], branchCount: 0, effectiveBranchId: null, requiresBranchSelection: false };
  }
  return fetchUserBranchesDualId(authUserId, profileId);
}

/**
 * Canonical branch access (mirrors Web SupabaseContext).
 * Merges get_effective_user_branch RPC with direct user_branches query (auth + profile ids).
 */
export async function getUserAccessibleBranches(
  authUserId: string | null | undefined,
  profileId?: string | null,
  companyId?: string | null,
  options?: BranchAccessOptions,
): Promise<UserAccessibleBranchesResult> {
  if (!isSupabaseConfigured) {
    return { branchIds: [], branchCount: 0, effectiveBranchId: null, requiresBranchSelection: false };
  }
  const lookupIds = [...new Set([authUserId, profileId].filter((id): id is string => !!id?.trim()))];
  if (!lookupIds.length) {
    return { branchIds: [], branchCount: 0, effectiveBranchId: null, requiresBranchSelection: false };
  }

  const cacheKey = `${authUserId ?? ''}:${profileId ?? ''}:${companyId ?? ''}`;
  if (!options?.fresh) {
    const cached = branchAccessSessionCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.result;
    }
  }

  const direct = await fetchUserBranchesDualId(authUserId, profileId);
  let rlsBranchIds: string[] = [];
  if (companyId) {
    const { data: rlsBranches } = await getBranches(
      companyId,
      options?.fresh ? { skipCache: true } : undefined,
    );
    rlsBranchIds = (rlsBranches ?? []).map((b) => b.id);
  }

  let rpcBranchIds: string[] = [];
  let effectiveBranchId: string | null = null;
  let requiresBranchSelection = false;
  let branchCount = 0;

  for (const lookupId of lookupIds) {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_effective_user_branch', {
      p_user_id: lookupId,
    });

    if (!rpcError && rpcData && typeof (rpcData as { branch_count?: number }).branch_count === 'number') {
      const payload = rpcData as {
        effective_branch_id?: string | null;
        accessible_branch_ids?: unknown;
        requires_branch_selection?: boolean;
        branch_count?: number;
      };
      branchCount = Math.max(branchCount, payload.branch_count ?? 0);
      rpcBranchIds = [
        ...new Set([...rpcBranchIds, ...parseAccessibleBranchIds(payload.accessible_branch_ids)]),
      ];
      if (payload.effective_branch_id) {
        effectiveBranchId = payload.effective_branch_id;
      }
      requiresBranchSelection =
        requiresBranchSelection || Boolean(payload.requires_branch_selection);
    }
  }

  const mergedIds = [...new Set([...rpcBranchIds, ...direct.branchIds])];
  let finalIds =
    mergedIds.length > 0
      ? mergedIds
      : branchCount <= 1 && rpcBranchIds.length > 0
        ? rpcBranchIds
        : direct.branchIds;

  if (branchCount > finalIds.length) {
    const longer =
      direct.branchIds.length >= rlsBranchIds.length ? direct.branchIds : rlsBranchIds;
    if (longer.length > finalIds.length) {
      finalIds = [...new Set([...finalIds, ...longer])];
    }
  }

  if (rlsBranchIds.length > 0) {
    finalIds = [...new Set([...finalIds, ...rlsBranchIds])];
  }

  const eff =
    effectiveBranchId ?? direct.effectiveBranchId ?? (finalIds.length === 1 ? finalIds[0] : null);

  const logKey = `${authUserId ?? ''}:${profileId ?? ''}:${companyId ?? ''}`;
  if (!branchAccessLogKeys.has(logKey)) {
    branchAccessLogKeys.add(logKey);
    console.log('[BRANCH ACCESS]', {
      authUserId,
      profileId,
      companyId,
      branchCount,
      rpcCount: rpcBranchIds.length,
      directCount: direct.branchIds.length,
      rlsCount: rlsBranchIds.length,
      mergedCount: finalIds.length,
    });
  }

  const result: UserAccessibleBranchesResult = {
    branchIds: finalIds,
    branchCount: Math.max(branchCount, finalIds.length),
    effectiveBranchId: eff,
    requiresBranchSelection:
      finalIds.length > 1 && (requiresBranchSelection || direct.requiresBranchSelection),
  };

  branchAccessSessionCache.set(cacheKey, {
    expires: Date.now() + BRANCH_ACCESS_TTL_MS,
    result,
  });

  return result;
}

/** Branch IDs the user can access (restricted users). Admin/owner callers use empty + unrestricted flag elsewhere. */
export async function getUserAccessibleBranchIds(
  authUserId: string | null | undefined,
  profileId?: string | null,
  companyId?: string | null,
  options?: BranchAccessOptions,
): Promise<string[]> {
  const result = await getUserAccessibleBranches(authUserId, profileId, companyId, options);
  return result.branchIds;
}

/** @deprecated Prefer getUserAccessibleBranchIds(authUserId, profileId). */
export async function getUserBranchIds(userId: string, profileId?: string | null): Promise<string[]> {
  return getUserAccessibleBranchIds(userId, profileId ?? userId);
}

const VIEW_ACTIONS = ['view', 'view_own', 'view_branch', 'view_company'];

/** Check if permission allows (module + action). */
export function hasModuleAction(
  perms: RolePermissionRow[],
  module: string,
  action: string
): boolean {
  const viewActionsForModule =
    action === 'view' ? VIEW_ACTIONS : [];
  return perms.some(
    (p) =>
      p.module === module &&
      (p.action === action || (action === 'view' && viewActionsForModule.includes(p.action))) &&
      p.allowed
  );
}

/** Convenience: can user view this module? */
export function canViewModule(perms: RolePermissionRow[], module: string): boolean {
  if (perms.length === 0) return false;
  const viewActions: Record<string, string[]> = {
    sales: VIEW_ACTIONS,
    purchase: VIEW_ACTIONS,
    pos: ['view', 'use'],
    studio: VIEW_ACTIONS,
    rentals: VIEW_ACTIONS,
    reports: ['view'],
    inventory: VIEW_ACTIONS.concat(['adjust', 'transfer']),
    ledger: ['view_full_accounting', 'view_customer', 'view_supplier', ...VIEW_ACTIONS],
    contacts: VIEW_ACTIONS,
    payments: ['receive', ...VIEW_ACTIONS],
    settings: ['modify'],
    users: ['assign_permissions', 'create', 'edit', 'delete'],
  };
  const actions = viewActions[module] ?? VIEW_ACTIONS;
  return actions.some((a) => perms.some((p) => p.module === module && p.action === a && p.allowed));
}

/** Full GL dashboard, cash/bank KPIs, manual entries, chart, daybook (owner/admin or ledger.view_full_accounting). */
export function canUseFullAccounting(
  perms: RolePermissionRow[],
  isAdminOrOwner: boolean
): boolean {
  if (isAdminOrOwner) return true;
  return hasModuleAction(perms, 'ledger', 'view_full_accounting');
}

/** Customer ledger / receivables aging. */
export function canViewCustomerLedger(
  perms: RolePermissionRow[],
  isAdminOrOwner: boolean
): boolean {
  if (canUseFullAccounting(perms, isAdminOrOwner)) return true;
  return hasModuleAction(perms, 'ledger', 'view_customer');
}

/** Supplier ledger / payables aging. */
export function canViewSupplierLedger(
  perms: RolePermissionRow[],
  isAdminOrOwner: boolean
): boolean {
  if (canUseFullAccounting(perms, isAdminOrOwner)) return true;
  return hasModuleAction(perms, 'ledger', 'view_supplier');
}

/** Studio list: restrict to sales the user created (view_own without company/branch scope). */
export function shouldScopeStudioToOwnOnly(
  perms: RolePermissionRow[],
  isAdminOrOwner: boolean
): boolean {
  if (isAdminOrOwner) return false;
  if (hasModuleAction(perms, 'studio', 'view_company')) return false;
  if (hasModuleAction(perms, 'studio', 'view_branch')) return false;
  return hasModuleAction(perms, 'studio', 'view_own');
}

/** Rental list: restrict to bookings user created or is assigned salesman on. */
export function shouldScopeRentalsToOwnOnly(
  perms: RolePermissionRow[],
  isAdminOrOwner: boolean
): boolean {
  if (isAdminOrOwner) return false;
  if (hasModuleAction(perms, 'rentals', 'view_company')) return false;
  if (hasModuleAction(perms, 'rentals', 'view_branch')) return false;
  return hasModuleAction(perms, 'rentals', 'view_own');
}

/** Set one role permission (admin/owner only by RLS). */
export async function setRolePermission(
  role: EngineRole,
  module: string,
  action: string,
  allowed: boolean
): Promise<{ error: string | null }> {
  if (role !== 'manager' && role !== 'user') {
    return { error: 'This role can only be edited in Web ERP.' };
  }
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { error } = await supabase.from('role_permissions').upsert(
    { role, module, action, allowed },
    { onConflict: 'role,module,action' }
  );
  return { error: error?.message ?? null };
}
