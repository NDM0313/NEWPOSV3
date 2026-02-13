/**
 * Rental Availability Service
 * Double-booking prevention: strict overlapping logic for Booked/Active rentals
 */

import { supabase } from '@/lib/supabase';

/** Statuses that block availability (product is "out") */
const BLOCKING_STATUSES = ['booked', 'picked_up', 'active', 'overdue'] as const;

export interface AvailabilityConflict {
  rentalId: string;
  bookingNo: string;
  customerName: string;
  pickupDate: string;
  returnDate: string;
  status: string;
}

export interface CheckAvailabilityResult {
  available: boolean;
  conflicts: AvailabilityConflict[];
  message?: string;
}

/**
 * Check if a product is available for the requested date range.
 * Blocks any overlapping booking where status IN ('booked', 'picked_up', 'active', 'overdue')
 *
 * Overlap logic: (A_start < B_end) AND (A_end > B_start)
 */
export async function checkRentalAvailability(params: {
  companyId: string;
  productId: string;
  startDate: string;
  endDate: string;
  excludeRentalId?: string;
  branchId?: string | null;
}): Promise<CheckAvailabilityResult> {
  const { companyId, productId, startDate, endDate, excludeRentalId, branchId } = params;

  let query = supabase
    .from('rentals')
    .select(
      `
      id,
      booking_no,
      customer_name,
      pickup_date,
      return_date,
      status
    `
    )
    .eq('company_id', companyId)
    .in('status', [...BLOCKING_STATUSES])
    .lt('pickup_date', endDate)
    .gt('return_date', startDate);

  if (branchId && branchId !== 'all') {
    query = query.eq('branch_id', branchId);
  }

  if (excludeRentalId) {
    query = query.neq('id', excludeRentalId);
  }

  const { data: rentals, error } = await query;

  if (error) {
    console.error('[RENTAL AVAILABILITY]', error);
    return { available: false, conflicts: [], message: 'Failed to check availability' };
  }

  const rentalIds = (rentals || []).map((r: any) => r.id);
  if (rentalIds.length === 0) {
    return { available: true, conflicts: [] };
  }

  const { data: items, error: itemsErr } = await supabase
    .from('rental_items')
    .select('rental_id, product_id')
    .in('rental_id', rentalIds)
    .eq('product_id', productId);

  if (itemsErr || !items?.length) {
    return { available: true, conflicts: [] };
  }

  const conflictRentalIds = new Set(items.map((i: any) => i.rental_id));
  const conflicts: AvailabilityConflict[] = (rentals || [])
    .filter((r: any) => conflictRentalIds.has(r.id))
    .map((r: any) => ({
      rentalId: r.id,
      bookingNo: r.booking_no || r.rental_no || '',
      customerName: r.customer_name || '',
      pickupDate: r.pickup_date || '',
      returnDate: r.return_date || '',
      status: r.status || '',
    }));

  if (conflicts.length === 0) {
    return { available: true, conflicts: [] };
  }

  const first = conflicts[0];
  const msg = `Product is already booked from ${first.pickupDate} to ${first.returnDate} (${first.bookingNo} - ${first.customerName})`;

  return {
    available: false,
    conflicts,
    message: msg,
  };
}

/**
 * Check availability for multiple products at once (for create/update with multiple items)
 */
export async function checkRentalAvailabilityForItems(params: {
  companyId: string;
  items: Array<{ productId: string }>;
  startDate: string;
  endDate: string;
  excludeRentalId?: string;
  branchId?: string | null;
}): Promise<CheckAvailabilityResult> {
  const { companyId, items, startDate, endDate, excludeRentalId, branchId } = params;

  for (const item of items) {
    const result = await checkRentalAvailability({
      companyId,
      productId: item.productId,
      startDate,
      endDate,
      excludeRentalId,
      branchId,
    });
    if (!result.available) {
      return result;
    }
  }

  return { available: true, conflicts: [] };
}
