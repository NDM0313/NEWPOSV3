/**
 * Read-only report inclusion heuristics for Transaction Trace (Phase B / 2B).
 * Mirrors roznamchaService / ledger rules — advisory, not a full report rebuild.
 */

import {
  isCorrectionReversalReferenceType,
  isVoidedJournalEntry,
  isVoidedPayment,
} from '@/app/lib/reportVisibilityContract';

export const ROZNAMCHA_DOCUMENT_JE_TYPES = new Set([
  'rental',
  'sale',
  'purchase',
  'expense',
  'worker_payment',
  'courier_payment',
  'studio_order',
]);

export interface ReportModeVisibility {
  normal: { included: boolean; reason: string };
  audit: { included: boolean; reason: string };
}

export interface ReportVisibility {
  roznamcha: ReportModeVisibility;
  accountStatement: ReportModeVisibility;
  customerSupplierStatement: ReportModeVisibility;
  dayBook: ReportModeVisibility;
  dashboard: { impacted: string[]; note: string };
}

export interface TraceVisibilityInput {
  hasPaymentRow?: boolean;
  hasRentalPaymentRow?: boolean;
  journalReferenceType?: string | null;
  journalIsVoid?: boolean | null;
  paymentVoided?: boolean;
  paymentContactId?: string | null;
  paymentReferenceType?: string | null;
  paymentReferenceId?: string | null;
  hasLiquidityLine?: boolean;
  actionFingerprint?: string | null;
  linkedInPaymentsStream?: boolean;
  saleStatus?: string | null;
}

function modePair(
  normalIncluded: boolean,
  normalReason: string,
  auditIncluded: boolean,
  auditReason: string
): ReportModeVisibility {
  return {
    normal: { included: normalIncluded, reason: normalReason },
    audit: { included: auditIncluded, reason: auditReason },
  };
}

export function evaluateReportVisibility(input: TraceVisibilityInput): ReportVisibility {
  const rt = String(input.journalReferenceType || '').toLowerCase();
  const fp = String(input.actionFingerprint || '').trim();
  const isVoid = isVoidedJournalEntry(input.journalIsVoid) || isVoidedPayment(input.paymentVoided);
  const isCorrectionReversal = isCorrectionReversalReferenceType(rt);

  let rozNormal = false;
  let rozNormalReason = 'No liquidity movement identified.';
  let rozAudit = false;
  let rozAuditReason = rozNormalReason;

  if (isCorrectionReversal) {
    rozNormalReason = 'correction_reversal — excluded from normal cash book (audit trail only).';
    rozAuditReason = 'correction_reversal — included in audit Roznamcha with reversal label.';
    rozAudit = input.hasLiquidityLine || input.hasPaymentRow || input.hasRentalPaymentRow;
  } else if (isVoid) {
    rozNormalReason = 'Voided — excluded from normal Roznamcha.';
    rozAuditReason = 'Voided — included when Include voided/reversed is on.';
    rozAudit = input.hasLiquidityLine || input.hasPaymentRow || input.hasRentalPaymentRow;
  } else if (input.hasPaymentRow || input.hasRentalPaymentRow) {
    rozNormal = true;
    rozAudit = true;
    const base = input.hasPaymentRow
      ? 'Included via payments stream (primary Roznamcha source).'
      : 'Included via rental_payments stream.';
    rozNormalReason = base;
    rozAuditReason = base;
  } else if (input.hasLiquidityLine && rt === 'journal') {
    rozNormal = true;
    rozAudit = true;
    rozNormalReason = 'Journal-only liquidity line (no payment_id) — Roznamcha stream C.';
    rozAuditReason = rozNormalReason;
  } else if (input.hasLiquidityLine && rt === 'transfer') {
    rozNormal = true;
    rozAudit = true;
    rozNormalReason = 'Internal transfer liquidity legs appear in Roznamcha.';
    rozAuditReason = rozNormalReason;
  } else if (rt === 'rental' && fp.startsWith('rental_party_payment:')) {
    rozNormal = true;
    rozAudit = true;
    rozNormalReason = 'Rental party payment JE exception (not skipped as document JE).';
    rozAuditReason = rozNormalReason;
  } else if (ROZNAMCHA_DOCUMENT_JE_TYPES.has(rt)) {
    rozNormalReason = `Document JE (${rt}) — cash leg expected in payments/rental_payments; excluded if duplicate stream exists.`;
    rozAuditReason = rozNormalReason;
  } else if (input.linkedInPaymentsStream) {
    rozNormalReason = 'JE linked to payment already represented in payments stream (dedupe skip).';
    rozAuditReason = rozNormalReason;
  } else if (!input.hasLiquidityLine) {
    rozNormalReason = 'No cash/bank/wallet line — non-liquidity posting.';
    rozAuditReason = rozNormalReason;
  }

  let stmtNormal = false;
  let stmtNormalReason = 'Not a cash/bank account statement row.';
  let stmtAudit = false;
  let stmtAuditReason = stmtNormalReason;

  const partyPayment =
    input.paymentReferenceType &&
    ['sale', 'on_account', 'manual_receipt', 'rental'].includes(
      String(input.paymentReferenceType).toLowerCase()
    );
  const arJe =
    rt === 'sale' ||
    rt === 'rental' ||
    rt === 'opening_balance_contact_ar' ||
    rt === 'payment' ||
    rt === 'manual_receipt';

  if (isCorrectionReversal) {
    stmtNormalReason = 'correction_reversal — excluded from normal account statement unless Include reversals is on.';
    stmtAuditReason = 'correction_reversal — visible in audit with Reversal label; does not affect normal closing balance.';
    stmtAudit = input.hasLiquidityLine;
  } else if (isVoid) {
    stmtNormalReason = 'Voided/reversed — excluded from normal statement.';
    stmtAuditReason = 'Voided/reversed — visible in audit mode.';
    stmtAudit = partyPayment || arJe || input.hasLiquidityLine;
  } else if (input.hasLiquidityLine) {
    stmtNormal = true;
    stmtAudit = true;
    stmtNormalReason = 'Active GL liquidity line on selected cash/bank account.';
    stmtAuditReason = stmtNormalReason;
  }

  let partyNormal = false;
  let partyNormalReason = 'Not a party AR/AP statement row.';
  let partyAudit = false;
  let partyAuditReason = partyNormalReason;

  if (isCorrectionReversal || isVoid) {
    partyNormalReason = isCorrectionReversal
      ? 'correction_reversal — excluded from normal party statement.'
      : 'Voided — excluded from normal party statement.';
    partyAuditReason = 'Audit trail — may appear when Include reversals / voided is enabled.';
    partyAudit = partyPayment || arJe;
  } else if (partyPayment && input.paymentContactId) {
    partyNormal = true;
    partyAudit = true;
    partyNormalReason = 'Customer/supplier payment with contact_id — statement credit/debit.';
    partyAuditReason = partyNormalReason;
  } else if (arJe && input.paymentContactId) {
    partyNormal = true;
    partyAudit = true;
    partyNormalReason = 'AR/AP journal line with party context.';
    partyAuditReason = partyNormalReason;
  } else if (rt === 'sale' && input.saleStatus === 'final') {
    partyNormal = true;
    partyAudit = true;
    partyNormalReason = 'Final sale invoice — AR debit on party statement.';
    partyAuditReason = partyNormalReason;
  } else if (partyPayment && !input.paymentContactId) {
    partyNormalReason =
      input.paymentReferenceType === 'on_account' && input.paymentReferenceId
        ? 'On-account payment may match party via reference_id fallback when contact_id was not set at insert.'
        : 'Payment missing contact_id — may not appear on party statement.';
    partyAuditReason = partyNormalReason;
  } else if (rt === 'sale' && input.saleStatus && input.saleStatus !== 'final') {
    partyNormalReason = 'Non-final sale — invoice debit excluded from statement.';
    partyAuditReason = partyNormalReason;
  }

  const dayBookNormal = !isVoid && !isCorrectionReversal;
  const dayBookNormalReason = isCorrectionReversal
    ? 'correction_reversal excluded from normal Day Book.'
    : isVoid
      ? 'Voided JE excluded from normal Day Book.'
      : 'Active journal lines appear in Day Book (one row per line).';
  const dayBookAuditReason = isCorrectionReversal
    ? 'correction_reversal included in audit Day Book with Reversal badge.'
    : isVoid
      ? 'Voided JE lines listed in audit Day Book.'
      : 'Active journal lines appear in Day Book.';

  const impacted: string[] = [];
  if (rt === 'sale' || input.paymentReferenceType === 'sale') impacted.push('Sales / receivables (operational)');
  if (rt === 'purchase' || input.paymentReferenceType === 'purchase') impacted.push('Purchases / payables');
  if (input.hasPaymentRow && input.hasLiquidityLine) impacted.push('Cash/bank GL balance (company-wide KPI)');
  if (rt.includes('expense') || input.paymentReferenceType === 'expense') impacted.push('Operating expenses KPI');

  return {
    roznamcha: modePair(rozNormal, rozNormalReason, rozAudit, rozAuditReason),
    accountStatement: modePair(stmtNormal, stmtNormalReason, stmtAudit, stmtAuditReason),
    customerSupplierStatement: modePair(partyNormal, partyNormalReason, partyAudit, partyAuditReason),
    dayBook: modePair(dayBookNormal, dayBookNormalReason, true, dayBookAuditReason),
    dashboard: {
      impacted,
      note: impacted.length
        ? 'Dashboard mixes operational and GL metrics — see DASHBOARD_BASIS_MAP.md.'
        : 'No primary dashboard KPI identified for this trace.',
    },
  };
}
