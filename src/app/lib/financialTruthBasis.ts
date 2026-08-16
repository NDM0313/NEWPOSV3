/**
 * Financial Truth Alignment — single three-basis contract for all ERP reports.
 * Official Posted GL | Effective operational party | Audit full history
 */

import {
  shouldIncludePartyEffectiveRow,
  type PartyEffectiveRowInput,
} from '@/app/lib/reportVisibilityContract';

export type ReportBasis = 'official_gl' | 'effective_party' | 'audit_full';

export type DifferenceReasonCategory =
  | 'valid_timing_classification'
  | 'cancelled_audit_hidden_from_effective'
  | 'missing_contact_mapping'
  | 'missing_branch'
  | 'payment_source_mismatch'
  | 'gl_correction_needed'
  | 'source_document_required'
  | 'unknown';

export const DIFFERENCE_REASON_LABELS: Record<DifferenceReasonCategory, string> = {
  valid_timing_classification: 'Valid timing / classification difference',
  cancelled_audit_hidden_from_effective: 'Cancelled / audit-only hidden from effective view',
  missing_contact_mapping: 'Missing contact mapping',
  missing_branch: 'Missing or mismatched branch scope',
  payment_source_mismatch: 'Payment / source document mismatch',
  gl_correction_needed: 'GL correction needed',
  source_document_required: 'Source document required',
  unknown: 'Unknown — needs deeper trace',
};

export const REPORT_BASIS_LABELS: Record<ReportBasis, string> = {
  official_gl: 'Official Posted GL basis',
  effective_party: 'Effective operational basis — hides cancelled/voided/audit-only rows',
  audit_full: 'Audit basis — full history',
};

export const REPORT_BASIS_DESCRIPTIONS: Record<ReportBasis, string> = {
  official_gl:
    'Posted journal lines only (void excluded). Includes correction journals and gl_correction entries. Use for Trial Balance, Balance Sheet, P&L, and Chart of Accounts.',
  effective_party:
    'Operational party view for collections and customer/supplier closing balance. Hides cancelled sale trails, voided payments, and audit-only correction chains.',
  audit_full:
    'Complete posted history including cancellations, reversals, and corrections. Not for business closing balance.',
};

export function reportBasisLabel(basis: ReportBasis): string {
  return REPORT_BASIS_LABELS[basis];
}

export function reportBasisDescription(basis: ReportBasis): string {
  return REPORT_BASIS_DESCRIPTIONS[basis];
}

export function reportBasisBannerClass(basis: ReportBasis): string {
  switch (basis) {
    case 'official_gl':
      return 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-800 dark:text-emerald-100';
    case 'effective_party':
      return 'border-cyan-500/30 bg-cyan-500/[0.07] text-cyan-800 dark:text-cyan-100';
    case 'audit_full':
      return 'border-amber-500/30 bg-amber-500/[0.07] text-amber-800 dark:text-amber-100';
    default:
      return 'border-border bg-muted/40 text-foreground';
  }
}

/** Official financial reports: all non-void posted JEs (includes correction_reversal, gl_correction). */
export function officialGlIncludesJournalEntry(args: {
  isVoid?: boolean | null;
  referenceType?: string | null;
}): boolean {
  if (args.isVoid === true) return false;
  return true;
}

/** Effective party statement row visibility (delegates to reportVisibilityContract). */
export function effectivePartyIncludesRow(row: PartyEffectiveRowInput): boolean {
  return shouldIncludePartyEffectiveRow(row);
}

export function differenceReasonLabel(category: DifferenceReasonCategory): string {
  return DIFFERENCE_REASON_LABELS[category];
}

/** Classify a numeric gap between two surfaces (heuristic — read-only). */
export function classifyTieOutDifference(args: {
  amount: number;
  leftLabel: string;
  rightLabel: string;
  auditOnlyAdjustment?: number;
  hasUnmappedRows?: boolean;
  hasUnpostedDocs?: boolean;
  hasMetadataMismatch?: boolean;
}): DifferenceReasonCategory {
  const abs = Math.abs(args.amount);
  if (abs < 0.01) return 'valid_timing_classification';

  if (args.auditOnlyAdjustment != null && Math.abs(abs - Math.abs(args.auditOnlyAdjustment)) < 0.02) {
    return 'cancelled_audit_hidden_from_effective';
  }
  if (args.hasUnmappedRows) return 'missing_contact_mapping';
  if (args.hasUnpostedDocs) return 'source_document_required';
  if (args.hasMetadataMismatch) return 'payment_source_mismatch';
  if (args.leftLabel.includes('1100') && args.rightLabel.includes('effective')) {
    return 'cancelled_audit_hidden_from_effective';
  }
  return 'unknown';
}

/** Screens that must use official_gl basis (guard for future refactors). */
export const OFFICIAL_GL_SCREENS = [
  'trial_balance',
  'balance_sheet',
  'profit_and_loss',
  'chart_of_accounts',
  'cash_flow_gl_official',
] as const;

export const EFFECTIVE_PARTY_SCREENS = [
  'customer_ledger_effective',
  'supplier_ledger_effective',
  'account_statement_effective',
  'ar_ap_effective_variance',
] as const;

export const AUDIT_SCREENS = ['party_ledger_audit', 'day_book_audit', 'account_statement_audit'] as const;
