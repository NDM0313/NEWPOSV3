/**
 * Canonical functional roles — aligned with web ERP.
 */

export type EngineRole = 'owner' | 'admin' | 'manager' | 'user';

export type AssignableAppRole = 'admin' | 'manager' | 'salesman';

/** Platform operators who may switch across companies (mobile). */
export type PlatformAppRole = 'developer' | 'super_admin';

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

function canonRoleKey(role: string | null | undefined): string {
  return (role ?? '')
    .toLowerCase()
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

/** developer / super_admin (and aliases) — platform company switch + admin-equivalent engine role. */
export function isPlatformCompanyOperator(role: string | null | undefined): boolean {
  const r = canonRoleKey(role);
  return r === 'developer' || r === 'super admin' || r === 'superadmin';
}

export function normalizeAppRole(role: string | null | undefined): string {
  const raw = (role ?? 'salesman').toLowerCase().trim();
  const r = canonRoleKey(role);
  if (raw === 'owner' || r === 'owner') return 'owner';
  if (isPlatformCompanyOperator(role)) {
    return r === 'developer' ? 'developer' : 'super_admin';
  }
  if (r === 'admin' || raw === 'admin') return 'admin';
  if (r === 'manager' || r === 'accountant') return 'manager';
  if (WORKER_ALIASES.has(raw) || WORKER_ALIASES.has(r.replace(/ /g, '_'))) return 'salesman';
  return 'salesman';
}

export function mapAppRoleToEngineRole(role: string | null | undefined): EngineRole {
  if (isPlatformCompanyOperator(role)) return 'admin';
  const r = normalizeAppRole(role);
  if (r === 'owner') return 'owner';
  if (r === 'admin' || r === 'developer' || r === 'super_admin') return 'admin';
  if (r === 'manager') return 'manager';
  return 'user';
}

export function isAdminOrOwnerAppRole(role: string | null | undefined): boolean {
  if (isPlatformCompanyOperator(role)) return true;
  const r = normalizeAppRole(role);
  return r === 'owner' || r === 'admin' || r === 'developer' || r === 'super_admin';
}

/** Owner, admin, and manager may see GL/cash and AR/AP balances; workers/salesmen may not. */
export function canViewFinancialBalances(role: string | null | undefined): boolean {
  if (isPlatformCompanyOperator(role)) return true;
  const r = normalizeAppRole(role);
  return r === 'owner' || r === 'admin' || r === 'manager' || r === 'developer' || r === 'super_admin';
}

export function getFunctionalRoleLabel(appRole: string | null | undefined): string {
  if (isPlatformCompanyOperator(appRole)) {
    const r = normalizeAppRole(appRole);
    return r === 'developer' ? 'Developer' : 'Super Admin';
  }
  const r = normalizeAppRole(appRole);
  if (r === 'owner') return 'Owner (system)';
  if (r === 'admin') return 'Admin';
  if (r === 'manager') return 'Manager';
  return 'Worker / Salesman';
}

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
