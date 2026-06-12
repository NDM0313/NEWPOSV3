/**
 * Repair Queue dry-run helpers (Phase D) — preview only, no apply paths.
 */

export type RepairPlanStatus =
  | 'detected'
  | 'preview_ready'
  | 'confirmed'
  | 'applied'
  | 'failed'
  | 'rolled_back';

export interface RepairDryRunPreview {
  repairType: string;
  title: string;
  status: RepairPlanStatus;
  beforeSummary: string;
  afterSummary: string;
  impactSummary: string;
  safeToApply: boolean;
  requiresSuperAdmin: boolean;
}

export interface NumberingDryRunRow {
  documentType: string;
  label: string;
  sequenceLast: number;
  databaseMax: number;
  effectiveMax: number;
  status: 'ok' | 'out_of_sync';
  previewAction: string;
}

export function buildNumberingDryRunPreviews(
  rows: Array<{
    document_type: string;
    label: string;
    sequence_last: number;
    database_max: number;
    effective_max: number;
    status: 'ok' | 'out_of_sync';
  }>
): NumberingDryRunRow[] {
  return rows.map((r) => ({
    documentType: r.document_type,
    label: r.label,
    sequenceLast: r.sequence_last,
    databaseMax: r.database_max,
    effectiveMax: r.effective_max,
    status: r.status,
    previewAction:
      r.status === 'out_of_sync'
        ? `Would sync erp_document_sequences.last_number → ${r.effective_max} (never decreases)`
        : 'No sequence sync needed',
  }));
}

export function integrityIssueToDryRunPreview(issue: {
  rule_code: string;
  rule_message: string | null;
  suggested_action: string | null;
  impact_summary: string | null;
  status: string;
}): RepairDryRunPreview {
  return {
    repairType: issue.rule_code,
    title: issue.rule_message || issue.rule_code,
    status: 'preview_ready',
    beforeSummary: issue.impact_summary || 'See Integrity Lab issue row',
    afterSummary: issue.suggested_action || 'Review in Developer Integrity Lab before apply',
    impactSummary: issue.impact_summary || '—',
    safeToApply: false,
    requiresSuperAdmin: true,
  };
}

/** Phase E confirm phrase gate — must match exactly. */
export const SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE = 'SYNC-SEQUENCE-TO-EFFECTIVE-MAX';

export function isValidRepairConfirmPhrase(phrase: string, expected: string): boolean {
  return phrase.trim() === expected;
}

export function expensePaymentCandidateToDryRunPreview(row: {
  expenseNo: string;
  expenseAmount: number;
  paymentRef: string | null;
  paymentAmount: number | null;
  jeLiquidityAmount: number;
  canApplyRepair: boolean;
  blockReason?: string;
  proposedAfterAmount: number;
}): RepairDryRunPreview {
  const before = `Expense ${row.expenseNo}: Rs ${row.expenseAmount.toLocaleString()} · Payment ${row.paymentRef || '—'}: Rs ${(row.paymentAmount ?? 0).toLocaleString()} · JE liquidity: Rs ${row.jeLiquidityAmount.toLocaleString()}`;
  const after = row.canApplyRepair
    ? `Payment metadata → Rs ${row.proposedAfterAmount.toLocaleString()} (GL lines unchanged)`
    : row.blockReason || 'Repair blocked';
  return {
    repairType: 'expense.sync_linked_payment_amount',
    title: `Expense payment mismatch — ${row.expenseNo}`,
    status: 'preview_ready',
    beforeSummary: before,
    afterSummary: after,
    impactSummary: row.canApplyRepair
      ? 'Updates payments.amount only when JE already matches expense'
      : row.blockReason || 'Review GL before repair',
    safeToApply: row.canApplyRepair,
    requiresSuperAdmin: true,
  };
}
