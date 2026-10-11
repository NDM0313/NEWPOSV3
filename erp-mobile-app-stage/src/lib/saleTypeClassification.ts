/** Sale list type tabs — parity with web SalesPage isLikelyPOS / isStudioSale / Order status. */
export type SaleListTypeFilter = 'all' | 'studio' | 'pos' | 'regular' | 'order' | 'rental' | 'work_orders';

function saleDocNo(row: Record<string, unknown>): string {
  const inv = row.invoice_no != null ? String(row.invoice_no).trim() : '';
  const ord = row.order_no != null ? String(row.order_no).trim() : '';
  return inv || ord || '';
}

/** Studio: STD-/ST- prefix, is_studio, or studio_charges > 0 */
export function isStudioSaleRow(row: Record<string, unknown>): boolean {
  const inv = saleDocNo(row);
  if (inv.startsWith('STD-') || inv.startsWith('ST-')) return true;
  if (row.is_studio === true) return true;
  if (Number(row.studio_charges ?? 0) > 0) return true;
  return false;
}

/** POS: POS terminal checkout only (invoice prefix POS-) */
export function isLikelyPosSaleRow(row: Record<string, unknown>): boolean {
  return saleDocNo(row).startsWith('POS-');
}

/** Lifecycle order (not yet final invoice). */
export function isOrderSaleRow(row: Record<string, unknown>): boolean {
  return String(row.status ?? '').toLowerCase() === 'order';
}

export function matchesSaleListTypeFilter(
  row: Record<string, unknown>,
  filter: SaleListTypeFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'rental' || filter === 'work_orders') return false;
  if (filter === 'studio') return isStudioSaleRow(row);
  if (filter === 'pos') return isLikelyPosSaleRow(row);
  if (filter === 'order') return isOrderSaleRow(row);
  return !isLikelyPosSaleRow(row) && !isStudioSaleRow(row);
}

export function saleListTypeLabel(filter: SaleListTypeFilter): string {
  switch (filter) {
    case 'studio':
      return 'Studio';
    case 'pos':
      return 'POS';
    case 'regular':
      return 'Regular';
    case 'order':
      return 'Order';
    case 'rental':
      return 'Rental';
    case 'work_orders':
      return 'WOs';
    default:
      return 'All';
  }
}
