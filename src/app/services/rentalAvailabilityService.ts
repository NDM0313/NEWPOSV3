/**
 * Rental Availability Service
 * Overlap check with stock quantity: multiple units can be booked on same dates when stock allows.
 */

import { supabase } from '@/lib/supabase';
import { applyBranchStockMovementFilter } from '@/app/utils/branchScope';

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
  /** When true, UI may offer "Book anyway?" override */
  requiresConfirmation?: boolean;
}

function matchesRentalLineVariation(
  lineVariationId: string | null | undefined,
  requestedVariationId?: string | null,
): boolean {
  if (requestedVariationId) return lineVariationId === requestedVariationId;
  return !lineVariationId;
}

async function getRentalProductStock(
  companyId: string,
  productId: string,
  variationId: string | null | undefined,
  branchId?: string | null,
): Promise<number> {
  let q = supabase
    .from('stock_movements')
    .select('quantity, variation_id')
    .eq('company_id', companyId)
    .eq('product_id', productId);
  q = applyBranchStockMovementFilter(q, branchId);
  const { data, error } = await q;
  if (error) {
    console.error('[RENTAL AVAILABILITY] stock lookup failed:', error);
    return 0;
  }
  let sum = 0;
  for (const row of data || []) {
    const vid = (row as { variation_id?: string | null }).variation_id ?? null;
    if (variationId) {
      if (vid === variationId) sum += Number((row as { quantity?: number }).quantity) || 0;
    } else if (!vid) {
      sum += Number((row as { quantity?: number }).quantity) || 0;
    }
  }
  return sum;
}

/**
 * Check if a product is available for the requested date range and quantity.
 * Blocks when overlapping booked qty + requested qty exceeds stock (unless UI confirms override).
 */
export async function checkRentalAvailability(params: {
  companyId: string;
  productId: string;
  startDate: string;
  endDate: string;
  requestedQuantity?: number;
  variationId?: string | null;
  excludeRentalId?: string;
  branchId?: string | null;
}): Promise<CheckAvailabilityResult> {
  const {
    companyId,
    productId,
    startDate,
    endDate,
    requestedQuantity = 1,
    variationId,
    excludeRentalId,
    branchId,
  } = params;

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
    .gte('return_date', startDate);

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

  const rentalIds = (rentals || []).map((r: { id: string }) => r.id);
  if (rentalIds.length === 0) {
    return { available: true, conflicts: [] };
  }

  const { data: items, error: itemsErr } = await supabase
    .from('rental_items')
    .select('rental_id, product_id, variation_id, quantity')
    .in('rental_id', rentalIds)
    .eq('product_id', productId);

  if (itemsErr) {
    console.error('[RENTAL AVAILABILITY] rental_items', itemsErr);
    return { available: false, conflicts: [], message: 'Failed to check availability' };
  }

  const matchingLines = (items || []).filter((i: {
    product_id: string;
    variation_id?: string | null;
  }) => matchesRentalLineVariation(i.variation_id, variationId));

  if (matchingLines.length === 0) {
    return { available: true, conflicts: [] };
  }

  const conflictRentalIds = new Set(matchingLines.map((i: { rental_id: string }) => i.rental_id));
  const conflicts: AvailabilityConflict[] = (rentals || [])
    .filter((r: { id: string }) => conflictRentalIds.has(r.id))
    .map((r: {
      id: string;
      booking_no?: string;
      rental_no?: string;
      customer_name?: string;
      pickup_date?: string;
      return_date?: string;
      status?: string;
    }) => ({
      rentalId: r.id,
      bookingNo: r.booking_no || r.rental_no || '',
      customerName: r.customer_name || '',
      pickupDate: r.pickup_date || '',
      returnDate: r.return_date || '',
      status: r.status || '',
    }));

  const alreadyBookedQty = matchingLines.reduce(
    (sum: number, i: { quantity?: number }) => sum + (Number(i.quantity) || 0),
    0,
  );
  const stock = await getRentalProductStock(companyId, productId, variationId, branchId);
  const requestedQty = Math.max(0, Number(requestedQuantity) || 0);

  if (stock >= alreadyBookedQty + requestedQty) {
    return { available: true, conflicts: [] };
  }

  if (conflicts.length === 0) {
    return { available: true, conflicts: [] };
  }

  const first = conflicts[0];
  const msg = `Product is already booked from ${first.pickupDate} to ${first.returnDate} (${first.bookingNo || first.rentalId} - ${first.customerName})`;

  return {
    available: false,
    conflicts,
    requiresConfirmation: true,
    message: msg,
  };
}

/**
 * Check availability for multiple products at once (for create/update with multiple items)
 */
export async function checkRentalAvailabilityForItems(params: {
  companyId: string;
  items: Array<{ productId: string; quantity?: number; variationId?: string | null }>;
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
      requestedQuantity: item.quantity ?? 1,
      variationId: item.variationId,
      excludeRentalId,
      branchId,
    });
    if (!result.available) {
      return result;
    }
  }

  return { available: true, conflicts: [] };
}
