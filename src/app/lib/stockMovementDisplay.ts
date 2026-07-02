/** Shared movement type labels and colors for stock ledger UIs. */

import type { ProductStockSummary } from './stockMovementReportLogic';

export function formatProductVariationLabel(variation: {
  name?: string | null;
  sku?: string | null;
  attributes?: Record<string, unknown> | null;
}): string {
  const attrEntries =
    typeof variation.attributes === 'object' && variation.attributes !== null
      ? Object.entries(variation.attributes).filter(([, val]) => String(val).trim() !== '')
      : [];
  if (attrEntries.length) {
    return attrEntries.map(([k, val]) => `${k}: ${val}`).join(', ');
  }
  return variation.name || variation.sku || 'Variation';
}

export function formatProductSummaryLine(summary: ProductStockSummary): string {
  const fmt = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `Opening: ${fmt(summary.openingStock)} | In: ${fmt(summary.totalIn)} | Out: ${fmt(summary.totalOut)} | Adj: ${fmt(summary.netAdjustment)} | Current: ${fmt(summary.currentStock)} | ${stockStatusBadgeLabel(summary.status)}`;
}

export const STOCK_MOVEMENT_TYPE_LABELS: Record<string, string> = {
  purchase: 'Purchase',
  sale: 'Sale',
  return: 'Return',
  adjustment: 'Stock Adjustment',
  transfer: 'Branch Transfer',
  transfer_in: 'Branch Transfer In',
  transfer_out: 'Branch Transfer Out',
  sell_return: 'Sale Return',
  sale_return: 'Sale Return',
  purchase_return: 'Purchase Return',
  rental_out: 'Rental Out',
  rental_in: 'Rental Return',
  rental_return: 'Rental Return',
  sale_cancelled: 'Sale Cancelled',
  purchase_cancelled: 'Purchase Cancelled',
  opening_stock: 'Opening Stock',
  opening_balance: 'Opening Stock',
  production: 'Studio / Production Receive',
  production_in: 'Studio / Production Receive',
};

export function getMovementTypeLabel(type: string, referenceType?: string | null): string {
  const ref = String(referenceType || '').toLowerCase();
  if (ref === 'opening_balance') return 'Opening Stock';
  const key = String(type || '').toLowerCase();
  return STOCK_MOVEMENT_TYPE_LABELS[key] || type || 'Movement';
}

export function movementQtyDirectionClass(
  quantity: number,
  movementType: string,
  referenceType?: string | null,
): string {
  const typeLower = movementType.toLowerCase();
  const ref = String(referenceType || '').toLowerCase();
  if (typeLower === 'adjustment' || ref === 'opening_balance' || typeLower === 'opening_stock') {
    return quantity >= 0 ? 'text-emerald-400' : 'text-amber-400';
  }
  if (quantity > 0) return 'text-emerald-400';
  if (quantity < 0) return 'text-red-400';
  return 'text-gray-400';
}

export function movementRowColorClass(type: string, quantity: number, referenceType?: string | null): string {
  const typeLower = type.toLowerCase();
  const ref = String(referenceType || '').toLowerCase();
  const isIn = quantity > 0;

  if (typeLower === 'sale_cancelled' || typeLower === 'purchase_cancelled') {
    return 'text-amber-400 bg-amber-950/30 border-amber-900/40';
  }
  if (ref === 'opening_balance' || typeLower === 'opening_stock' || typeLower === 'opening_balance') {
    return 'text-blue-400 bg-blue-950/30 border-blue-900/40';
  }
  if (typeLower === 'adjustment') {
    return isIn
      ? 'text-amber-400 bg-amber-950/20 border-amber-900/40'
      : 'text-amber-300 bg-amber-950/20 border-amber-900/40';
  }
  if (
    typeLower === 'purchase' ||
    typeLower === 'return' ||
    typeLower === 'sell_return' ||
    typeLower === 'sale_return' ||
    typeLower === 'rental_in' ||
    typeLower === 'rental_return' ||
    typeLower === 'transfer_in' ||
    typeLower === 'production' ||
    typeLower === 'production_in'
  ) {
    return isIn ? 'text-emerald-400 bg-emerald-950/20 border-emerald-900/40' : 'text-red-400 bg-red-950/20 border-red-900/40';
  }
  if (
    typeLower === 'sale' ||
    typeLower === 'purchase_return' ||
    typeLower === 'rental_out' ||
    typeLower === 'transfer_out'
  ) {
    return 'text-red-400 bg-red-950/20 border-red-900/40';
  }
  if (typeLower === 'transfer') {
    return 'text-purple-400 bg-purple-950/20 border-purple-900/40';
  }
  return 'text-gray-400 bg-gray-900/20 border-gray-800';
}

export type StockStatusBadge = 'in_stock' | 'zero_stock' | 'negative_stock' | 'no_movement';

export function stockStatusBadgeLabel(status: StockStatusBadge): string {
  switch (status) {
    case 'in_stock':
      return 'In Stock';
    case 'zero_stock':
      return 'Zero Stock';
    case 'negative_stock':
      return 'Negative Stock';
    case 'no_movement':
      return 'No Movement';
    default:
      return status;
  }
}

export function stockStatusBadgeClass(status: StockStatusBadge): string {
  switch (status) {
    case 'in_stock':
      return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50';
    case 'zero_stock':
      return 'bg-gray-800 text-gray-400 border-gray-700';
    case 'negative_stock':
      return 'bg-red-950/40 text-red-300 border-red-800/50';
    case 'no_movement':
      return 'bg-blue-950/40 text-blue-300 border-blue-800/50';
    default:
      return 'bg-gray-800 text-gray-400';
  }
}
