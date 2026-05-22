/**
 * Mobile: fetch role_permissions and user_branches from backend (same as Web ERP).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  mapAppRoleToEngineRole,
  type EngineRole,
} from '../config/functionalRoles';

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

/** Fetch branch IDs the user has access to (user_branches). Returns empty if admin/owner (all branches). */
export async function getUserBranchIds(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('user_branches')
    .select('branch_id')
    .eq('user_id', userId);
  if (error) return [];
  return (data ?? []).map((r: { branch_id: string }) => r.branch_id);
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
