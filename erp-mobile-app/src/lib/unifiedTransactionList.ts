import type { RentalListItem } from '../api/rentals';
import type { SaleListTypeFilter } from './saleTypeClassification';
import { matchesSaleListTypeFilter } from './saleTypeClassification';
import { formatDocumentListDateTime } from '../utils/localDate';

export type UnifiedListRow = {
  kind: 'sale' | 'rental';
  id: string;
  customer: string;
  billRef?: string;
  amount: number;
  total_received: number;
  balance_due: number;
  credit_balance: number;
  date: string;
  created_by_name: string;
  grand_total?: number;
  studio_charges?: number;
  shipment_status?: string;
  sortMs: number;
  saleRaw?: Record<string, unknown>;
  rentalId?: string;
  rentalStatus?: string;
};

export type SaleRecordLike = {
  raw: Record<string, unknown>;
  id: string;
  customer: string;
  billRef?: string;
  amount: number;
  total_received: number;
  balance_due: number;
  credit_balance: number;
  date: string;
  created_by_name: string;
  studio_charges?: number;
  grand_total?: number;
  shipment_status?: string;
};

export function saleToUnifiedRow(sale: SaleRecordLike): UnifiedListRow {
  const rawDate = (sale.raw.invoice_date as string) || (sale.raw.created_at as string) || '';
  const sortMs = rawDate ? new Date(rawDate).getTime() : 0;
  return {
    kind: 'sale',
    id: sale.id,
    customer: sale.customer,
    billRef: sale.billRef,
    amount: sale.amount,
    total_received: sale.total_received,
    balance_due: sale.balance_due,
    credit_balance: sale.credit_balance,
    date: sale.date,
    created_by_name: sale.created_by_name,
    grand_total: sale.grand_total,
    studio_charges: sale.studio_charges,
    shipment_status: sale.shipment_status,
    sortMs,
    saleRaw: sale.raw,
  };
}

export function rentalToUnifiedRow(r: RentalListItem): UnifiedListRow {
  const dateStr = r.bookingDate
    ? formatDocumentListDateTime({ documentDate: r.bookingDate, eventTimestamp: r.bookingDate })
    : '—';
  const sortMs = r.bookingDate ? new Date(r.bookingDate).getTime() : 0;
  return {
    kind: 'rental',
    id: r.bookingNo || r.no,
    customer: r.customer,
    billRef: r.documentNumber || undefined,
    amount: r.total,
    total_received: r.paid,
    balance_due: r.due,
    credit_balance: 0,
    date: dateStr,
    created_by_name: r.salesmanName || r.createdByName || '',
    grand_total: r.total,
    sortMs,
    rentalId: r.id,
    rentalStatus: r.status,
  };
}

export function mergeUnifiedRows(sales: UnifiedListRow[], rentals: UnifiedListRow[]): UnifiedListRow[] {
  return [...sales, ...rentals].sort((a, b) => b.sortMs - a.sortMs);
}

export function filterUnifiedRows(
  rows: UnifiedListRow[],
  filter: SaleListTypeFilter,
): UnifiedListRow[] {
  if (filter === 'rental') return rows.filter((r) => r.kind === 'rental');
  if (filter === 'work_orders') return [];
  if (filter === 'all') return rows;
  return rows.filter(
    (r) => r.kind === 'sale' && r.saleRaw && matchesSaleListTypeFilter(r.saleRaw, filter),
  );
}

export function searchUnifiedRows(rows: UnifiedListRow[], query: string): UnifiedListRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const bill = (row.billRef || '').toLowerCase();
    return (
      row.id.toLowerCase().includes(q) ||
      row.customer.toLowerCase().includes(q) ||
      bill.includes(q)
    );
  });
}
