/**
 * Pure helpers for Path 21 FX credit void guards (unit-tested).
 */

export function formatActiveSettlementBlockMessage(
  referenceNumbers: string[]
): string {
  const refs = referenceNumbers.filter(Boolean);
  const list = refs.length ? refs.join(', ') : 'payment';
  return `Cannot void FX credit while agent settlement payment(s) are still active (${list}). Cancel/void those payments first, then void the FX credit.`;
}

export function filterActiveSettlementPaymentRefs(
  payments: Array<{ reference_number?: string | null; voided_at?: string | null }>
): string[] {
  return payments
    .filter((p) => !p.voided_at)
    .map((p) => p.reference_number || 'payment');
}
