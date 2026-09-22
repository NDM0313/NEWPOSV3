/**
 * AR/AP Reconciliation Center — page access (Phase 2 safe UI + hybrid repair).
 */

import { canApplyDeveloperRepair, canonRole } from './developerAccountingAccess';

export type ArApReconciliationAccessLevel = 'none' | 'read_only' | 'dry_run' | 'admin_view';

const READ_ONLY_ROLES = new Set(['accounting auditor', 'accounting_auditor']);
const DRY_RUN_ROLES = new Set(['developer']);
const ADMIN_VIEW_ROLES = new Set(['admin', 'owner', 'super admin', 'superadmin', 'super_admin']);

export type ArApReconciliationAccess = {
  level: ArApReconciliationAccessLevel;
  canAccess: boolean;
  readOnly: boolean;
  canUseDryRunUI: boolean;
  /** @deprecated Use canApplyRelinkMapping — kept for callers expecting legacy flag */
  canApplyRepair: boolean;
  /** Phase 2A: metadata-only contact mapping apply (no GL) */
  canApplyRelinkMapping: boolean;
  /** Additive GL correction apply — requires admin role + deployed RPC (see mergeHybridRepairProbe) */
  canApplyGlRepair: boolean;
  /** Hybrid repair panel (manual + auto-fix toggle) */
  canUseHybridRepair: boolean;
  canDeveloperBypassExecuteGate: boolean;
};

export function resolveArApReconciliationAccess(userRole: string | null | undefined): ArApReconciliationAccess {
  const role = canonRole(userRole);
  if (!role || role === 'staff' || role === 'salesman' || role === 'manager') {
    return {
      level: 'none',
      canAccess: false,
      readOnly: false,
      canUseDryRunUI: false,
      canApplyRepair: false,
      canApplyRelinkMapping: false,
      canApplyGlRepair: false,
      canUseHybridRepair: false,
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
      canApplyRelinkMapping: false,
      canApplyGlRepair: false,
      canUseHybridRepair: false,
      canDeveloperBypassExecuteGate: false,
    };
  }
  const isDev = DRY_RUN_ROLES.has(role);
  const isAdmin = ADMIN_VIEW_ROLES.has(role);
  if (isDev || isAdmin) {
    const canRelink = isDev || isAdmin;
    const canHybrid = canApplyDeveloperRepair(userRole);
    return {
      level: isDev ? 'dry_run' : 'admin_view',
      canAccess: true,
      readOnly: false,
      canUseDryRunUI: true,
      canApplyRepair: canRelink,
      canApplyRelinkMapping: canRelink,
      canApplyGlRepair: false,
      canUseHybridRepair: canHybrid,
      canDeveloperBypassExecuteGate: isDev || role === 'super admin' || role === 'superadmin' || role === 'super_admin',
    };
  }
  return {
    level: 'none',
    canAccess: false,
    readOnly: false,
    canUseDryRunUI: false,
    canApplyRepair: false,
    canApplyRelinkMapping: false,
    canApplyGlRepair: false,
    canUseHybridRepair: false,
    canDeveloperBypassExecuteGate: false,
  };
}

/** Merge async RPC probe — enables GL correction apply when migration is deployed. */
export function mergeHybridRepairProbe(
  access: ArApReconciliationAccess,
  probe: { glCorrectionRpcAvailable?: boolean }
): ArApReconciliationAccess {
  if (!access.canUseHybridRepair) return access;
  return {
    ...access,
    canApplyGlRepair: access.canApplyRepair && probe.glCorrectionRpcAvailable === true,
  };
}
