/** Pure Roznamcha expense direction rules — keep in sync with src/app/services/roznamchaExpenseRules.ts */

export function roznamchaPaymentTypeDirection(paymentType: string): 'IN' | 'OUT' {
  const t = (paymentType || '').toLowerCase();
  return t === 'received' ? 'IN' : 'OUT';
}

export function roznamchaPaymentDirection(referenceType: string, paymentType: string): 'IN' | 'OUT' {
  const rt = String(referenceType || '').toLowerCase();
  if (rt === 'expense') return 'OUT';
  return roznamchaPaymentTypeDirection(paymentType);
}

export function roznamchaLiquidityLineDirection(
  referenceType: string | null | undefined,
  debit: number,
  credit: number,
): 'IN' | 'OUT' {
  const rt = String(referenceType || '').toLowerCase();
  if (rt === 'expense') {
    if (credit > 0) return 'OUT';
    if (debit > 0) return 'IN';
    return 'OUT';
  }
  return debit > 0 ? 'IN' : 'OUT';
}
