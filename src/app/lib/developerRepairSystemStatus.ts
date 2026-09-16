/**
 * Pure logic for Developer Center repair system readiness (production probes).
 */

export type RepairSystemOverallState =
  | 'ready_for_apply'
  | 'ready_for_dry_run'
  | 'blocked_missing_migration'
  | 'blocked_view_only';

export interface DeveloperRepairSystemProbe {
  companyIdPresent: boolean;
  auditTableAvailable: boolean;
  auditTableError?: string;
  relinkRpcAvailable: boolean;
  relinkRpcError?: string;
  glCorrectionRpcAvailable: boolean;
  glCorrectionRpcError?: string;
  canApply: boolean;
  userRoleLabel: string;
}

export interface RepairSystemChecklistRow {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface DeveloperRepairSystemStatus {
  probe: DeveloperRepairSystemProbe;
  overallState: RepairSystemOverallState;
  overallLabel: string;
  checklist: RepairSystemChecklistRow[];
}

const OVERALL_LABELS: Record<RepairSystemOverallState, string> = {
  ready_for_apply: 'Ready for apply',
  ready_for_dry_run: 'Ready for dry-run',
  blocked_missing_migration: 'Blocked: missing migration',
  blocked_view_only: 'Blocked: role is view/dry-run only',
};

export function deriveRepairSystemOverallState(
  probe: DeveloperRepairSystemProbe
): RepairSystemOverallState {
  if (!probe.auditTableAvailable || !probe.relinkRpcAvailable) {
    return 'blocked_missing_migration';
  }
  if (!probe.canApply) {
    return 'blocked_view_only';
  }
  if (probe.canApply && probe.companyIdPresent) {
    return 'ready_for_apply';
  }
  if (probe.companyIdPresent) {
    return 'ready_for_dry_run';
  }
  return 'ready_for_dry_run';
}

export function buildRepairSystemChecklist(probe: DeveloperRepairSystemProbe): RepairSystemChecklistRow[] {
  return [
    {
      id: 'audit_table',
      label: 'developer_repair_audit table',
      ok: probe.auditTableAvailable,
      detail: probe.auditTableAvailable
        ? 'Table reachable (read-only probe)'
        : probe.auditTableError || 'Missing — apply migration 20260606120000_developer_repair_audit.sql',
    },
    {
      id: 'relink_rpc',
      label: 'developer_repair_relink_payment_je RPC',
      ok: probe.relinkRpcAvailable,
      detail: probe.relinkRpcAvailable
        ? 'RPC callable (read-only probe)'
        : probe.relinkRpcError || 'Missing — apply migration 20260606130000_developer_repair_relink_payment_je.sql',
    },
    {
      id: 'gl_correction_rpc',
      label: 'create_gl_correction_journal RPC',
      ok: probe.glCorrectionRpcAvailable,
      detail: probe.glCorrectionRpcAvailable
        ? 'Targeted GL correction apply available (whitelist only)'
        : probe.glCorrectionRpcError ||
          'Missing — apply migration 20260617120000_create_gl_correction_journal.sql',
    },
    {
      id: 'company_scope',
      label: 'Company scope',
      ok: probe.companyIdPresent,
      detail: probe.companyIdPresent ? 'Active company detected' : 'No company selected — repairs scoped to company',
    },
    {
      id: 'apply_role',
      label: 'Apply role',
      ok: probe.canApply,
      detail: probe.canApply
        ? `Role "${probe.userRoleLabel}" can apply repairs`
        : `Role "${probe.userRoleLabel}" is dry-run / view only`,
    },
  ];
}

export function buildDeveloperRepairSystemStatus(probe: DeveloperRepairSystemProbe): DeveloperRepairSystemStatus {
  const overallState = deriveRepairSystemOverallState(probe);
  return {
    probe,
    overallState,
    overallLabel: OVERALL_LABELS[overallState],
    checklist: buildRepairSystemChecklist(probe),
  };
}

/** PostgREST / Postgres errors indicating missing schema objects. */
export function isMissingSchemaObjectError(message: string | undefined, code?: string): boolean {
  const m = (message || '').toLowerCase();
  if (code === 'PGRST205' || code === 'PGRST202' || code === '42883' || code === '42P01') return true;
  if (m.includes('could not find the function')) return true;
  if (m.includes('relation') && m.includes('does not exist')) return true;
  if (m.includes('schema cache')) return true;
  return false;
}

/** Business-logic RPC errors mean the function exists. */
export function isRelinkRpcBusinessError(message: string | undefined): boolean {
  const m = (message || '').toLowerCase();
  return (
    m.includes('payment not found') ||
    m.includes('journal entry not found') ||
    m.includes('company mismatch') ||
    m.includes('voided') ||
    m.includes('amount mismatch')
  );
}

/** Business-logic errors mean create_gl_correction_journal exists. */
export function isGlCorrectionRpcBusinessError(message: string | undefined): boolean {
  const m = (message || '').toLowerCase();
  return (
    m.includes('confirm phrase') ||
    m.includes('unknown or unsupported repair target') ||
    m.includes('dry-run hash mismatch') ||
    m.includes('company_id required') ||
    m.includes('hq-sl-0003') ||
    m.includes('rental-1100-leakage') ||
    m.includes('rental 1100') ||
    m.includes('rental leakage') ||
    m.includes('parametric gl') ||
    m.includes('already applied') ||
    m.includes('je-0160') ||
    m.includes('je-0161')
  );
}

export const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
