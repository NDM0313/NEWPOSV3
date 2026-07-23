/** Snapshot inputs for sale document JE revenue split (4120 package split). */
export type SaleDocumentRevenueSnapshot = {
  total: number;
  discount?: number;
  extraExpense?: number;
  shippingCharges?: number;
};

/**
 * Canonical revenue split for sale document JEs — must match record_sale_with_accounting RPC.
 * AR = total + shipping; Cr 4000/4010 = merchandise pool; Cr 4120 = extra charges (not subtracted twice).
 */
export function computeSaleDocumentRevenueAmounts(snapshot: SaleDocumentRevenueSnapshot): {
  arDebit: number;
  grossTotal: number;
  revenueCredit: number;
  merchandisePool: number;
  extraAmount: number;
  shippingAmount: number;
} {
  const total = Math.round((Number(snapshot.total) || 0) * 100) / 100;
  const discountAmount = Math.round((Number(snapshot.discount) || 0) * 100) / 100;
  const extraAmount = Math.round((Number(snapshot.extraExpense) || 0) * 100) / 100;
  const shippingAmount = Math.round((Number(snapshot.shippingCharges) || 0) * 100) / 100;
  const hasDiscount = discountAmount > 0;
  const arDebit = Math.round((total + shippingAmount) * 100) / 100;
  const grossTotal = Math.round(((hasDiscount ? total + discountAmount : total) + shippingAmount) * 100) / 100;
  const revenueCredit = Math.round((grossTotal - shippingAmount) * 100) / 100;
  const merchandisePool = Math.round((revenueCredit - extraAmount) * 100) / 100;
  return { arDebit, grossTotal, revenueCredit, merchandisePool, extraAmount, shippingAmount };
}

/** Reject unbalanced journal lines before persisting (prevents silent GL drift). */
export function assertJournalLinesBalanced(
  lines: { debit?: number; credit?: number }[],
  context: string
): void {
  const debit = Math.round(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100;
  const credit = Math.round(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100;
  const diff = Math.round((debit - credit) * 100) / 100;
  if (Math.abs(diff) > 0.02) {
    throw new Error(
      `Journal entry unbalanced (${context}): debit ${debit} vs credit ${credit}, diff ${diff}`
    );
  }
}
