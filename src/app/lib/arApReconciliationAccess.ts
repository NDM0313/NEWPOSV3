/**
 * AR/AP Reconciliation Center — page access (Phase 2 safe UI).
 */

import { canonRole } from './developerAccountingAccess';

export type ArApReconciliationAccessLevel = 'none' | 'read_only' | 'dry_run' | 'admin_view';

const READ_ONLY_ROLES = new Set(['accounting auditor', 'accounting_auditor']);
const DRY_RUN_ROLES = new Set(['developer']);
const ADMIN_VIEW_ROLES = new Set(['admin', 'owner', 'super admin', 'superadmin', 'super_admin']);

export function resolveArApReconciliationAccess(userRole: string | null | undefined): {
  level: ArApReconciliationAccessLevel;
  canAccess: boolean;
  readOnly: boolean;
  canUseDryRunUI: boolean;
  /** Phase 2: always false — apply disabled until Phase 3 */
  canApplyRepair: boolean;
  canDeveloperBypassExecuteGate: boolean;
} {
  const role = canonRole(userRole);
  if (!role || role === 'staff' || role === 'salesman' || role === 'manager') {
    return {
      level: 'none',
      canAccess: false,
      readOnly: false,
      canUseDryRunUI: false,
      canApplyRepair: false,
      canDeveloperBypassExecuteGate: false,
    };
  }
  if (READ_ONLY_ROLES.has(role)) {
    return {
      level: 'read_only',
      canAccess: true,
      readOnly: true,
      canUseDryRunUI: false,
      canApplyRepair: false,
      canDeveloperBypassExecuteGate: false,
    };
  }
  const isDev = DRY_RUN_ROLES.has(role);
  const isAdmin = ADMIN_VIEW_ROLES.has(role);
  if (isDev || isAdmin) {
    return {
      level: isDev ? 'dry_run' : 'admin_view',
      canAccess: true,
      readOnly: false,
      canUseDryRunUI: true,
      canApplyRepair: false,
      canDeveloperBypassExecuteGate: isDev || role === 'super admin' || role === 'superadmin' || role === 'super_admin',
    };
  }
  return {
    level: 'none',
    canAccess: false,
    readOnly: false,
    canUseDryRunUI: false,
    canApplyRepair: false,
    canDeveloperBypassExecuteGate: false,
  };
}
