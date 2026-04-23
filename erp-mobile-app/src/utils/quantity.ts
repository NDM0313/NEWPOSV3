/**
 * Quantity formatting helpers for mobile ERP.
 *
 * Display rule: show quantities with at most 2 decimal places, trimming trailing zeros.
 * E.g. 10 -> "10", 10.5 -> "10.5", 10.25 -> "10.25", 10.256 -> "10.26".
 */

export function formatQty(n: number | string | null | undefined): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  if (num === 0) return '0';
  const rounded = Math.round(num * 100) / 100;
  // Use toFixed(2) then trim trailing zeros and dangling decimal point
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Same as formatQty but always shows exactly 2 decimals (useful for reports/exports).
 */
export function formatQtyFixed(n: number | string | null | undefined): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0.00';
  return (Math.round(num * 100) / 100).toFixed(2);
}
