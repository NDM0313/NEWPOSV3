/**
 * Permission Inspector – live DB data for admin debug.
 * Uses same sources as production: users, role_permissions, user_branches, get_effective_user_branch.
 */

import { supabase } from '@/lib/supabase';
import { permissionService, type EngineRole, type RolePermissionRow } from '@/app/services/permissionService';
import { userService } from '@/app/services/userService';

export interface InspectorUser {
  id: string;
  auth_user_id: string | null;
  company_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  permissions?: Record<string, boolean>;
}

export interface UserBranchRow {
  user_id: string;
  branch_id: string;
  is_default: boolean | null;
}

export interface EffectiveBranchResult {
  effective_branch_id: string | null;
  branch_count: number;
  accessible_branch_ids: string[];
  requires_branch_selection: boolean;
}

export interface InspectorPayload {
  user: InspectorUser | null;
  rolePermissions: RolePermissionRow[];
  userBranches: UserBranchRow[];
  effectiveBranch: EffectiveBranchResult | null;
  companyBranchCount: number;
  engineRole: EngineRole;
}

function roleToEngine(role: string): EngineRole {
  const r = (role || '').toLowerCase();
  if (r === 'owner') return 'owner';
  if (r === 'admin' || r === 'super admin' || r === 'superadmin') return 'admin';
  if (r === 'manager' || r === 'accountant') return 'manager';
  return 'user';
}

/** Fetch users for current company (RLS: same company). */
export async function fetchCompanyUsers(companyId: string): Promise<InspectorUser[]> {
  const data = await userService.getAllUsers(companyId, { includeInactive: true });
  return (data || []).map((u: any) => ({
    id: u.id,
    auth_user_id: u.auth_user_id ?? null,
    company_id: u.company_id,
    email: u.email ?? '',
    full_name: u.full_name ?? '',
    role: u.role ?? 'user',
    is_active: u.is_active ?? true,
    permissions: (u.permissions as Record<string, boolean>) ?? {},
  }));
}

/** Fetch single user by id (public id or auth id). */
export async function fetchUserById(companyId: string, userId: string): Promise<InspectorUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, auth_user_id, company_id, email, full_name, role, is_active, permissions')
    .eq('company_id', companyId)
    .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    auth_user_id: data.auth_user_id ?? null,
    company_id: data.company_id,
    email: data.email ?? '',
    full_name: data.full_name ?? '',
    role: data.role ?? 'user',
    is_active: data.is_active ?? true,
    permissions: (data.permissions as Record<string, boolean>) ?? {},
  };
}

/** Fetch user_branches for a user. Try both public id and auth_user_id (table FK may be either). */
export async function fetchUserBranches(publicId: string, authId: string | null): Promise<UserBranchRow[]> {
  const ids = [publicId, ...(authId && authId !== publicId ? [authId] : [])].filter(Boolean);
  const { data, error } = await supabase
    .from('user_branches')
    .select('user_id, branch_id, is_default')
    .in('user_id', ids);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    user_id: r.user_id,
    branch_id: r.branch_id,
    is_default: r.is_default ?? null,
  }));
}

/** Call get_effective_user_branch RPC. p_user_id = auth or public user id. */
export async function fetchEffectiveUserBranch(pUserId: string): Promise<EffectiveBranchResult | null> {
  const { data, error } = await supabase.rpc('get_effective_user_branch', { p_user_id: pUserId });
  if (error) throw error;
  if (data == null) return null;
  const raw = data as {
    effective_branch_id?: string | null;
    branch_count?: number;
    accessible_branch_ids?: unknown;
    requires_branch_selection?: boolean;
  };
  let accessible: string[] = [];
  if (Array.isArray(raw.accessible_branch_ids)) {
    accessible = raw.accessible_branch_ids.map((x: unknown) =>
      typeof x === 'string' ? x : (x as { id?: string })?.id ?? String(x)
    );
  } else if (raw.accessible_branch_ids != null && typeof raw.accessible_branch_ids === 'object') {
    const arr = (raw.accessible_branch_ids as any);
    if (Array.isArray(arr)) accessible = arr.filter((x: unknown) => typeof x === 'string');
  }
  return {
    effective_branch_id: raw.effective_branch_id ?? null,
    branch_count: typeof raw.branch_count === 'number' ? raw.branch_count : 0,
    accessible_branch_ids: accessible,
    requires_branch_selection: Boolean(raw.requires_branch_selection),
  };
}

/** Company branch count for display. */
export async function fetchCompanyBranchCount(companyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('branches')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .or('is_active.is.null,is_active.eq.true');
  if (error) throw error;
  return count ?? 0;
}

/** Full inspector payload for selected user. */
export async function fetchInspectorPayload(companyId: string, userId: string): Promise<InspectorPayload> {
  const [user, branchCount] = await Promise.all([
    fetchUserById(companyId, userId),
    fetchCompanyBranchCount(companyId),
  ]);
  if (!user) {
    return {
      user: null,
      rolePermissions: [],
      userBranches: [],
      effectiveBranch: null,
      companyBranchCount: branchCount,
      engineRole: 'user',
    };
  }
  const engineRole = roleToEngine(user.role);
  const lookupId = user.auth_user_id || user.id;
  const [rolePermissions, userBranches, effectiveBranch] = await Promise.all([
    permissionService.getRolePermissions(engineRole),
    fetchUserBranches(user.id, user.auth_user_id).catch(() => []),
    fetchEffectiveUserBranch(lookupId).catch(() => null),
  ]);
  return {
    user,
    rolePermissions,
    userBranches,
    effectiveBranch,
    companyBranchCount: branchCount,
    engineRole,
  };
}
