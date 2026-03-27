/**
 * Payment history lists sometimes include synthetic rows for payment_allocations
 * (one parent payment split across invoices/bills). Those rows use id `alloc:<allocation_uuid>`.
 * Mutations (edit/update/delete) must target payments.id — never the allocation row id.
 */

export const PAYMENT_ALLOC_ROW_PREFIX = 'alloc:' as const;

export interface PaymentHistoryRowLike {
  id: string;
  amount: number;
  date?: string;
  referenceNo?: string;
  method?: string;
  accountId?: string;
  accountName?: string;
  notes?: string;
  attachments?: unknown;
  createdAt?: string;
  updatedAt?: string;
  receivedBy?: string | null;
  /** Parent payments.id when this row is a payment_allocations breakdown line */
  parentPaymentId?: string;
  /** Full payment header amount (parent row) — required for edit when row is allocation breakdown */
  parentPaymentAmount?: number;
  source?: string;
  /** Compact label for manual AP / receipt allocation rows (not part of referenceNo) */
  allocationBadge?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAllocationBreakdownRowId(id: string): boolean {
  return typeof id === 'string' && id.startsWith(PAYMENT_ALLOC_ROW_PREFIX);
}

/** Synthetic allocation line (display-only id `alloc:<payment_allocation.id>`). */
export function isAllocationBreakdownRow(row: Pick<PaymentHistoryRowLike, 'id'>): boolean {
  return isAllocationBreakdownRowId(row.id);
}

/**
 * Returns a copy safe to pass into UnifiedPaymentDialog / updatePayment:
 * real payments.id and full payment amount.
 */
export function resolvePaymentRowForEdit(row: PaymentHistoryRowLike): PaymentHistoryRowLike {
  if (!isAllocationBreakdownRow(row)) {
    return { ...row };
  }
  const pid = row.parentPaymentId;
  if (!pid || !UUID_RE.test(pid)) {
    throw new Error(
      'This line is an allocation breakdown; parent payment could not be resolved. Refresh payment history and try again.'
    );
  }
  const fullAmount =
    row.parentPaymentAmount != null && Number.isFinite(row.parentPaymentAmount)
      ? row.parentPaymentAmount
      : row.amount;
  return {
    ...row,
    id: pid,
    amount: fullAmount,
  };
}

/** Delete / RPC calls: payments.id only */
export function resolvePaymentIdForMutation(row: Pick<PaymentHistoryRowLike, 'id' | 'parentPaymentId'>): string {
  if (isAllocationBreakdownRow(row)) {
    const pid = row.parentPaymentId;
    if (pid && UUID_RE.test(pid)) return pid;
    throw new Error(
      'Cannot delete: this row is an allocation line without a parent payment id. Refresh and try again.'
    );
  }
  if (!row.id || !UUID_RE.test(row.id)) {
    throw new Error('Invalid payment id for this operation.');
  }
  return row.id;
}
