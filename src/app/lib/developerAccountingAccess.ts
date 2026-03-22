/**
 * Developer Integrity Lab (Accounting Test Bench) — access control.
 * Normal Admin/Manager/Staff are excluded unless env / dev exception below.
 */

function canonRole(role: string | null | undefined): string {
  return (role || '')
    .toLowerCase()
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

const INTEGRITY_LAB_ROLES_CANON = [
  'owner',
  'super admin',
  'superadmin',
  'super_admin',
  'accounting_auditor',
  'accounting auditor',
  'developer',
].map(canonRole);

export function canAccessDeveloperIntegrityLab(userRole: string | null | undefined): boolean {
  const r = canonRole(userRole);
  if (INTEGRITY_LAB_ROLES_CANON.includes(r)) return true;
  /** Staging / internal builds */
  if (import.meta.env?.VITE_ACCOUNTING_DIAGNOSTICS === '1') return true;
  /** Local dev: admin may open lab */
  if (import.meta.env.DEV && (r === 'admin' || r === 'owner')) return true;
  return false;
}

/** @deprecated Use canAccessDeveloperIntegrityLab */
export function canAccessAccountingDiagnostics(userRole: string | null | undefined): boolean {
  return canAccessDeveloperIntegrityLab(userRole);
}
