import type { RentalCalendarRental } from '../../api/rentals';
import { localNowDateString } from '../../utils/localDate';

export interface CalendarBooking {
  id: string;
  rentalId: string;
  rentalNo: string;
  productId: string;
  productName: string;
  customer: string;
  start: string;
  end: string;
  status: string;
  isTodayReturn: boolean;
}

export const CALENDAR_STATUS_COLORS: Record<string, string> = {
  booked: 'bg-pink-500',
  rented: 'bg-blue-600',
  overdue: 'bg-red-600',
  returned: 'bg-green-600',
  cancelled: 'bg-gray-600',
  draft: 'bg-gray-600',
};

export const CALENDAR_STATUS_PILL: Record<string, string> = {
  booked: 'bg-pink-500/20 text-pink-300',
  rented: 'bg-blue-600/20 text-blue-300',
  overdue: 'bg-red-600/20 text-red-300',
  returned: 'bg-green-600/20 text-green-300',
  cancelled: 'bg-gray-600/20 text-gray-300',
  draft: 'bg-gray-600/20 text-gray-300',
};

/** Align with web RentalCalendar active statuses. */
const ACTIVE_STATUSES = new Set([
  'booked',
  'rented',
  'overdue',
  'returned',
  'picked_up',
  'active',
]);

export function buildCalendarBookings(rentals: RentalCalendarRental[]): CalendarBooking[] {
  const today = localNowDateString();
  const result: CalendarBooking[] = [];

  for (const r of rentals) {
    if (!ACTIVE_STATUSES.has(r.status)) continue;
    if (!r.start || !r.end) continue;
    const items = r.items ?? [];
    for (const item of items) {
      if (!item.productId) continue;
      result.push({
        id: `${r.id}-${item.productId}`,
        rentalId: r.id,
        rentalNo: r.bookingNo,
        productId: item.productId,
        productName: item.productName || '',
        customer: r.customerName || '',
        start: r.start,
        end: r.end,
        status: r.status,
        isTodayReturn:
          r.end === today && ['booked', 'rented', 'overdue'].includes(r.status),
      });
    }
  }
  return result;
}

export function buildProductsForRows(
  products: Array<{ id: string; name: string }>,
  bookings: CalendarBooking[],
): Array<{ id: string; name: string }> {
  const byProduct = new Map<string, { id: string; name: string }>();
  for (const p of products) {
    byProduct.set(p.id, p);
  }
  for (const b of bookings) {
    if (!byProduct.has(b.productId)) {
      byProduct.set(b.productId, { id: b.productId, name: b.productName || 'Unknown' });
    }
  }
  return Array.from(byProduct.values()).sort((a, b) => a.name.localeCompare(b.name));
}
