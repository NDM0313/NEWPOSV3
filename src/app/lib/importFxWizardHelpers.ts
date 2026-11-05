/**
 * Path 21 wizard pure helpers (amount defaults, no I/O).
 */

export function roundMoney2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Step 3 default: fund this China settle from the FX credit PKR, capped by purchase due.
 * Use credit.amount_pkr (not due after agent settle).
 */
export function suggestedChinaSettleAmountPkr(params: {
  creditAmountPkr: number;
  purchaseDue: number;
}): number {
  const credit = roundMoney2(params.creditAmountPkr);
  const due = roundMoney2(params.purchaseDue);
  if (credit > 0 && due > 0) return roundMoney2(Math.min(credit, due));
  if (credit > 0) return credit;
  if (due > 0) return due;
  return 0;
}
