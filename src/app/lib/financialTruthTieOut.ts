/**
 * Financial Truth Tie-out — pure math and difference row builders (read-only).
 */

import {
  classifyTieOutDifference,
  type DifferenceReasonCategory,
  differenceReasonLabel,
} from '@/app/lib/financialTruthBasis';

export type TieOutDrilldownTarget =
  | 'trial_balance'
  | 'balance_sheet'
  | 'profit_loss'
  | 'ar_ap_center'
  | 'account_statements'
  | 'cash_flow'
  | 'party_trace';

export interface TieOutDifferenceRow {
  id: string;
  label: string;
  leftLabel: string;
  rightLabel: string;
  leftAmount: number;
  rightAmount: number;
  difference: number;
  reasonCategory: DifferenceReasonCategory;
  reasonLabel: string;
  recommendedAction: string;
  drilldown: TieOutDrilldownTarget;
}

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function tieOutDifference(left: number, right: number): number {
  return roundMoney(left - right);
}

export function trialBalanceBalanced(totalDebit: number, totalCredit: number): boolean {
  return Math.abs(roundMoney(totalDebit - totalCredit)) < 0.01;
}

export function balanceSheetTiesToTrialBalance(bsDifference: number, tbImbalance: number): boolean {
  return Math.abs(roundMoney(bsDifference - tbImbalance)) < 0.01;
}

const RECOMMENDED_ACTIONS: Record<DifferenceReasonCategory, string> = {
  valid_timing_classification: 'Document in tie-out notes — no repair if within expected scope.',
  cancelled_audit_hidden_from_effective: 'Use Audit mode for full history; effective balance is intentional.',
  missing_contact_mapping: 'Fix Link on unmapped row — metadata only, GL unchanged.',
  missing_branch: 'Re-run with same branch scope on both surfaces.',
  payment_source_mismatch: 'Review payment vs JE reference_type in AR/AP center.',
  gl_correction_needed: 'Run GL correction dry-run when RPC approved — no broad repost.',
  source_document_required: 'Open source document; finalize/post from source module.',
  unknown: 'Open Financial Truth Center party trace or AR/AP review queue.',
};

export function buildTieOutDifferenceRow(args: {
  id: string;
  label: string;
  leftLabel: string;
  rightLabel: string;
  leftAmount: number;
  rightAmount: number;
  drilldown: TieOutDrilldownTarget;
  auditOnlyAdjustment?: number;
  hasUnmappedRows?: boolean;
  hasUnpostedDocs?: boolean;
  hasMetadataMismatch?: boolean;
  overrideReason?: DifferenceReasonCategory;
  overrideAction?: string;
}): TieOutDifferenceRow {
  const diff = tieOutDifference(args.leftAmount, args.rightAmount);
  const reasonCategory =
    args.overrideReason ??
    classifyTieOutDifference({
      amount: diff,
      leftLabel: args.leftLabel,
      rightLabel: args.rightLabel,
      auditOnlyAdjustment: args.auditOnlyAdjustment,
      hasUnmappedRows: args.hasUnmappedRows,
      hasUnpostedDocs: args.hasUnpostedDocs,
      hasMetadataMismatch: args.hasMetadataMismatch,
    });
  return {
    id: args.id,
    label: args.label,
    leftLabel: args.leftLabel,
    rightLabel: args.rightLabel,
    leftAmount: roundMoney(args.leftAmount),
    rightAmount: roundMoney(args.rightAmount),
    difference: diff,
    reasonCategory,
    reasonLabel: differenceReasonLabel(reasonCategory),
    recommendedAction: args.overrideAction ?? RECOMMENDED_ACTIONS[reasonCategory],
    drilldown: args.drilldown,
  };
}

export function buildStandardTieOutDifferences(input: {
  tbDifference: number;
  bsDifference: number;
  arControlGl: number | null;
  arSubledgerRaw: number | null;
  arSubledgerEffective: number | null;
  operationalReceivables: number;
  effectiveVarianceReceivables: number | null;
  auditOnlyArNet: number;
  apControlGl: number | null;
  apSubledgerRaw: number | null;
  operationalPayables: number;
  effectiveVariancePayables: number | null;
  auditOnlyApNet: number;
  cashGlNet: number | null;
  cashOperationalClosing: number | null;
  hasUnmappedRows?: boolean;
  hasUnpostedDocs?: boolean;
}): TieOutDifferenceRow[] {
  const rows: TieOutDifferenceRow[] = [];

  if (Math.abs(input.tbDifference) >= 0.01) {
    rows.push(
      buildTieOutDifferenceRow({
        id: 'tb-imbalance',
        label: 'Trial Balance Dr ≠ Cr',
        leftLabel: 'TB total debit',
        rightLabel: 'TB total credit',
        leftAmount: 0,
        rightAmount: input.tbDifference,
        drilldown: 'trial_balance',
        overrideReason: 'unknown',
        overrideAction: 'Use Accounting Integrity Lab to find unbalanced journal entries.',
      })
    );
  }

  if (input.arControlGl != null && input.arSubledgerRaw != null) {
    rows.push(
      buildTieOutDifferenceRow({
        id: 'ar-control-vs-subledger',
        label: 'AR control (1100) vs sum(AR-CUS*)',
        leftLabel: 'Official GL — control 1100',
        rightLabel: 'Official GL — party subledgers',
        leftAmount: input.arControlGl,
        rightAmount: input.arSubledgerRaw,
        drilldown: 'trial_balance',
      })
    );
  }

  if (input.arSubledgerRaw != null && input.arSubledgerEffective != null) {
    rows.push(
      buildTieOutDifferenceRow({
        id: 'ar-raw-vs-effective',
        label: 'AR subledger raw vs effective',
        leftLabel: 'Official Posted GL — AR-CUS sum',
        rightLabel: 'Effective operational — AR-CUS sum',
        leftAmount: input.arSubledgerRaw,
        rightAmount: input.arSubledgerEffective,
        drilldown: 'account_statements',
        auditOnlyAdjustment: input.auditOnlyArNet,
      })
    );
  }

  if (input.effectiveVarianceReceivables != null) {
    rows.push(
      buildTieOutDifferenceRow({
        id: 'ar-operational-vs-effective-gl',
        label: 'Operational receivables vs effective GL AR',
        leftLabel: 'Contacts RPC (operational)',
        rightLabel: 'Effective GL AR',
        leftAmount: input.operationalReceivables,
        rightAmount: (input.arControlGl ?? 0) - input.auditOnlyArNet,
        drilldown: 'ar_ap_center',
        auditOnlyAdjustment: input.auditOnlyArNet,
        hasUnmappedRows: input.hasUnmappedRows,
        hasUnpostedDocs: input.hasUnpostedDocs,
      })
    );
  }

  if (input.cashGlNet != null && input.cashOperationalClosing != null) {
    rows.push(
      buildTieOutDifferenceRow({
        id: 'cash-gl-vs-operational',
        label: 'Cash/Bank GL vs operational cash flow closing',
        leftLabel: 'Official Posted GL — cash/bank net',
        rightLabel: 'Operational cash flow closing',
        leftAmount: input.cashGlNet,
        rightAmount: input.cashOperationalClosing,
        drilldown: 'cash_flow',
        overrideReason:
          Math.abs(tieOutDifference(input.cashGlNet, input.cashOperationalClosing)) < 0.01
            ? 'valid_timing_classification'
            : undefined,
      })
    );
  }

  return rows.filter((r) => Math.abs(r.difference) >= 0.01 || r.id === 'tb-imbalance');
}

/** Regression fixture: AR-CUS0000 effective 0, official residue explained. */
export function explainArCus0000TieOut(args: {
  rawGlBalance: number;
  effectiveBalance: number;
  auditOnlyNet: number;
}): TieOutDifferenceRow {
  return buildTieOutDifferenceRow({
    id: 'ar-cus0000',
    label: 'Walk-in Customer AR-CUS0000',
    leftLabel: 'Official Posted GL',
    rightLabel: 'Effective operational',
    leftAmount: args.rawGlBalance,
    rightAmount: args.effectiveBalance,
    drilldown: 'account_statements',
    auditOnlyAdjustment: args.auditOnlyNet,
    overrideAction:
      'Effective Rs 0 expected when only cancelled/test chains remain; raw Rs 1 from JE-0168 audit residue — view Audit mode.',
  });
}
