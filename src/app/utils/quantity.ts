/**
 * Quantity formatting helpers for web ERP.
 *
 * Display rule: always show exactly 2 decimal places (e.g. 10 -> "10.00",
 * -2498.2999999999997 -> "-2498.30"). Use for stock, min stock, and qty in lists/reports.
 */

function roundQty(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatQty(n: number | string | null | undefined): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0.00';
  return roundQty(num).toFixed(2);
}

/** Alias for formatQty — same fixed 2-decimal display. */
export function formatQtyFixed(n: number | string | null | undefined): string {
  return formatQty(n);
}
