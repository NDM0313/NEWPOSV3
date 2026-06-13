import type { RentalUI } from '@/app/types/rentalTypes';

export function getRentalDueAmount(r: RentalUI): number {
  const d = r.dueAmount ?? 0;
  return d > 0 ? d : Math.max(0, (r.totalAmount ?? 0) - (r.paidAmount ?? 0));
}

/** Pickup queue: booked rentals with effective start date on or before asOf. */
export function isPickupDue(r: RentalUI, asOf: string): boolean {
  if (r.status !== 'booked') return false;
  const start = (r.startDate || '').slice(0, 10);
  return !!start && start <= asOf;
}

/** Return queue: matches RentalsPage return_today filter (UI statuses). */
export function isReturnDue(r: RentalUI, asOf: string): boolean {
  if (!['booked', 'rented', 'overdue'].includes(r.status)) return false;
  const ret = (r.expectedReturnDate || '').slice(0, 10);
  return !!ret && ret <= asOf;
}

/** Collections: balance due on open or post-return rentals. */
export function hasOutstandingBalance(r: RentalUI): boolean {
  if (!['booked', 'rented', 'overdue', 'returned'].includes(r.status)) return false;
  return getRentalDueAmount(r) > 0;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysOverdue(expectedReturn: string, asOf = todayIso()): number {
  if (!expectedReturn || expectedReturn >= asOf) return 0;
  const diff = new Date(asOf).getTime() - new Date(expectedReturn).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export function getAgingBucket(expectedReturn: string, asOf = todayIso()): AgingBucket {
  const days = daysOverdue(expectedReturn, asOf);
  if (days <= 0) return 'current';
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export function matchesRentalSearch(r: RentalUI, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const hay = [
    r.rentalNo,
    r.customerName,
    r.customerContact,
    r.location,
    ...(r.items || []).map((i) => `${i.productName} ${i.sku}`),
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(term);
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const escape = (v: string) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
