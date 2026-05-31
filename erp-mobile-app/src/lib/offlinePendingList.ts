/**
 * Merge unsynced offline queue rows into list UIs (optimistic pending_sync).
 */
import { getUnsynced, normalizeQueueStatus, type PendingRecord } from './offlineStore';
import { toLocalDateString, toLocalISOString } from '../utils/localDate';
import { sortByDocumentDateTimeDesc } from '../utils/chronologicalSort';
import type { PurchaseListItem } from '../api/purchases';

function branchMatches(
  recordBranch: string,
  filterBranch: string | null | undefined,
  accessibleBranchIds?: string[] | null,
): boolean {
  if (accessibleBranchIds?.length) {
    return accessibleBranchIds.includes(recordBranch);
  }
  if (!filterBranch || filterBranch === 'all' || filterBranch === 'default') return true;
  return recordBranch === filterBranch;
}

export async function getPendingSaleRows(
  companyId: string,
  branchId?: string | null,
  accessibleBranchIds?: string[] | null,
): Promise<Record<string, unknown>[]> {
  const pending = await getUnsynced();
  return pending
    .filter(
      (r) =>
        r.type === 'sale' &&
        r.company_id === companyId &&
        branchMatches(r.branch_id, branchId, accessibleBranchIds) &&
        needsSync(r),
    )
    .map((r) => pendingSaleToRow(r));
}

export async function getPendingPurchaseRows(
  companyId: string,
  branchId?: string | null,
  accessibleBranchIds?: string[] | null,
): Promise<PurchaseListItem[]> {
  const pending = await getUnsynced();
  return pending
    .filter(
      (r) =>
        r.type === 'purchase' &&
        r.company_id === companyId &&
        branchMatches(r.branch_id, branchId, accessibleBranchIds) &&
        needsSync(r) &&
        (r.payload as { action?: string }).action === 'create',
    )
    .map((r) => pendingPurchaseToListItem(r));
}

function needsSync(r: PendingRecord): boolean {
  const s = normalizeQueueStatus(r);
  return s === 'PENDING' || s === 'ERROR';
}

function pendingSaleToRow(r: PendingRecord): Record<string, unknown> {
  const p = r.payload as {
    customerName?: string;
    total?: number;
    paidAmount?: number;
    dueAmount?: number;
    invoiceDate?: string;
    isStudio?: boolean;
    userId?: string;
  };
  const invDate = p.invoiceDate || toLocalDateString(new Date(r.created_at));
  return {
    id: r.id,
    invoice_no: 'Pending',
    order_no: `OFF-${r.id.slice(0, 8)}`,
    customer_name: p.customerName || 'Walk-in',
    total: p.total ?? 0,
    total_amount: p.total ?? 0,
    paid_amount: p.paidAmount ?? 0,
    due_amount: p.dueAmount ?? (p.total ?? 0),
    status: 'pending_sync',
    payment_status: 'unpaid',
    invoice_date: invDate,
    created_at: toLocalISOString(new Date(r.created_at)),
    created_by: p.userId ?? null,
    is_studio: !!p.isStudio,
    _offlinePending: true,
  };
}

function pendingPurchaseToListItem(r: PendingRecord): PurchaseListItem {
  const p = r.payload as { input?: Record<string, unknown> };
  const input = p.input || {};
  const supplier = String(input.supplierName ?? input.supplier_name ?? '—');
  const total = Number(input.total ?? 0);
  const dateStr = toLocalDateString(String(input.poDate ?? input.po_date ?? new Date(r.created_at)));
  return {
    id: r.id,
    poNo: `OFF-${r.id.slice(0, 8)}`,
    vendor: supplier,
    vendorPhone: String(input.contactNumber ?? input.contact_number ?? '—'),
    total,
    subtotal: Number(input.subtotal ?? total),
    discount: Number(input.discountAmount ?? input.discount_amount ?? 0),
    paidAmount: 0,
    dueAmount: total,
    status: 'pending_sync',
    paymentStatus: 'unpaid',
    date: dateStr,
    dateDisplay: 'Pending sync',
    created_at: toLocalISOString(new Date(r.created_at)),
    itemCount: Array.isArray(input.items) ? input.items.length : 0,
    branchId: (input.branchId as string) ?? r.branch_id ?? null,
    created_by: (input.userId as string) ?? null,
  };
}

export function mergeSalesWithPending(
  serverRows: Record<string, unknown>[],
  pendingRows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const ids = new Set(serverRows.map((r) => String(r.id)));
  const extra = pendingRows.filter((r) => !ids.has(String(r.id)));
  return sortByDocumentDateTimeDesc([...extra, ...serverRows], (row) => ({
    documentDate: (row.invoice_date as string) || null,
    eventTimestamp: (row.created_at as string) || null,
  }));
}

export function mergePurchasesWithPending(
  server: PurchaseListItem[],
  pending: PurchaseListItem[],
): PurchaseListItem[] {
  const ids = new Set(server.map((r) => r.id));
  const merged = [...pending.filter((r) => !ids.has(r.id)), ...server];
  return sortByDocumentDateTimeDesc(merged, (row) => ({
    documentDate: row.date,
    eventTimestamp: row.created_at ?? null,
  }));
}
