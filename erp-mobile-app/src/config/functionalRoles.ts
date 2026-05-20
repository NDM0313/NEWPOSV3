/**
 * Canonical functional roles — aligned with web ERP.
 */

export type EngineRole = 'owner' | 'admin' | 'manager' | 'user';

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

export function normalizeAppRole(role: string | null | undefined): string {
  const r = (role ?? 'salesman').toLowerCase().trim();
  if (r === 'owner') return 'owner';
  if (r === 'admin' || r === 'super admin' || r === 'superadmin') return 'admin';
  if (r === 'manager' || r === 'accountant') return 'manager';
  if (WORKER_ALIASES.has(r)) return 'salesman';
  return 'salesman';
}

export function mapAppRoleToEngineRole(role: string | null | undefined): EngineRole {
  const r = normalizeAppRole(role);
  if (r === 'owner') return 'owner';
  if (r === 'admin') return 'admin';
  if (r === 'manager') return 'manager';
  return 'user';
}

export function isAdminOrOwnerAppRole(role: string | null | undefined): boolean {
  const r = normalizeAppRole(role);
  return r === 'owner' || r === 'admin';
}

/** Owner, admin, and manager may see GL/cash and AR/AP balances; workers/salesmen may not. */
export function canViewFinancialBalances(role: string | null | undefined): boolean {
  const r = normalizeAppRole(role);
  return r === 'owner' || r === 'admin' || r === 'manager';
}

export function getFunctionalRoleLabel(appRole: string | null | undefined): string {
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
