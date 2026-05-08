/**
 * Developer-only surfaces: Integrity Lab, technical Settings (API/webhooks), RLS diagnostics.
 * Owners, admins, and standard staff do not see these unless they use the `developer` role
 * or controlled builds set VITE_ACCOUNTING_DIAGNOSTICS=1.
 */

export function canonRole(role: string | null | undefined): string {
  return (role || '')
    .toLowerCase()
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Integrity Lab / forensic GL tooling — developer role only (plus optional env below). */
export function canAccessDeveloperIntegrityLab(userRole: string | null | undefined): boolean {
  if (canonRole(userRole) === 'developer') return true;
  if (import.meta.env?.VITE_ACCOUNTING_DIAGNOSTICS === '1') return true;
  return false;
}

/** API keys, webhooks, experimental feature-flag strip in Settings — developer role or diagnostics env. */
export function canAccessTechnicalDeveloperSettings(userRole: string | null | undefined): boolean {
  return canonRole(userRole) === 'developer' || import.meta.env?.VITE_ACCOUNTING_DIAGNOSTICS === '1';
}

/** RLS / low-level permission inspector — developer-oriented. */
export function canAccessDeveloperPermissionDiagnostics(userRole: string | null | undefined): boolean {
  return canonRole(userRole) === 'developer' || import.meta.env?.VITE_ACCOUNTING_DIAGNOSTICS === '1';
}

/** @deprecated Use canAccessDeveloperIntegrityLab */
export function canAccessAccountingDiagnostics(userRole: string | null | undefined): boolean {
  return canAccessDeveloperIntegrityLab(userRole);
}
