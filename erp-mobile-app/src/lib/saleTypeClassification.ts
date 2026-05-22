/** Sale list type tabs — parity with web SalesPage isLikelyPOS / isStudioSale. */
export type SaleListTypeFilter = 'all' | 'studio' | 'pos' | 'regular';

function saleDocNo(row: Record<string, unknown>): string {
  const inv = row.invoice_no != null ? String(row.invoice_no).trim() : '';
  const ord = row.order_no != null ? String(row.order_no).trim() : '';
  return inv || ord || '';
}

function customerName(row: Record<string, unknown>): string {
  const cust = row.customer as { name?: string } | null;
  return String(cust?.name ?? row.customer_name ?? '').trim();
}

/** Studio: STD-/ST- prefix, is_studio, or studio_charges > 0 */
export function isStudioSaleRow(row: Record<string, unknown>): boolean {
  const inv = saleDocNo(row);
  if (inv.startsWith('STD-') || inv.startsWith('ST-')) return true;
  if (row.is_studio === true) return true;
  if (Number(row.studio_charges ?? 0) > 0) return true;
  return false;
}

/** POS: POS- prefix, or walk-in + final status */
export function isLikelyPosSaleRow(row: Record<string, unknown>): boolean {
  const inv = saleDocNo(row);
  if (inv.startsWith('POS-')) return true;
  const walkIn = customerName(row).toLowerCase().includes('walk-in');
  const final = String(row.status ?? '').toLowerCase() === 'final';
  return !!(walkIn && final);
}

export function matchesSaleListTypeFilter(
  row: Record<string, unknown>,
  filter: SaleListTypeFilter
): boolean {
  if (filter === 'all') return true;
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
    default:
      return 'All';
  }
}
