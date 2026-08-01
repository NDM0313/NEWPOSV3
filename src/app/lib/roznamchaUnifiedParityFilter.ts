/**
 * Phase 2.15 — roznamcha parity filter for unified cash/bank GL rows.
 * Legacy roznamcha is payment + journal-only (no payment_id) with JE-level dedupe;
 * raw get_unified_cash_bank_ledger includes payment-posted document GL legs.
 */

import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

/** Document JEs with liquidity legs — cash movement already in payments / rental_payments. */
export const ROZNAMCHA_DOCUMENT_REFERENCE_TYPES = new Set([
  'rental',
  'sale',
  'purchase',
  'expense',
  'worker_payment',
  'courier_payment',
  'studio_order',
]);

export type UnifiedRowJeMeta = {
  paymentId?: string | null;
  actionFingerprint?: string | null;
};

export type UnifiedLedgerRowWithJeMeta = UnifiedLedgerRow & UnifiedRowJeMeta;

export function isRoznamchaDocumentReferenceType(referenceType: string | null | undefined): boolean {
  return ROZNAMCHA_DOCUMENT_REFERENCE_TYPES.has(String(referenceType || '').toLowerCase());
}

/** True when this GL row should be excluded from roznamcha parity (payment path owns it). */
export function unifiedRowExcludedFromRoznamchaParity(
  row: UnifiedLedgerRowWithJeMeta,
): boolean {
  if (row.paymentId) return true;
  const rt = String(row.referenceType || '').toLowerCase();
  const fp = String(row.actionFingerprint || '').trim();
  if (rt === 'rental' && fp.startsWith('rental_party_payment:')) return false;
  return isRoznamchaDocumentReferenceType(rt);
}

/** Keep journal-only liquidity legs that roznamcha would surface after payment exclusion. */
export function filterUnifiedRowsForRoznamchaJournalPath(
  rows: UnifiedLedgerRowWithJeMeta[],
): UnifiedLedgerRowWithJeMeta[] {
  return rows.filter((row) => !unifiedRowExcludedFromRoznamchaParity(row));
}

export function sumUnifiedCashBankTotals(rows: Array<{ debit?: number; credit?: number }>): {
  cashIn: number;
  cashOut: number;
} {
  let cashIn = 0;
  let cashOut = 0;
  for (const row of rows) {
    cashIn += Number(row.debit) || 0;
    cashOut += Number(row.credit) || 0;
  }
  return { cashIn, cashOut };
}
