/**
 * Sale return settlement: apply to invoice due (AR) first, then cash/bank refund.
 * Example: due 3000, return 5000 → arPortion 3000, refundPortion 2000.
 */

export function computeSaleReturnSettlementSplit(params: {
  returnTotal: number;
  dueBefore: number;
}): { arPortion: number; refundPortion: number; returnTotal: number } {
  const returnTotal = Math.max(0, Math.round((Number(params.returnTotal) || 0) * 100) / 100);
  const dueBefore = Math.max(0, Math.round((Number(params.dueBefore) || 0) * 100) / 100);
  const arPortion = Math.min(returnTotal, dueBefore);
  const refundPortion = Math.round((returnTotal - arPortion) * 100) / 100;
  return { arPortion, refundPortion, returnTotal };
}
