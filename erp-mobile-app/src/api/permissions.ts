/**
 * Mobile: fetch role_permissions and user_branches from backend (same as Web ERP).
 * Used by PermissionContext after login.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type EngineRole = 'owner' | 'admin' | 'manager' | 'user';

export interface RolePermissionRow {
  role: string;
  module: string;
  action: string;
  allowed: boolean;
}

function mapAppRoleToEngine(role: string): EngineRole {
  const r = (role || '').toLowerCase();
  if (r === 'owner') return 'owner';
  if (r === 'admin' || r === 'super admin' || r === 'superadmin') return 'admin';
  if (r === 'manager' || r === 'accountant') return 'manager';
  return 'user';
}

/** Fetch role_permissions for the given app role (admin, manager, staff, viewer). */
export async function getRolePermissions(
  appRole: string
): Promise<RolePermissionRow[]> {
  if (!isSupabaseConfigured) return [];
  const engineRole = mapAppRoleToEngine(appRole);
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

/** Check if permission allows (module + action). */
export function hasModuleAction(
  perms: RolePermissionRow[],
  module: string,
  action: string
): boolean {
  return perms.some(
    (p) =>
      p.module === module &&
      (p.action === action || (action === 'view' && ['view', 'view_own', 'view_branch', 'view_company'].includes(p.action))) &&
    p.allowed
  );
}

/** Convenience: can user view this module? */
export function canViewModule(perms: RolePermissionRow[], module: string): boolean {
  if (perms.length === 0) return true; // no permissions loaded → allow (fallback)
  const viewActions: Record<string, string[]> = {
    sales: ['view_own', 'view_branch', 'view_company', 'view'],
    purchase: ['view'],
    pos: ['view', 'use'],
    studio: ['view'],
    rentals: ['view'],
    reports: ['view'],
    inventory: ['view'],
    products: ['view'],
    contacts: ['view'],
    accounts: ['view_full_accounting', 'view_customer', 'view_supplier'],
    expense: ['view'],
    settings: ['modify'],
  };
  const actions = viewActions[module] ?? ['view'];
  return actions.some((a) => hasModuleAction(perms, module, a));
}

/** Set one role permission (admin/owner only by RLS). */
export async function setRolePermission(
  role: EngineRole,
  module: string,
  action: string,
  allowed: boolean
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { error } = await supabase.from('role_permissions').upsert(
    { role, module, action, allowed },
    { onConflict: 'role,module,action' }
  );
  return { error: error?.message ?? null };
}
