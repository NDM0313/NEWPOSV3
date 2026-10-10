/**
 * Manual supplier payment FIFO allocation — mirrors web paymentAllocationService
 * (buildManualSupplierAllocationPlan + insertPurchasePaymentAllocationsFromPlan).
 */
import { supabase, isSupabaseConfigured } from './supabase';

export type PurchaseAllocationPlanRow = {
  purchaseId: string;
  amount: number;
  poNo?: string;
  allocationOrder: number;
};

export type OpenPurchaseForFifo = {
  id: string;
  po_no: string | null;
  due_amount: number;
  po_date?: string | null;
};

/** Posted purchases with due > 0, FIFO: po_date ASC, po_no ASC, id ASC. */
export async function fetchOpenPurchasesForFifo(
  companyId: string,
  supplierId: string,
): Promise<OpenPurchaseForFifo[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('purchases')
    .select('id, po_no, due_amount, po_date')
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId)
    .in('status', ['final', 'received'])
    .gt('due_amount', 0.009)
    .is('cancelled_at', null)
    .order('po_date', { ascending: true })
    .order('po_no', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as OpenPurchaseForFifo[];
}

export function computeFifoPurchaseAllocationPlan(
  paymentAmount: number,
  openPurchases: OpenPurchaseForFifo[],
): PurchaseAllocationPlanRow[] {
  const eps = 0.02;
  let remaining = Number(paymentAmount) || 0;
  if (remaining <= eps) return [];

  const sorted = [...openPurchases].sort((a, b) => {
    const da = String(a.po_date ?? '');
    const db = String(b.po_date ?? '');
    if (da !== db) return da.localeCompare(db);
    const na = String(a.po_no ?? '');
    const nb = String(b.po_no ?? '');
    if (na !== nb) return na.localeCompare(nb);
    return String(a.id).localeCompare(String(b.id));
  });

  const out: PurchaseAllocationPlanRow[] = [];
  let order = 1;
  for (const row of sorted) {
    if (remaining <= eps) break;
    const due = Math.max(0, Number(row.due_amount) || 0);
    if (due <= eps) continue;
    const take = Math.min(due, remaining);
    if (take <= eps) continue;
    out.push({
      purchaseId: row.id,
      amount: Math.round(take * 100) / 100,
      poNo: row.po_no || undefined,
      allocationOrder: order++,
    });
    remaining -= take;
  }
  return out;
}

export async function buildManualSupplierAllocationPlan(
  companyId: string,
  supplierId: string,
  paymentAmount: number,
): Promise<PurchaseAllocationPlanRow[]> {
  const open = await fetchOpenPurchasesForFifo(companyId, supplierId);
  return computeFifoPurchaseAllocationPlan(paymentAmount, open);
}

export async function insertPurchasePaymentAllocationsFromPlan(params: {
  companyId: string;
  branchId: string | null;
  paymentId: string;
  paymentDate: string;
  plan: PurchaseAllocationPlanRow[];
  createdBy: string | null;
}): Promise<void> {
  const { companyId, branchId, paymentId, paymentDate, plan, createdBy } = params;
  if (!plan.length) return;
  const day = String(paymentDate).slice(0, 10);
  const rows = plan.map((a) => ({
    company_id: companyId,
    branch_id: branchId,
    payment_id: paymentId,
    sale_id: null as string | null,
    purchase_id: a.purchaseId,
    allocated_amount: Number(a.amount),
    allocation_date: day,
    allocation_order: a.allocationOrder,
    created_by: createdBy,
  }));
  let { error } = await supabase.from('payment_allocations').insert(rows);
  if (
    error &&
    (String(error.message || '').includes('allocation_order') ||
      String(error.message || '').includes('schema cache'))
  ) {
    const legacy = plan.map((a) => ({
      company_id: companyId,
      branch_id: branchId,
      payment_id: paymentId,
      sale_id: null,
      purchase_id: a.purchaseId,
      allocated_amount: Number(a.amount),
      allocation_date: day,
      created_by: createdBy,
    }));
    const r2 = await supabase.from('payment_allocations').insert(legacy);
    error = r2.error;
  }
  if (error) throw new Error(error.message);
}

export async function applyManualSupplierPaymentAllocations(params: {
  companyId: string;
  branchId: string | null;
  paymentId: string;
  supplierId: string;
  amount: number;
  paymentDate: string;
  createdBy: string | null;
}): Promise<{ allocatedTotal: number; unapplied: number }> {
  const plan = await buildManualSupplierAllocationPlan(
    params.companyId,
    params.supplierId,
    params.amount,
  );
  const allocatedTotal = plan.reduce((s, r) => s + r.amount, 0);
  const unapplied = Math.max(0, Math.round((params.amount - allocatedTotal) * 100) / 100);
  if (plan.length > 0) {
    await insertPurchasePaymentAllocationsFromPlan({
      companyId: params.companyId,
      branchId: params.branchId,
      paymentId: params.paymentId,
      paymentDate: params.paymentDate,
      plan,
      createdBy: params.createdBy,
    });
  }
  return { allocatedTotal, unapplied };
}

/** Sort suppliers: positive payable first (desc), then name asc. */
export function sortSuppliersByPayable<T extends { name: string; totalPayable: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const aDue = a.totalPayable > 0.01 ? 1 : 0;
    const bDue = b.totalPayable > 0.01 ? 1 : 0;
    if (aDue !== bDue) return bDue - aDue;
    if (aDue && bDue && a.totalPayable !== b.totalPayable) {
      return b.totalPayable - a.totalPayable;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}
