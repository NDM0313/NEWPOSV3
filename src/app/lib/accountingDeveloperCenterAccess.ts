/**
 * Read-only Accounting Developer Center — wider than Integrity Lab write surface.
 * Does NOT change canAccessDeveloperIntegrityLab / forensic write tool gates.
 */

import { canonRole } from './developerAccountingAccess';

const DEVELOPER_CENTER_ROLES = new Set([
  'admin',
  'super admin',
  'superadmin',
  'super_admin',
  'developer',
  'accounting auditor',
  'accounting_auditor',
  'owner',
]);

export function canAccessAccountingDeveloperCenter(userRole: string | null | undefined): boolean {
  if (DEVELOPER_CENTER_ROLES.has(canonRole(userRole))) return true;
  if (import.meta.env?.VITE_ACCOUNTING_DIAGNOSTICS === '1') return true;
  return false;
}
