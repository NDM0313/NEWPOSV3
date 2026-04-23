/**
 * Quantity formatting helpers for web ERP.
 *
 * Display rule: show quantities with at most 2 decimal places, trimming trailing zeros.
 */

export function formatQty(n: number | string | null | undefined): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  if (num === 0) return '0';
  const rounded = Math.round(num * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

export function formatQtyFixed(n: number | string | null | undefined): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0.00';
  return (Math.round(num * 100) / 100).toFixed(2);
}
