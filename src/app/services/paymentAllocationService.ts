/**
 * Manual customer receipt → invoice allocations (FIFO by default).
 * One payments row per receipt; payment_allocations are child rows only.
 */

import { supabase } from '@/lib/supabase';

const TRACE = '[RECEIPT_AUTO_ALLOCATION_TRACE]';

export type ManualReceiptAllocationInput = { saleId: string; amount: number; invoiceNo?: string };

export type AllocationPlanRow = {
  saleId: string;
  amount: number;
  invoiceNo?: string;
  allocationOrder: number;
};

export type OpenInvoiceForFifo = {
  id: string;
  invoice_no: string | null;
  due_amount: number;
  invoice_date?: string | null;
};

/** Final invoices with due > 0, FIFO order: invoice_date ASC, invoice_no ASC, id ASC. */
export async function fetchOpenInvoicesForFifo(companyId: string, customerId: string): Promise<OpenInvoiceForFifo[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('id, invoice_no, due_amount, invoice_date')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('status', 'final')
    .gt('due_amount', 0.009)
    .order('invoice_date', { ascending: true })
    .order('invoice_no', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as OpenInvoiceForFifo[];
}

/**
 * Oldest due first; tie-break by invoice_no then id. Consumes receiptAmount until exhausted.
 */
export function computeFifoAllocationPlan(receiptAmount: number, openInvoices: OpenInvoiceForFifo[]): AllocationPlanRow[] {
  const eps = 0.02;
  let remaining = Number(receiptAmount) || 0;
  if (remaining <= eps) return [];

  const sorted = [...openInvoices].sort((a, b) => {
    const da = String(a.invoice_date ?? '');
    const db = String(b.invoice_date ?? '');
    if (da !== db) return da.localeCompare(db);
    const na = String(a.invoice_no ?? '');
    const nb = String(b.invoice_no ?? '');
    if (na !== nb) return na.localeCompare(nb);
    return String(a.id).localeCompare(String(b.id));
  });

  const out: AllocationPlanRow[] = [];
  let order = 1;
  for (const inv of sorted) {
    if (remaining <= eps) break;
    const due = Math.max(0, Number(inv.due_amount) || 0);
    if (due <= eps) continue;
    const take = Math.min(due, remaining);
    if (take <= eps) continue;
    out.push({
      saleId: inv.id,
      amount: Math.round(take * 100) / 100,
      invoiceNo: inv.invoice_no || undefined,
      allocationOrder: order++,
    });
    remaining -= take;
  }
  return out;
}

export async function deletePaymentAllocationsByPaymentId(paymentId: string): Promise<void> {
  const { error } = await supabase.from('payment_allocations').delete().eq('payment_id', paymentId);
  if (error) throw new Error(error.message);
}

export async function insertPaymentAllocationsFromPlan(params: {
  companyId: string;
  branchId: string | null;
  paymentId: string;
  paymentDate: string;
  plan: AllocationPlanRow[];
  createdBy: string | null;
}): Promise<void> {
  const { companyId, branchId, paymentId, paymentDate, plan, createdBy } = params;
  if (!plan.length) return;
  const day = String(paymentDate).slice(0, 10);
  const rows = plan.map((a) => ({
    company_id: companyId,
    branch_id: branchId,
    payment_id: paymentId,
    sale_id: a.saleId,
    allocated_amount: Number(a.amount),
    allocation_date: day,
    allocation_order: a.allocationOrder,
    created_by: createdBy,
  }));
  let { error } = await supabase.from('payment_allocations').insert(rows);
  if (error && (String(error.message || '').includes('allocation_order') || String(error.message || '').includes('schema cache'))) {
    const legacy = plan.map((a) => ({
      company_id: companyId,
      branch_id: branchId,
      payment_id: paymentId,
      sale_id: a.saleId,
      allocated_amount: Number(a.amount),
      allocation_date: day,
      created_by: createdBy,
    }));
    const r2 = await supabase.from('payment_allocations').insert(legacy);
    error = r2.error;
  }
  if (error) throw new Error(error.message);
}

function logTrace(payload: Record<string, unknown>) {
  console.log(TRACE, JSON.stringify(payload));
}

async function validateExplicitAllocations(
  companyId: string,
  customerId: string,
  receiptAmount: number,
  explicit: ManualReceiptAllocationInput[]
): Promise<AllocationPlanRow[]> {
  let sum = 0;
  for (const row of explicit) {
    const a = Number(row.amount) || 0;
    if (a <= 0) throw new Error('Each invoice allocation must be a positive amount');
    sum += a;
  }
  if (sum > receiptAmount + 0.02) throw new Error('Allocated total cannot exceed receipt amount');

  const saleIds = [...new Set(explicit.map((x) => x.saleId))];
  const { data: saleRows, error: saleErr } = await supabase
    .from('sales')
    .select('id, due_amount, status, customer_id, invoice_no')
    .in('id', saleIds)
    .eq('company_id', companyId);
  if (saleErr) throw new Error(saleErr.message);
  if (!saleRows || saleRows.length !== saleIds.length) throw new Error('One or more invoices were not found');

  for (const s of saleRows as any[]) {
    if (String(s.status) !== 'final') throw new Error('Allocations only apply to final invoices');
    if (String(s.customer_id) !== String(customerId)) throw new Error('Invoice does not belong to the selected customer');
  }

  let order = 1;
  const plan: AllocationPlanRow[] = [];
  for (const row of explicit) {
    const s = (saleRows as any[]).find((x) => x.id === row.saleId);
    if (!s) throw new Error('Invoice not found');
    const due = Number(s.due_amount) || 0;
    const a = Number(row.amount) || 0;
    if (a > due + 0.02) throw new Error(`Allocation for ${s.invoice_no || row.saleId} exceeds open due (${due})`);
    plan.push({
      saleId: row.saleId,
      amount: a,
      invoiceNo: row.invoiceNo || s.invoice_no || undefined,
      allocationOrder: order++,
    });
  }
  return plan;
}

/**
 * Build plan: explicit list if provided and non-empty; otherwise FIFO from open invoices.
 */
export async function buildManualReceiptAllocationPlan(
  companyId: string,
  customerId: string,
  receiptAmount: number,
  explicitAllocations?: ManualReceiptAllocationInput[] | null
): Promise<AllocationPlanRow[]> {
  if (explicitAllocations && explicitAllocations.length > 0) {
    return validateExplicitAllocations(companyId, customerId, receiptAmount, explicitAllocations);
  }
  const open = await fetchOpenInvoicesForFifo(companyId, customerId);
  return computeFifoAllocationPlan(receiptAmount, open);
}

/**
 * Persist allocations + trace + optional activity (caller can pass logActivity callbacks or we import activityLogService).
 */
export async function applyManualReceiptAllocations(params: {
  companyId: string;
  branchId: string | null;
  paymentId: string;
  customerId: string;
  amount: number;
  paymentDate: string;
  referenceNumber: string;
  createdBy: string | null;
  explicitAllocations?: ManualReceiptAllocationInput[] | null;
  skipActivityLog?: boolean;
}): Promise<{ plan: AllocationPlanRow[]; allocatedTotal: number; unapplied: number }> {
  const {
    companyId,
    branchId,
    paymentId,
    customerId,
    amount,
    paymentDate,
    referenceNumber,
    createdBy,
    explicitAllocations,
    skipActivityLog,
  } = params;

  const plan = await buildManualReceiptAllocationPlan(companyId, customerId, amount, explicitAllocations);
  const allocatedTotal = plan.reduce((s, r) => s + r.amount, 0);
  const unapplied = Math.max(0, Math.round((amount - allocatedTotal) * 100) / 100);

  let openInvoices: OpenInvoiceForFifo[] = [];
  try {
    openInvoices = await fetchOpenInvoicesForFifo(companyId, customerId);
  } catch {
    openInvoices = [];
  }

  logTrace({
    phase: 'apply',
    payment_id: paymentId,
    customer_id: customerId,
    receipt_total: amount,
    reference_number: referenceNumber,
    mode: explicitAllocations?.length ? 'explicit' : 'fifo_auto',
    open_invoices_count: openInvoices.length,
    open_invoice_ids: openInvoices.map((i) => i.id),
    allocation_plan: plan.map((p) => ({
      sale_id: p.saleId,
      invoice_no: p.invoiceNo,
      order: p.allocationOrder,
      amount: p.amount,
    })),
    allocated_total: allocatedTotal,
    unapplied,
  });

  if (plan.length > 0) {
    await insertPaymentAllocationsFromPlan({
      companyId,
      branchId,
      paymentId,
      paymentDate,
      plan,
      createdBy,
    });
  }

  if (!skipActivityLog) {
    const { activityLogService } = await import('@/app/services/activityLogService');
    for (const row of plan) {
      const inv = row.invoiceNo || row.saleId;
      activityLogService
        .logActivity({
          companyId,
          module: 'sale',
          entityId: row.saleId,
          entityReference: inv,
          action: 'manual_receipt_allocated',
          amount: row.amount,
          performedBy: createdBy ?? undefined,
          description: `Receipt ${referenceNumber} allocated ${row.amount.toLocaleString()} to invoice ${inv} (order ${row.allocationOrder})`,
        })
        .catch(() => {});
    }
    if (unapplied > 0.01) {
      activityLogService
        .logActivity({
          companyId,
          module: 'payment',
          entityId: paymentId,
          entityReference: referenceNumber,
          action: 'manual_receipt_unapplied_credit',
          amount: unapplied,
          performedBy: createdBy ?? undefined,
          description: `Receipt ${referenceNumber}: ${unapplied.toLocaleString()} remains unapplied customer credit`,
        })
        .catch(() => {});
    }
  }

  return { plan, allocatedTotal, unapplied };
}

/**
 * After amount/customer change: remove rows and re-run FIFO (or explicit if passed).
 */
export async function rebuildManualReceiptFifoAllocations(params: {
  paymentId: string;
  explicitAllocations?: ManualReceiptAllocationInput[] | null;
}): Promise<void> {
  const { paymentId, explicitAllocations } = params;
  const { data: p, error } = await supabase
    .from('payments')
    .select('id, company_id, branch_id, reference_type, voided_at, contact_id, amount, payment_date, reference_number')
    .eq('id', paymentId)
    .maybeSingle();

  if (error || !p) {
    logTrace({ phase: 'rebuild_skip', payment_id: paymentId, reason: 'payment_not_found' });
    return;
  }
  const row = p as any;
  if (String(row.reference_type) !== 'manual_receipt' || row.voided_at) {
    logTrace({ phase: 'rebuild_skip', payment_id: paymentId, reason: 'not_manual_receipt_or_voided' });
    return;
  }
  const customerId = row.contact_id as string | null;
  if (!customerId) {
    logTrace({ phase: 'rebuild_skip', payment_id: paymentId, reason: 'no_contact_id' });
    return;
  }

  logTrace({ phase: 'rebuild_delete_allocations', payment_id: paymentId });
  await deletePaymentAllocationsByPaymentId(paymentId);

  const amount = Number(row.amount) || 0;
  if (amount <= 0.01) {
    logTrace({ phase: 'rebuild_done', payment_id: paymentId, note: 'zero_amount_no_allocations' });
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const uid = (user as any)?.id ?? null;

  await applyManualReceiptAllocations({
    companyId: row.company_id,
    branchId: row.branch_id ?? null,
    paymentId,
    customerId,
    amount,
    paymentDate: String(row.payment_date || new Date().toISOString().slice(0, 10)),
    referenceNumber: String(row.reference_number || ''),
    createdBy: uid,
    explicitAllocations: explicitAllocations ?? null,
    skipActivityLog: true,
  });

  logTrace({
    phase: 'rebuild_complete',
    payment_id: paymentId,
    customer_id: customerId,
    amount,
  });
}

export type ManualReceiptAllocationSummary = {
  receiptTotal: number;
  allocatedTotal: number;
  unapplied: number;
  lines: { saleId: string; invoiceNo: string | null; amount: number; allocationOrder: number }[];
};

export async function getManualReceiptAllocationSummary(paymentId: string): Promise<ManualReceiptAllocationSummary | null> {
  const { data: p, error: pe } = await supabase
    .from('payments')
    .select('id, amount, reference_type')
    .eq('id', paymentId)
    .maybeSingle();
  if (pe || !p || String((p as any).reference_type) !== 'manual_receipt') return null;

  const { data: rows, error: ae } = await supabase
    .from('payment_allocations')
    .select('sale_id, allocated_amount, allocation_order')
    .eq('payment_id', paymentId)
    .order('allocation_order', { ascending: true });

  if (ae) return null;

  const receiptTotal = Number((p as any).amount) || 0;
  const saleIds = [...new Set((rows || []).map((r: any) => r.sale_id).filter(Boolean))];
  let invById = new Map<string, string | null>();
  if (saleIds.length > 0) {
    const { data: sales } = await supabase.from('sales').select('id, invoice_no').in('id', saleIds);
    invById = new Map((sales || []).map((s: any) => [s.id, s.invoice_no ?? null]));
  }
  const lines = (rows || []).map((r: any) => ({
    saleId: r.sale_id,
    invoiceNo: invById.get(r.sale_id) ?? null,
    amount: Number(r.allocated_amount) || 0,
    allocationOrder: Number(r.allocation_order) || 0,
  }));
  const allocatedTotal = lines.reduce((s, l) => s + l.amount, 0);
  const unapplied = Math.max(0, Math.round((receiptTotal - allocatedTotal) * 100) / 100);

  return { receiptTotal, allocatedTotal, unapplied, lines };
}

// ─── Supplier / AP: manual_payment → purchase bills (FIFO), mirrors manual_receipt → sales ───

const SUP_TRACE = '[SUPPLIER_PAYMENT_AUTO_ALLOC_TRACE]';

export type ManualSupplierAllocationInput = { purchaseId: string; amount: number; poNo?: string };

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
export async function fetchOpenPurchasesForFifo(companyId: string, supplierId: string): Promise<OpenPurchaseForFifo[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select('id, po_no, due_amount, po_date')
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId)
    .in('status', ['final', 'received'])
    .gt('due_amount', 0.009)
    .order('po_date', { ascending: true })
    .order('po_no', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as OpenPurchaseForFifo[];
}

export function computeFifoPurchaseAllocationPlan(paymentAmount: number, openPurchases: OpenPurchaseForFifo[]): PurchaseAllocationPlanRow[] {
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

function logSupplierTrace(payload: Record<string, unknown>) {
  console.log(SUP_TRACE, JSON.stringify(payload));
}

async function validateExplicitSupplierAllocations(
  companyId: string,
  supplierId: string,
  paymentAmount: number,
  explicit: ManualSupplierAllocationInput[]
): Promise<PurchaseAllocationPlanRow[]> {
  let sum = 0;
  for (const row of explicit) {
    const a = Number(row.amount) || 0;
    if (a <= 0) throw new Error('Each bill allocation must be a positive amount');
    sum += a;
  }
  if (sum > paymentAmount + 0.02) throw new Error('Allocated total cannot exceed payment amount');

  const purchaseIds = [...new Set(explicit.map((x) => x.purchaseId))];
  const { data: purchaseRows, error: pErr } = await supabase
    .from('purchases')
    .select('id, due_amount, status, supplier_id, po_no')
    .in('id', purchaseIds)
    .eq('company_id', companyId);
  if (pErr) throw new Error(pErr.message);
  if (!purchaseRows || purchaseRows.length !== purchaseIds.length) throw new Error('One or more purchase bills were not found');

  for (const pr of purchaseRows as any[]) {
    const st = String(pr.status || '').toLowerCase();
    if (st !== 'final' && st !== 'received') throw new Error('Allocations only apply to posted purchase bills');
    if (String(pr.supplier_id) !== String(supplierId)) throw new Error('Bill does not belong to the selected supplier');
  }

  let order = 1;
  const plan: PurchaseAllocationPlanRow[] = [];
  for (const row of explicit) {
    const pr = (purchaseRows as any[]).find((x) => x.id === row.purchaseId);
    if (!pr) throw new Error('Purchase not found');
    const due = Number(pr.due_amount) || 0;
    const a = Number(row.amount) || 0;
    if (a > due + 0.02) throw new Error(`Allocation for ${pr.po_no || row.purchaseId} exceeds open due (${due})`);
    plan.push({
      purchaseId: row.purchaseId,
      amount: a,
      poNo: row.poNo || pr.po_no || undefined,
      allocationOrder: order++,
    });
  }
  return plan;
}

export async function buildManualSupplierAllocationPlan(
  companyId: string,
  supplierId: string,
  paymentAmount: number,
  explicitAllocations?: ManualSupplierAllocationInput[] | null
): Promise<PurchaseAllocationPlanRow[]> {
  if (explicitAllocations && explicitAllocations.length > 0) {
    return validateExplicitSupplierAllocations(companyId, supplierId, paymentAmount, explicitAllocations);
  }
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
  if (error && (String(error.message || '').includes('allocation_order') || String(error.message || '').includes('schema cache'))) {
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
  referenceNumber: string;
  createdBy: string | null;
  explicitAllocations?: ManualSupplierAllocationInput[] | null;
  skipActivityLog?: boolean;
}): Promise<{ plan: PurchaseAllocationPlanRow[]; allocatedTotal: number; unapplied: number }> {
  const {
    companyId,
    branchId,
    paymentId,
    supplierId,
    amount,
    paymentDate,
    referenceNumber,
    createdBy,
    explicitAllocations,
    skipActivityLog,
  } = params;

  const plan = await buildManualSupplierAllocationPlan(companyId, supplierId, amount, explicitAllocations);
  const allocatedTotal = plan.reduce((s, r) => s + r.amount, 0);
  const unapplied = Math.max(0, Math.round((amount - allocatedTotal) * 100) / 100);

  let openBills: OpenPurchaseForFifo[] = [];
  try {
    openBills = await fetchOpenPurchasesForFifo(companyId, supplierId);
  } catch {
    openBills = [];
  }

  logSupplierTrace({
    phase: 'apply',
    payment_id: paymentId,
    supplier_id: supplierId,
    payment_total: amount,
    reference_number: referenceNumber,
    mode: explicitAllocations?.length ? 'explicit' : 'fifo_auto',
    open_bills_count: openBills.length,
    open_purchase_ids: openBills.map((i) => i.id),
    allocation_plan: plan.map((p) => ({
      purchase_id: p.purchaseId,
      po_no: p.poNo,
      order: p.allocationOrder,
      amount: p.amount,
    })),
    allocated_total: allocatedTotal,
    unapplied,
  });

  if (plan.length > 0) {
    await insertPurchasePaymentAllocationsFromPlan({
      companyId,
      branchId,
      paymentId,
      paymentDate,
      plan,
      createdBy,
    });
  }

  if (!skipActivityLog) {
    const { activityLogService } = await import('@/app/services/activityLogService');
    for (const row of plan) {
      const ref = row.poNo || row.purchaseId;
      activityLogService
        .logActivity({
          companyId,
          module: 'purchase',
          entityId: row.purchaseId,
          entityReference: ref,
          action: 'manual_payment_allocated',
          amount: row.amount,
          performedBy: createdBy ?? undefined,
          description: `Payment ${referenceNumber} allocated ${row.amount.toLocaleString()} to bill ${ref} (order ${row.allocationOrder})`,
        })
        .catch(() => {});
    }
    if (unapplied > 0.01) {
      activityLogService
        .logActivity({
          companyId,
          module: 'payment',
          entityId: paymentId,
          entityReference: referenceNumber,
          action: 'manual_payment_unapplied_advance',
          amount: unapplied,
          performedBy: createdBy ?? undefined,
          description: `Supplier payment ${referenceNumber}: ${unapplied.toLocaleString()} remains unapplied supplier advance`,
        })
        .catch(() => {});
    }
  }

  return { plan, allocatedTotal, unapplied };
}

export async function rebuildManualSupplierFifoAllocations(params: {
  paymentId: string;
  explicitAllocations?: ManualSupplierAllocationInput[] | null;
}): Promise<void> {
  const { paymentId, explicitAllocations } = params;
  const { data: p, error } = await supabase
    .from('payments')
    .select('id, company_id, branch_id, reference_type, voided_at, contact_id, amount, payment_date, reference_number')
    .eq('id', paymentId)
    .maybeSingle();

  if (error || !p) {
    logSupplierTrace({ phase: 'rebuild_skip', payment_id: paymentId, reason: 'payment_not_found' });
    return;
  }
  const row = p as any;
  if (String(row.reference_type) !== 'manual_payment' || row.voided_at) {
    logSupplierTrace({ phase: 'rebuild_skip', payment_id: paymentId, reason: 'not_manual_payment_or_voided' });
    return;
  }
  const supplierId = row.contact_id as string | null;
  if (!supplierId) {
    logSupplierTrace({ phase: 'rebuild_skip', payment_id: paymentId, reason: 'no_contact_id' });
    return;
  }

  logSupplierTrace({ phase: 'rebuild_delete_allocations', payment_id: paymentId });
  await deletePaymentAllocationsByPaymentId(paymentId);

  const amt = Number(row.amount) || 0;
  if (amt <= 0.01) {
    logSupplierTrace({ phase: 'rebuild_done', payment_id: paymentId, note: 'zero_amount_no_allocations' });
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const uid = (user as any)?.id ?? null;

  await applyManualSupplierPaymentAllocations({
    companyId: row.company_id,
    branchId: row.branch_id ?? null,
    paymentId,
    supplierId,
    amount: amt,
    paymentDate: String(row.payment_date || new Date().toISOString().slice(0, 10)),
    referenceNumber: String(row.reference_number || ''),
    createdBy: uid,
    explicitAllocations: explicitAllocations ?? null,
    skipActivityLog: true,
  });

  logSupplierTrace({
    phase: 'rebuild_complete',
    payment_id: paymentId,
    supplier_id: supplierId,
    amount: amt,
  });
}

export type ManualSupplierAllocationSummary = {
  paymentTotal: number;
  allocatedTotal: number;
  unapplied: number;
  lines: { purchaseId: string; poNo: string | null; amount: number; allocationOrder: number }[];
};

export async function getManualSupplierAllocationSummary(paymentId: string): Promise<ManualSupplierAllocationSummary | null> {
  const { data: p, error: pe } = await supabase
    .from('payments')
    .select('id, amount, reference_type')
    .eq('id', paymentId)
    .maybeSingle();
  if (pe || !p || String((p as any).reference_type) !== 'manual_payment') return null;

  const { data: rows, error: ae } = await supabase
    .from('payment_allocations')
    .select('purchase_id, allocated_amount, allocation_order')
    .eq('payment_id', paymentId)
    .not('purchase_id', 'is', null)
    .order('allocation_order', { ascending: true });

  if (ae) return null;

  const paymentTotal = Number((p as any).amount) || 0;
  const purchaseIds = [...new Set((rows || []).map((r: any) => r.purchase_id).filter(Boolean))];
  let poById = new Map<string, string | null>();
  if (purchaseIds.length > 0) {
    const { data: purs } = await supabase.from('purchases').select('id, po_no').in('id', purchaseIds);
    poById = new Map((purs || []).map((x: any) => [x.id, x.po_no ?? null]));
  }
  const lines = (rows || []).map((r: any) => ({
    purchaseId: r.purchase_id,
    poNo: poById.get(r.purchase_id) ?? null,
    amount: Number(r.allocated_amount) || 0,
    allocationOrder: Number(r.allocation_order) || 0,
  }));
  const allocatedTotal = lines.reduce((s, l) => s + l.amount, 0);
  const unapplied = Math.max(0, Math.round((paymentTotal - allocatedTotal) * 100) / 100);

  return { paymentTotal, allocatedTotal, unapplied, lines };
}
