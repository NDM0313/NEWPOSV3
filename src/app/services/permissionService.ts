import { supabase } from '@/lib/supabase';

export type EngineRole = 'owner' | 'admin' | 'manager' | 'user';

export interface RolePermissionRow {
  role: string;
  module: string;
  action: string;
  allowed: boolean;
}

const MODULES_ACTIONS: Record<string, string[]> = {
  sales: ['view_own', 'view_branch', 'view_company', 'create', 'edit', 'delete'],
  pos: ['view', 'use'],
  purchase: ['view', 'create', 'edit', 'delete'],
  studio: ['view', 'create', 'edit', 'delete'],
  rentals: ['view', 'create', 'edit', 'delete'],
  payments: ['receive', 'edit', 'delete'],
  ledger: ['view_customer', 'view_supplier', 'view_full_accounting'],
  inventory: ['view', 'adjust', 'transfer'],
  contacts: ['view', 'edit'],
  reports: ['view'],
  users: ['create', 'edit', 'delete', 'assign_permissions'],
  settings: ['modify'],
};

export const PERMISSION_MODULES = Object.keys(MODULES_ACTIONS);
export const getActionsForModule = (module: string): string[] => MODULES_ACTIONS[module] ?? [];

/**
 * Fetch all role_permissions for a role (admin/owner only by RLS).
 */
export async function getRolePermissions(role: EngineRole): Promise<RolePermissionRow[]> {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('role, module, action, allowed')
    .eq('role', role)
    .order('module')
    .order('action');
  if (error) throw error;
  return (data ?? []) as RolePermissionRow[];
}

/**
 * Fetch all role_permissions (for all roles). Admin/owner only.
 */
export async function getAllRolePermissions(): Promise<RolePermissionRow[]> {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('role, module, action, allowed')
    .order('role')
    .order('module')
    .order('action');
  if (error) throw error;
  return (data ?? []) as RolePermissionRow[];
}

/**
 * Set one permission. Upsert: insert or update allowed.
 * Admin/owner only (RLS on role_permissions).
 */
export async function setRolePermission(
  role: EngineRole,
  module: string,
  action: string,
  allowed: boolean
): Promise<void> {
  const { error } = await supabase.from('role_permissions').upsert(
    { role, module, action, allowed },
    { onConflict: 'role,module,action' }
  );
  if (error) throw error;
}

/**
 * Set multiple permissions for a role (batch upsert).
 */
export async function setRolePermissionsBulk(
  role: EngineRole,
  updates: { module: string; action: string; allowed: boolean }[]
): Promise<void> {
  for (const u of updates) {
    await setRolePermission(role, u.module, u.action, u.allowed);
  }
}

export const permissionService = {
  getRolePermissions,
  getAllRolePermissions,
  setRolePermission,
  setRolePermissionsBulk,
  getActionsForModule,
  MODULES_ACTIONS,
  PERMISSION_MODULES,
};
