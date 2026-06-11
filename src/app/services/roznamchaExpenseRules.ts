/** Pure Roznamcha expense direction rules (no Supabase). */

export function roznamchaPaymentTypeDirection(paymentType: string): 'IN' | 'OUT' {
  const t = (paymentType || '').toLowerCase();
  return t === 'received' ? 'IN' : 'OUT';
}

/** Roznamcha direction for payments rows — expense is always money out. */
export function roznamchaPaymentDirection(referenceType: string, paymentType: string): 'IN' | 'OUT' {
  const rt = String(referenceType || '').toLowerCase();
  if (rt === 'expense') return 'OUT';
  return roznamchaPaymentTypeDirection(paymentType);
}

/** Roznamcha direction for journal liquidity legs — expense Cr cash/wallet = OUT. */
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
