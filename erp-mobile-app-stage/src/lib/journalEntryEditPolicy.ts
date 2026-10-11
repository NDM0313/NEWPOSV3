/**
 * Mirrors web `src/app/lib/journalEntryEditPolicy.ts` — which journal rows may be edited
 * from Accounts (payment settlement vs source-driven documents).
 */

export const SOURCE_CONTROLLED_REFERENCE_TYPES = new Set([
  'sale',
  'purchase',
  'rental',
  'sale_return',
  'purchase_return',
  'sale_adjustment',
  'purchase_adjustment',
  'opening_balance_inventory',
  'opening_balance_contact_ar',
  'opening_balance_contact_ap',
  'opening_balance_contact_worker',
  'opening_balance_account',
  'stock_adjustment',
]);

const BLOCKED_WITHOUT_PAYMENT_LINK = SOURCE_CONTROLLED_REFERENCE_TYPES;

/** Same rules as web `allowsDayBookUnifiedEdit`. */
export function allowsDayBookUnifiedEdit(
  referenceType: string | null | undefined,
  paymentId: string | null | undefined,
  hasActiveCorrectionReversal?: boolean | null
): boolean {
  if (hasActiveCorrectionReversal === true) return false;
  if (paymentId && String(paymentId).trim()) return true;
  const rt = String(referenceType || '').toLowerCase().trim();
  if (rt === 'correction_reversal') return false;
  if (!rt) return true;
  if (BLOCKED_WITHOUT_PAYMENT_LINK.has(rt)) return false;
  return true;
}

/**
 * When edit is blocked, deep-link to Sales or Purchase (mobile App `onNavigateToDocumentEdit`).
 * Returns null if not applicable or if this row is a payment settlement.
 */
export function getMobileSalePurchaseOpenTarget(
  referenceType: string | null | undefined,
  referenceId: string | null | undefined,
  paymentId: string | null | undefined
): { kind: 'sale' | 'purchase'; id: string } | null {
  if (paymentId && String(paymentId).trim()) return null;
  const rt = String(referenceType || '').toLowerCase().trim();
  const rid = referenceId ? String(referenceId).trim() : '';
  if (!rid) return null;
  if (rt === 'sale' || rt === 'sale_adjustment') return { kind: 'sale', id: rid };
  if (rt === 'purchase' || rt === 'purchase_adjustment') return { kind: 'purchase', id: rid };
  return null;
}
