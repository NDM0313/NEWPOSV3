/**
 * Phase 3B-H — approved Cash Flow finance rules for preview alignment only.
 * Legacy getCashFlowReport path is unchanged.
 */

export const CASH_FLOW_APPROVED_FINANCE_RULES = {
  phase: '3B-M',
  Q4: 'A' as const,
  Q5: 'C' as const,
  Q7: 'B' as const,
  reviewer: 'Nadeem Khan',
  reviewDate: '2026-06-29',
  loaderSwapApproved: true,
  officialCashFlowBehaviorChanged: true,
  previewAlignmentOnly: false,
};

export type CashFlowFinanceAlignmentClass =
  | 'included_normal'
  | 'internal_transfer_excluded_normal'
  | 'opening_summary_only'
  | 'audit_detail_only';

export function isOpeningBalanceAccountRow(
  referenceType?: string | null,
  sourceModule?: string | null
): boolean {
  const rt = String(referenceType || '').toLowerCase();
  const sm = String(sourceModule || '').toLowerCase();
  return rt.includes('opening_balance') || (sm.includes('opening') && rt.includes('opening'));
}

export function isInternalTransferRow(
  referenceType?: string | null,
  sourceModule?: string | null
): boolean {
  const rt = String(referenceType || '').toLowerCase();
  const sm = String(sourceModule || '').toLowerCase();
  return rt === 'transfer' || sm === 'transfers' || sm.includes('transfer');
}

/** Classify how a preview row participates in normal-period totals (Q4=A, Q5=C). */
export function classifyPreviewFinanceAlignment(args: {
  referenceType?: string | null;
  sourceModule?: string | null;
}): CashFlowFinanceAlignmentClass {
  if (isInternalTransferRow(args.referenceType, args.sourceModule)) {
    return 'internal_transfer_excluded_normal';
  }
  if (isOpeningBalanceAccountRow(args.referenceType, args.sourceModule)) {
    return 'opening_summary_only';
  }
  return 'included_normal';
}

/** Rows excluded from normal-period Cash In / Cash Out per approved finance rules. */
export function excludeFromNormalPreviewPeriodTotals(
  alignment: CashFlowFinanceAlignmentClass
): boolean {
  return (
    alignment === 'internal_transfer_excluded_normal' || alignment === 'opening_summary_only'
  );
}

export function financeAlignmentExportLabel(alignment: CashFlowFinanceAlignmentClass): string | null {
  if (alignment === 'internal_transfer_excluded_normal') return 'internal_transfer_excluded_normal';
  if (alignment === 'opening_summary_only') return 'opening_summary_only';
  if (alignment === 'audit_detail_only') return 'audit_detail_only';
  return null;
}

export const CASH_FLOW_FINANCE_ALIGNMENT_NOTES = [
  'Phase 3B-M — unified main loader uses Q4=A opening summary-only; Q5=C transfers excluded from normal totals.',
  'Q7=B — finance-aligned basis active when unified_ledger_loader_cash_flow is ON.',
  'Legacy getCashFlowReport remains available when loader flag OFF or kill switch ON.',
] as const;
