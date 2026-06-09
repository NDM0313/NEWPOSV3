/**
 * Read-only report inclusion heuristics for Transaction Trace (Phase B).
 * Mirrors roznamchaService / ledger rules — advisory, not a full report rebuild.
 */

export const ROZNAMCHA_DOCUMENT_JE_TYPES = new Set([
  'rental',
  'sale',
  'purchase',
  'expense',
  'worker_payment',
  'courier_payment',
  'studio_order',
]);

export interface ReportVisibility {
  roznamcha: { included: boolean; reason: string };
  accountStatement: { included: boolean; reason: string };
  dayBook: { included: boolean; reason: string };
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

export function evaluateReportVisibility(input: TraceVisibilityInput): ReportVisibility {
  const rt = String(input.journalReferenceType || '').toLowerCase();
  const fp = String(input.actionFingerprint || '').trim();
  const isVoid = input.journalIsVoid === true || input.paymentVoided === true;

  let rozIncluded = false;
  let rozReason = 'No liquidity movement identified.';

  if (isVoid) {
    rozReason = 'Voided — excluded from Roznamcha unless include-voided filter is on.';
  } else if (input.hasPaymentRow || input.hasRentalPaymentRow) {
    rozIncluded = true;
    rozReason = input.hasPaymentRow
      ? 'Included via payments stream (primary Roznamcha source).'
      : 'Included via rental_payments stream.';
  } else if (input.hasLiquidityLine && rt === 'journal') {
    rozIncluded = true;
    rozReason = 'Journal-only liquidity line (no payment_id) — Roznamcha stream C.';
  } else if (input.hasLiquidityLine && rt === 'transfer') {
    rozIncluded = true;
    rozReason = 'Internal transfer liquidity legs appear in Roznamcha.';
  } else if (rt === 'rental' && fp.startsWith('rental_party_payment:')) {
    rozIncluded = true;
    rozReason = 'Rental party payment JE exception (not skipped as document JE).';
  } else if (ROZNAMCHA_DOCUMENT_JE_TYPES.has(rt)) {
    rozReason = `Document JE (${rt}) — cash leg expected in payments/rental_payments; excluded if duplicate stream exists.`;
  } else if (input.linkedInPaymentsStream) {
    rozReason = 'JE linked to payment already represented in payments stream (dedupe skip).';
  } else if (!input.hasLiquidityLine) {
    rozReason = 'No cash/bank/wallet line — non-liquidity posting.';
  }

  let stmtIncluded = false;
  let stmtReason = 'Not a party AR/AP statement row.';

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

  if (isVoid) {
    stmtReason = 'Voided/reversed — excluded from active statement.';
  } else if (partyPayment && input.paymentContactId) {
    stmtIncluded = true;
    stmtReason = 'Customer/supplier payment with contact_id — statement credit/debit.';
  } else if (arJe && input.paymentContactId) {
    stmtIncluded = true;
    stmtReason = 'AR/AP journal line with party context.';
  } else if (rt === 'sale' && input.saleStatus === 'final') {
    stmtIncluded = true;
    stmtReason = 'Final sale invoice — AR debit on party statement.';
  } else if (partyPayment && !input.paymentContactId) {
    stmtReason =
      input.paymentReferenceType === 'on_account' && input.paymentReferenceId
        ? 'On-account payment may match party via reference_id fallback when contact_id was not set at insert.'
        : 'Payment missing contact_id — may not appear on party statement.';
  } else if (rt === 'sale' && input.saleStatus && input.saleStatus !== 'final') {
    stmtReason = 'Non-final sale — invoice debit excluded from statement.';
  }

  const dayBookIncluded = !isVoid || Boolean(input.journalReferenceType);
  const dayBookReason = isVoid
    ? 'Voided JE lines may appear in list but are excluded from period balance totals.'
    : 'Active journal lines appear in Day Book (one row per line).';

  const impacted: string[] = [];
  if (rt === 'sale' || input.paymentReferenceType === 'sale') impacted.push('Sales / receivables (operational)');
  if (rt === 'purchase' || input.paymentReferenceType === 'purchase') impacted.push('Purchases / payables');
  if (input.hasPaymentRow && input.hasLiquidityLine) impacted.push('Cash/bank GL balance (company-wide KPI)');
  if (rt.includes('expense') || input.paymentReferenceType === 'expense') impacted.push('Operating expenses KPI');

  return {
    roznamcha: { included: rozIncluded, reason: rozReason },
    accountStatement: { included: stmtIncluded, reason: stmtReason },
    dayBook: { included: dayBookIncluded, reason: dayBookReason },
    dashboard: {
      impacted,
      note: impacted.length
        ? 'Dashboard mixes operational and GL metrics — see DASHBOARD_BASIS_MAP.md.'
        : 'No primary dashboard KPI identified for this trace.',
    },
  };
}
