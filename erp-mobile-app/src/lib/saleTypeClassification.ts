/** Sale list type tabs — parity with web SalesPage isLikelyPOS / isStudioSale. */
export type SaleListTypeFilter = 'all' | 'studio' | 'pos' | 'regular' | 'rental';

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

export function matchesSaleListTypeFilter(
  row: Record<string, unknown>,
  filter: SaleListTypeFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'rental') return false;
  if (filter === 'studio') return isStudioSaleRow(row);
  if (filter === 'pos') return isLikelyPosSaleRow(row);
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
    case 'rental':
      return 'Rental';
    default:
      return 'All';
  }
}

function saleTypeFilterGridClass(tabCount: number): string {
  if (tabCount <= 3) return 'grid-cols-3';
  if (tabCount === 4) return 'grid-cols-4';
  return 'grid-cols-5';
}

export function saleTypeFilterGridColsClass(tabs: SaleListTypeFilter[]): string {
  return saleTypeFilterGridClass(tabs.length);
}
