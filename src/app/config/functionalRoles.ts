/**
 * Canonical functional roles for UI assignment and permission mapping.
 * DB engine roles (role_permissions.role): owner | admin | manager | user
 */

import type { EngineRole } from '@/app/services/permissionService';

export type UiPermissionRole = 'Admin' | 'Manager' | 'Staff';

/** Values stored on users.role for new/edited users */
export type AssignableAppRole = 'admin' | 'manager' | 'salesman';

export const ASSIGNABLE_APP_ROLES: readonly AssignableAppRole[] = ['admin', 'manager', 'salesman'];

export const FUNCTIONAL_ROLE_OPTIONS: ReadonlyArray<{ value: AssignableAppRole; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'salesman', label: 'Worker / Salesman' },
];

const WORKER_ALIASES = new Set([
  'staff',
  'salesman',
  'cashier',
  'inventory',
  'viewer',
  'user',
  'salesperson',
  'inventory_clerk',
]);

/** Canonize role string: lower, trim, underscores → spaces. */
function canonAppRoleRaw(role: string | null | undefined): string {
  return (role ?? '')
    .toLowerCase()
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Platform operators (users.role enum): developer / super_admin.
 * They keep their DB role for Dev Tools gates, but permission engine treats them as Admin
 * so sidebar modules like Accounting (ledger view) are not stuck behind the worker (`user`) matrix.
 */
export function isPlatformOperatorAppRole(role: string | null | undefined): boolean {
  const r = canonAppRoleRaw(role);
  return r === 'developer' || r === 'super admin' || r === 'superadmin';
}

/** Admin, owner, and platform operators may see all company branches (+ All Branches). */
export function hasCompanyWideBranchAccess(role: string | null | undefined): boolean {
  const r = canonAppRoleRaw(role);
  return r === 'admin' || r === 'owner' || isPlatformOperatorAppRole(role);
}

/** Normalize legacy users.role strings to assignable or system values. */
export function normalizeAppRole(role: string | null | undefined): string {
  const r = canonAppRoleRaw(role) || 'salesman';
  if (r === 'owner') return 'owner';
  if (r === 'developer') return 'developer';
  if (r === 'admin' || r === 'super admin' || r === 'superadmin') return 'admin';
  if (r === 'manager' || r === 'accountant') return 'manager';
  if (WORKER_ALIASES.has(r)) return 'salesman';
  return 'salesman';
}

export function mapAppRoleToEngineRole(role: string | null | undefined): EngineRole {
  if (isPlatformOperatorAppRole(role)) return 'admin';
  const r = normalizeAppRole(role);
  if (r === 'owner') return 'owner';
  if (r === 'admin') return 'admin';
  if (r === 'manager') return 'manager';
  return 'user';
}

export function mapAppRoleToUiRole(role: string | null | undefined): UiPermissionRole {
  if (isPlatformOperatorAppRole(role)) return 'Admin';
  const r = normalizeAppRole(role);
  if (r === 'owner' || r === 'admin') return 'Admin';
  if (r === 'manager') return 'Manager';
  return 'Staff';
}

export function isAdminUiRole(uiRole: UiPermissionRole): boolean {
  return uiRole === 'Admin';
}

export function getFunctionalRoleLabel(appRole: string | null | undefined): string {
  const raw = canonAppRoleRaw(appRole);
  if (raw === 'developer') return 'Developer (platform)';
  if (raw === 'super admin' || raw === 'superadmin') return 'Super Admin (platform)';
  const r = normalizeAppRole(appRole);
  if (r === 'owner') return 'Owner (system)';
  if (r === 'admin') return 'Admin';
  if (r === 'manager') return 'Manager';
  return 'Worker / Salesman';
}

/** Engine role column label in permission matrix */
export function getEngineRoleLabel(engineRole: EngineRole): string {
  switch (engineRole) {
    case 'owner':
      return 'Owner (system)';
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    case 'user':
      return 'Worker / Salesman';
    default:
      return engineRole;
  }
}
