/**
 * Shared DB row → RentalUI mapping for RentalContext and queue tabs.
 */
import type { RentalUI, RentalItemUI } from '@/app/types/rentalTypes';

export function mapRentalStatus(status: string): RentalUI['status'] {
  const map: Record<string, RentalUI['status']> = {
    draft: 'draft',
    booked: 'booked',
    rented: 'rented',
    returned: 'returned',
    overdue: 'overdue',
    cancelled: 'cancelled',
    picked_up: 'rented',
    active: 'rented',
    closed: 'returned',
  };
  return (map[status] || 'draft') as RentalUI['status'];
}

export function mapRentalRowToUI(row: Record<string, unknown>): RentalUI {
  const branch = row.branch as { name?: string; code?: string } | null | undefined;
  let location = '';
  if (branch) {
    location = branch.name || branch.code || '';
  }
  if (location && branch?.code) location = `${branch.code} | ${location}`.trim();
  if (!location && row.branch_id) location = String(row.branch_id);

  const startDate =
    String(row.start_date || row.pickup_date || row.booking_date || '').slice(0, 10);
  const expectedReturnDate =
    String(row.expected_return_date || row.return_date || '').slice(0, 10);
  const actualReturnDate = row.actual_return_date != null ? String(row.actual_return_date).slice(0, 10) : null;
  const rentalNo = String(row.rental_no || row.booking_no || '');

  const customer = row.customer as { name?: string; phone?: string } | null | undefined;
  const items = (row.items as Record<string, unknown>[] | undefined) || [];

  const mappedItems: RentalItemUI[] = items.map((i) => ({
    id: String(i.id ?? ''),
    productId: String(i.product_id ?? ''),
    productName: String(i.product_name || (i.product as { name?: string } | undefined)?.name || ''),
    sku: String(i.sku || (i.product as { sku?: string } | undefined)?.sku || ''),
    quantity: Number(i.quantity ?? 0),
    unit: String(i.unit || 'piece'),
    rate: Number(i.rate ?? i.rate_per_day ?? 0),
    total: Number(i.total ?? 0),
    boxes: i.boxes as number | null | undefined,
    pieces: i.pieces as number | null | undefined,
  }));

  const createdByUser = row.created_by_user as { full_name?: string; email?: string } | null | undefined;

  return {
    id: String(row.id ?? ''),
    rentalNo,
    customerId: row.customer_id != null ? String(row.customer_id) : null,
    customerName: String(row.customer_name || customer?.name || 'Unknown'),
    customerContact: customer?.phone,
    branchId: String(row.branch_id || ''),
    location,
    startDate,
    expectedReturnDate,
    actualReturnDate,
    status: mapRentalStatus(String(row.status || 'draft')),
    totalAmount: Number(row.total_amount ?? row.rental_charges ?? 0),
    paidAmount: Number(row.paid_amount ?? 0),
    dueAmount: Number(row.due_amount ?? 0),
    itemsCount: mappedItems.length,
    items: mappedItems,
    createdAt: String(row.created_at || row.booking_date || ''),
    salesmanId: row.salesman_id != null ? String(row.salesman_id) : null,
    createdBy: row.created_by != null ? String(row.created_by) : undefined,
    createdByName: createdByUser?.full_name || createdByUser?.email || 'System',
    notes: row.notes != null ? String(row.notes) : null,
    documentType: row.document_type != null ? String(row.document_type) : undefined,
    documentNumber: row.document_number != null ? String(row.document_number) : undefined,
    securityDocumentType: row.security_document_type != null ? String(row.security_document_type) : null,
    securityDocumentNumber: row.security_document_number != null ? String(row.security_document_number) : null,
    pickupDocumentType:
      (row.security_document_type as string | null) ||
      (row.document_received ? (row.document_type as string | null) : null) ||
      null,
    pickupDocumentNumber:
      (row.security_document_number as string | null) ||
      (row.document_received && row.document_type && !row.security_document_number
        ? (row.document_number as string | null)
        : null) ||
      null,
    damageCharges: Number(row.damage_charges ?? 0) || 0,
    conditionType: row.condition_type != null ? String(row.condition_type) : null,
    damageNotes: row.damage_notes != null ? String(row.damage_notes) : null,
    penaltyPaid: row.penalty_paid === true,
    refundAmount: Number(row.refund_amount ?? 0) || 0,
  };
}

/** Enum-safe DB status values for Supabase `.in('status', …)` (no picked_up/rented). */
export const DB_OPEN_RENTAL_STATUSES = ['booked', 'active', 'overdue', 'returned'] as const;

export function dbStatusesForReturnQueue(): string[] {
  return ['booked', 'active', 'overdue'];
}

export function dbStatusesForCollections(): string[] {
  return ['booked', 'active', 'overdue', 'returned'];
}

/** Map rental rows; skip bad rows instead of failing the whole batch. */
export function mapRentalRowsSafe(rows: Record<string, unknown>[]): RentalUI[] {
  const out: RentalUI[] = [];
  for (const row of rows) {
    try {
      out.push(mapRentalRowToUI(row));
    } catch (e) {
      console.warn('[rentalUiMapper] skip bad row', row?.id ?? row, e);
    }
  }
  return out;
}
