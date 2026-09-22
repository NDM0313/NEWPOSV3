/** Proportional clearance/freight split across purchase lines (goods subtotal basis). */

export function lineClearanceAlloc(
  lineTotal: number,
  goodsSubtotal: number,
  clearanceTotal: number
): number {
  const sub = Number(goodsSubtotal) || 0;
  const line = Number(lineTotal) || 0;
  const clearance = Number(clearanceTotal) || 0;
  if (sub <= 0 || clearance <= 0 || line <= 0) return 0;
  return Math.round((clearance * line) / sub * 100) / 100;
}

export function purchaseHasSeparateClearance(purchase: {
  shippingCost?: number | null;
  shipping_cost?: number | null;
}): boolean {
  const freight = Number(purchase.shippingCost ?? purchase.shipping_cost ?? 0) || 0;
  return freight > 0;
}

export function purchaseClearanceTotal(purchase: {
  shippingCost?: number | null;
  shipping_cost?: number | null;
}): number {
  return Number(purchase.shippingCost ?? purchase.shipping_cost ?? 0) || 0;
}
