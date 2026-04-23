import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getNextDocumentNumber } from './documentNumber';

export interface CreateSaleInput {
  companyId: string;
  branchId: string;
  customerId: string | null;
  customerName: string;
  contactNumber?: string;
  items: {
    productId: string;
    variationId?: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    taxAmount?: number;
    total: number;
    /** Packing: { total_boxes, total_pieces } for sale_items.packing_details + stock_movements */
    packingDetails?: { total_boxes?: number; total_pieces?: number };
  }[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  expenses: number;
  total: number;
  paymentMethod: string;
  /** For split payment: paid = cash + bank, due = credit */
  paidAmount?: number;
  dueAmount?: number;
  /** Account ID for payment (required when paidAmount > 0, for accounting) */
  paymentAccountId?: string | null;
  notes?: string;
  isStudio: boolean;
  userId: string;
  /** Studio: order date (YYYY-MM-DD) */
  orderDate?: string;
  /** Studio: deadline (YYYY-MM-DD) */
  deadline?: string;
}

/** When branchId is 'default' (no branches), use first branch for RPC. No auto-create (POST branches can 403). */
async function resolveBranchId(companyId: string, branchId: string): Promise<string> {
  if (branchId && branchId !== 'default') return branchId;
  const { data } = await supabase.from('branches').select('id').eq('company_id', companyId).limit(1).maybeSingle();
  const first = data?.id ?? null;
  if (!first) throw new Error('No branch set up. Add a branch on the Branch screen or in Settings to create sales.');
  return first;
}

/**
 * Get next invoice number from server – ATOMIC, same engine as Web (Settings → Numbering Rules).
 * Uses generate_document_number via getNextDocumentNumber. Studio → STD-xxx, regular → SL-xxx.
 * When branchId is 'default', uses first branch of company (RPC requires UUID).
 */
async function getNextInvoiceNumber(companyId: string, branchId: string, isStudio: boolean): Promise<string> {
  const effectiveBranchId = await resolveBranchId(companyId, branchId);
  return getNextDocumentNumber(companyId, effectiveBranchId, isStudio ? 'studio' : 'sale');
}

export async function createSale(input: CreateSaleInput): Promise<{ data: { id: string; invoiceNo: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'App not configured.' };
  }

  const { companyId, branchId, customerId, customerName, contactNumber, items, subtotal, discountAmount, taxAmount, expenses, total, paymentMethod, notes, isStudio, userId, paidAmount, dueAmount, paymentAccountId, orderDate: _orderDate, deadline } = input;

  if (!companyId || !branchId || !userId) {
    return { data: null, error: 'Missing company, branch, or user.' };
  }
  if (!items.length) {
    return { data: null, error: 'No items in sale.' };
  }

  let effectiveBranchId: string;
  try {
    effectiveBranchId = await resolveBranchId(companyId, branchId);
  } catch (err) {
    return { data: null, error: (err as Error).message ?? 'Failed to resolve branch.' };
  }

  let invoiceNo: string;
  try {
    invoiceNo = await getNextInvoiceNumber(companyId, effectiveBranchId, !!isStudio);
  } catch (err) {
    return { data: null, error: (err as Error).message ?? 'Failed to get invoice number' };
  }

  const totalNum = Number(total) || 0;
  const isCredit = String(paymentMethod || '').toLowerCase() === 'credit';
  const isSplit = paidAmount != null && dueAmount != null;
  const paid = isSplit ? Number(paidAmount) : (isCredit ? 0 : totalNum);
  const due = isSplit ? Number(dueAmount) : (isCredit ? totalNum : 0);
  const isDuplicateInvoiceError = (err: { code?: string; message?: string } | null) =>
    err?.code === '23505' || (err?.message != null && String(err.message).includes('sales_company_branch_invoice_unique'));

  const saleRowBase = {
    company_id: companyId,
    branch_id: effectiveBranchId,
    invoice_date: new Date().toISOString(),
    customer_id: customerId || null,
    customer_name: customerName || 'Walk-in',
    contact_number: contactNumber || null,
    type: 'invoice' as const,
    status: 'final' as const,
    payment_status: due > 0 ? (paid > 0 ? 'partial' : 'unpaid') : 'paid',
    payment_method: paymentMethod || 'Cash',
    subtotal: Number(subtotal) || 0,
    discount_amount: Number(discountAmount) || 0,
    tax_amount: Number(taxAmount) || 0,
    expenses: Number(expenses) || 0,
    total: totalNum,
    paid_amount: paid,
    due_amount: due,
    created_by: userId,
    is_studio: !!isStudio,
    notes: notes || null,
    ...(deadline != null && deadline !== '' && { deadline: deadline }),
  };

  let saleRow: Record<string, unknown> = { ...saleRowBase, invoice_no: invoiceNo };
  let saleData: { id: string } | null = null;
  let saleError: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await supabase.from('sales').insert(saleRow).select('id').single();
    saleData = result.data as { id: string } | null;
    saleError = result.error;
    if (!saleError) break;
    if (attempt === 0 && isDuplicateInvoiceError(saleError)) {
      try {
        invoiceNo = await getNextInvoiceNumber(companyId, effectiveBranchId, !!isStudio);
        saleRow = { ...saleRowBase, invoice_no: invoiceNo };
      } catch {
        break;
      }
    } else {
      break;
    }
  }

  if (saleError || !saleData) {
    return { data: null, error: saleError?.message ?? 'Failed to create sale.' };
  }

  const saleId = saleData.id;
  const itemsWithSaleId = items.map((item) => {
    const row: Record<string, unknown> = {
      sale_id: saleId,
      product_id: item.productId,
      variation_id: item.variationId || null,
      product_name: item.productName,
      sku: item.sku || '—',
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_amount: item.discountAmount ?? 0,
      tax_amount: item.taxAmount ?? 0,
      total: item.total,
    };
    if (item.packingDetails && (item.packingDetails.total_boxes != null || item.packingDetails.total_pieces != null)) {
      row.packing_details = item.packingDetails;
    }
    return row;
  });

  let itemsError: { message: string } | null = null;
  const { error: salesItemsErr } = await supabase.from('sales_items').insert(itemsWithSaleId);
  if (salesItemsErr) {
    if (salesItemsErr.code === '42P01' || String(salesItemsErr.message).includes('does not exist')) {
      const { error: fallbackErr } = await supabase.from('sale_items').insert(itemsWithSaleId);
      itemsError = fallbackErr;
    } else {
      itemsError = salesItemsErr;
    }
  }

  if (itemsError) {
    await supabase.from('sales').delete().eq('id', saleId);
    return { data: null, error: `Failed to save items: ${itemsError.message}` };
  }

  // Packing: inventory decrement via stock_movements (sale = stock OUT)
  const movementRows = items
    .filter((item) => item.productId && item.quantity > 0)
    .map((item) => {
      const packing = item.packingDetails;
      const boxOut = packing?.total_boxes != null ? Math.round(Number(packing.total_boxes)) : 0;
      const pieceOut = packing?.total_pieces != null ? Math.round(Number(packing.total_pieces)) : 0;
      return {
        company_id: companyId,
        branch_id: effectiveBranchId,
        product_id: item.productId,
        variation_id: item.variationId || null,
        movement_type: 'sale' as const,
        quantity: -item.quantity,
        unit_cost: item.unitPrice || 0,
        total_cost: -((item.unitPrice || 0) * item.quantity),
        reference_type: 'sale' as const,
        reference_id: saleId,
        notes: `Sale ${invoiceNo} - ${item.productName}`,
        created_by: userId,
        ...(boxOut !== 0 && { box_change: -boxOut }),
        ...(pieceOut !== 0 && { piece_change: -pieceOut }),
      };
    });
  if (movementRows.length > 0) {
    const { error: movErr } = await supabase.from('stock_movements').insert(movementRows);
    if (movErr) {
      await supabase.from('sales').delete().eq('id', saleId);
      return { data: null, error: `Inventory update failed: ${movErr.message}` };
    }
  }

  // Create payment record when paid > 0 (for payment history). Let DB trigger set reference_number to avoid duplicate key.
  if (paid > 0) {
    const payMethod = (paymentMethod || 'Cash').toLowerCase();
    let enumMethod: 'cash' | 'bank' | 'card' | 'other' = 'cash';
    if (payMethod.includes('bank') || payMethod.includes('transfer')) enumMethod = 'bank';
    else if (payMethod.includes('credit') || payMethod.includes('card')) enumMethod = 'card';
    const { error: payErr } = await supabase.from('payments').insert({
      company_id: companyId,
      branch_id: effectiveBranchId,
      payment_type: 'received',
      reference_type: 'sale',
      reference_id: saleId,
      amount: paid,
      payment_method: enumMethod,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_account_id: paymentAccountId || null,
      created_by: userId,
    });
    if (payErr) console.warn('[SALES API] Payment record insert failed:', payErr);
  }

  // Create studio_production(s) for Studio Sales so they appear in Studio dashboard
  if (isStudio && items.length > 0) {
    const productionDate = new Date().toISOString().slice(0, 10);
    const productionRows = items.map((item, i) => {
      const productionNo = items.length === 1 ? invoiceNo : `${invoiceNo}-${i + 1}`;
      return {
        company_id: companyId,
        branch_id: effectiveBranchId,
        sale_id: saleId,
        production_no: productionNo,
        production_date: productionDate,
        product_id: item.productId,
        variation_id: item.variationId || null,
        quantity: item.quantity,
        status: 'draft' as const,
        created_by: userId,
      };
    });
    const { error: prodErr } = await supabase.from('studio_productions').insert(productionRows);
    if (prodErr) {
      console.warn('[SALES API] Studio production(s) insert failed (sale saved):', prodErr);
    }
  }

  // Accounting: post journal entry for the sale (Dr AR customer sub-account,
  // Cr Revenue/Tax/Discount, Dr COGS, Cr Inventory). Soft-warn on failure so
  // a transient accounting glitch does not destroy the sale document.
  try {
    const { data: postData, error: postErr } = await supabase.rpc(
      'record_sale_with_accounting',
      { p_sale_id: saleId },
    );
    if (postErr) {
      console.warn('[SALES API] record_sale_with_accounting failed:', postErr);
    } else if (postData && typeof postData === 'object' && (postData as { success?: boolean }).success === false) {
      console.warn('[SALES API] record_sale_with_accounting returned error:', postData);
    }
  } catch (err) {
    console.warn('[SALES API] record_sale_with_accounting threw:', err);
  }

  const insertedInvoiceNo = (saleRow.invoice_no as string) ?? invoiceNo;
  return {
    data: { id: saleId, invoiceNo: insertedInvoiceNo },
    error: null,
  };
}

/** Get all sales – matches web saleService.getAllSales (company + optional branch filter) */
export async function getAllSales(
  companyId: string,
  branchId?: string | null
): Promise<{ data: Array<Record<string, unknown>>; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  if (!companyId) return { data: [], error: 'Company ID required.' };

  let query = supabase
    .from('sales')
    .select(`
      *,
      customer:contacts(id, name, phone),
      branch:branches(id, name, code),
      items:sales_items(*, product:products(*), variation:product_variations(*))
    `)
    .eq('company_id', companyId)
    .order('invoice_date', { ascending: false });

  if (branchId && branchId !== 'all' && branchId !== 'default') {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === '42P01' || String(error.message || '').includes('sales_items')) {
      const retryQuery = supabase
        .from('sales')
        .select(`
          *,
          customer:contacts(id, name, phone),
          branch:branches(id, name, code),
          items:sale_items(*, product:products(*), variation:product_variations(*))
        `)
        .eq('company_id', companyId)
        .order('invoice_date', { ascending: false });
      const retry = branchId && branchId !== 'all' && branchId !== 'default' ? retryQuery.eq('branch_id', branchId) : retryQuery;
      const { data: retryData, error: retryError } = await retry;
      if (retryError) return { data: [], error: retryError.message };
      const retryList = retryData || [];
      const withStudioRetry = await enrichSalesWithStudioChargesBatch(retryList);
      const withPaymentsRetry = await enrichSalesWithPayments(companyId, withStudioRetry);
      const enrichedRetry = await enrichSalesWithShipping(withPaymentsRetry);
      return { data: enrichedRetry, error: null };
    }
    return { data: [], error: error.message };
  }

  const list = data || [];
  const withStudio = await enrichSalesWithStudioChargesBatch(list);
  const withPayments = await enrichSalesWithPayments(companyId, withStudio);
  const enriched = await enrichSalesWithShipping(withPayments);
  return { data: enriched, error: null };
}

/** Same as web saleService.getAllSales — studio worker cost from productions (RPC). */
async function enrichSalesWithStudioChargesBatch(
  sales: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  if (!sales.length) return sales;
  const saleIds = sales.map((s) => s.id as string).filter(Boolean);
  try {
    const { data: studioRows } = await supabase.rpc('get_sale_studio_charges_batch', {
      p_sale_ids: saleIds,
    });
    if (studioRows && Array.isArray(studioRows)) {
      const studioBySale = new Map<string, number>();
      (studioRows as { sale_id: string; studio_cost: number }[]).forEach((row: { sale_id?: string; studio_cost?: number }) => {
        const id = row.sale_id;
        if (id) studioBySale.set(String(id), Number(row.studio_cost) || 0);
      });
      return sales.map((s) => {
        const cost = studioBySale.get(String(s.id));
        if (cost != null && cost > 0) {
          return { ...s, studio_charges: cost };
        }
        return s;
      });
    }
  } catch {
    // RPC missing on older DBs — keep sales.studio_charges from row if any
  }
  return sales;
}

/**
 * Paid / balance same basis as web SalesPage + ViewSaleDetailsDrawer:
 * - Sum payments.reference_type=sale for this company (do not filter payment.branch_id — receipts often post without matching branch).
 * - Exclude voided payments.
 * - Add payment_allocations (manual receipt) where parent payment is not voided.
 */
async function enrichSalesWithPayments(
  companyId: string,
  sales: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  if (!sales.length) return sales;
  const saleIds = sales.map((s) => s.id as string).filter(Boolean);
  const { data: payData } = await supabase
    .from('payments')
    .select('reference_id, amount')
    .eq('reference_type', 'sale')
    .eq('company_id', companyId)
    .in('reference_id', saleIds)
    .is('voided_at', null);

  const bySale: Record<string, number> = {};
  for (const p of payData || []) {
    const refId = String((p as Record<string, unknown>).reference_id || '');
    if (refId) {
      bySale[refId] = (bySale[refId] || 0) + Number((p as Record<string, unknown>).amount ?? 0);
    }
  }

  try {
    const { data: allocs } = await supabase
      .from('payment_allocations')
      .select('sale_id, allocated_amount, payment_id')
      .in('sale_id', saleIds);
    const allocPayIds = [...new Set((allocs || []).map((a: { payment_id?: string }) => a.payment_id).filter(Boolean))] as string[];
    if (allocPayIds.length > 0) {
      const { data: parents } = await supabase.from('payments').select('id, voided_at').in('id', allocPayIds);
      const voidedParent = new Set(
        (parents || [])
          .filter((x: { voided_at?: string | null }) => x.voided_at != null && String(x.voided_at).length > 0)
          .map((x: { id: string }) => String(x.id))
      );
      for (const a of allocs || []) {
        const row = a as { sale_id?: string; payment_id?: string; allocated_amount?: number };
        const sid = String(row.sale_id || '');
        if (!sid || voidedParent.has(String(row.payment_id || ''))) continue;
        bySale[sid] = (bySale[sid] || 0) + (Number(row.allocated_amount) || 0);
      }
    }
  } catch {
    // payment_allocations may be missing
  }

  return sales.map((s) => {
    const id = String(s.id || '');
    const saleTotal = Number(s.total ?? 0);
    const studioCharges = Number(s.studio_charges ?? 0);
    const grandTotal = saleTotal + studioCharges;
    const totalReceived = bySale[id] || 0;
    const overpaid = totalReceived > grandTotal + 0.005;
    const balanceDue = overpaid ? 0 : Math.max(0, grandTotal - totalReceived);
    const creditBalance = overpaid ? Math.max(0, totalReceived - grandTotal) : 0;
    return {
      ...s,
      total_amount: saleTotal,
      studio_charges: studioCharges,
      grand_total: grandTotal,
      total_received: totalReceived,
      balance_due: balanceDue,
      credit_balance: creditBalance,
    };
  });
}

/** Attach first shipment status from sales_with_shipping view (avoids N+1). */
async function enrichSalesWithShipping(
  sales: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  if (!sales.length) return sales;
  const saleIds = sales.map((s) => s.id as string).filter(Boolean);
  try {
    const { data: rows } = await supabase
      .from('sales_with_shipping')
      .select('id, shipment_status, first_shipment_id')
      .in('id', saleIds);
    if (!rows?.length) return sales;
    const byId = new Map(rows.map((r: Record<string, unknown>) => [(r.id as string), r]));
    return sales.map((s) => {
      const row = byId.get(s.id as string);
      if (!row) return s;
      return {
        ...s,
        shipment_status: row.shipment_status,
        first_shipment_id: row.first_shipment_id,
      };
    });
  } catch {
    return sales;
  }
}

/** Get studio cost summary for a sale (production status, total studio cost, breakdown, workers). */
export async function getSaleStudioSummary(
  saleId: string
): Promise<{
  data: {
    has_studio: boolean;
    production_status: string;
    total_studio_cost: number;
    tasks_completed: number;
    tasks_total: number;
    production_duration_days: number | null;
    completed_at: string | null;
    breakdown: Array<{ task_type: string; cost: number; worker_id?: string; worker_name?: string; completed_at?: string | null }>;
    tasks_with_workers: Array<{
      task_type: string;
      cost: number;
      worker_id?: string;
      worker_name?: string;
      created_by?: string;
      completed_by?: string;
      completed_at?: string | null;
    }>;
  } | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !saleId) {
    return { data: null, error: 'Not configured or missing sale ID.' };
  }
  const { data, error } = await supabase.rpc('get_sale_studio_summary', {
    p_sale_id: saleId,
  });
  if (error) return { data: null, error: error.message };
  const raw = data as Record<string, unknown> | null;
  if (!raw) return { data: null, error: null };
  return {
    data: {
      has_studio: Boolean(raw.has_studio),
      production_status: String(raw.production_status ?? 'none'),
      total_studio_cost: Number(raw.total_studio_cost ?? 0),
      tasks_completed: Number(raw.tasks_completed ?? 0),
      tasks_total: Number(raw.tasks_total ?? 0),
      production_duration_days: raw.production_duration_days != null ? Number(raw.production_duration_days) : null,
      completed_at: raw.completed_at != null ? String(raw.completed_at) : null,
      breakdown: Array.isArray(raw.breakdown) ? (raw.breakdown as Array<{ task_type: string; cost: number; worker_id?: string; worker_name?: string; completed_at?: string | null }>) : [],
      tasks_with_workers: Array.isArray(raw.tasks_with_workers)
        ? (raw.tasks_with_workers as Array<{
            task_type: string;
            cost: number;
            worker_id?: string;
            worker_name?: string;
            created_by?: string;
            completed_by?: string;
            completed_at?: string | null;
          }>)
        : [],
    },
    error: null,
  };
}

/** Cancel a sale (reverses stock, updates status) */
export async function cancelSale(saleId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { data: saleRow } = await supabase.from('sales').select('id, invoice_no, branch_id, company_id').eq('id', saleId).single();
  if (!saleRow) return { error: 'Sale not found' };
  const s = saleRow as Record<string, unknown>;
  if (s.status === 'cancelled') return { error: 'Sale is already cancelled' };

  const { data: existing } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
    .eq('movement_type', 'SALE_CANCELLED')
    .limit(1);
  if (existing && existing.length > 0) {
    const { error } = await supabase.from('sales').update({ status: 'cancelled' }).eq('id', saleId);
    return { error: error?.message ?? null };
  }

  const { data: movements } = await supabase
    .from('stock_movements')
    .select('id, company_id, branch_id, product_id, variation_id, quantity, unit_cost, total_cost, box_change, piece_change')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
    .eq('movement_type', 'sale');

  if (movements && movements.length > 0) {
    const invoiceNo = String(s.invoice_no ?? `SL-${saleId.slice(0, 8)}`);
    for (const m of movements) {
      const rev: Record<string, unknown> = {
        company_id: m.company_id,
        branch_id: m.branch_id,
        product_id: m.product_id,
        variation_id: m.variation_id ?? null,
        movement_type: 'SALE_CANCELLED',
        quantity: Math.abs(Number(m.quantity) || 0),
        unit_cost: Number(m.unit_cost) || 0,
        total_cost: Math.abs(Number(m.total_cost) || 0),
        reference_type: 'sale',
        reference_id: saleId,
        notes: `Reversal of ${invoiceNo} (Cancelled)`,
      };
      if (m.box_change != null) rev.box_change = Math.abs(Number(m.box_change) || 0);
      if (m.piece_change != null) rev.piece_change = Math.abs(Number(m.piece_change) || 0);
      const { error: insErr } = await supabase.from('stock_movements').insert(rev);
      if (insErr) return { error: `Stock reversal failed: ${insErr.message}` };
    }
  }

  const { error } = await supabase.from('sales').update({ status: 'cancelled' }).eq('id', saleId);
  return { error: error?.message ?? null };
}

/** Record a payment against a sale (Dr Cash/Bank, Cr A/R) via RPC. Respects company_id and branch_id. */
export async function recordSalePayment(params: {
  companyId: string;
  branchId: string;
  saleId: string;
  amount: number;
  paymentMethod: string;
  paymentAccountId: string;
  paymentDate?: string;
  referenceNumber?: string;
  notes?: string;
  userId?: string | null;
}): Promise<{ data: { payment_id: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const {
    companyId,
    branchId,
    saleId,
    amount,
    paymentMethod,
    paymentAccountId,
    paymentDate,
    referenceNumber,
    notes,
    userId,
  } = params;
  if (!companyId || !branchId || !saleId || amount <= 0 || !paymentAccountId) {
    return { data: null, error: 'Company, branch, sale, amount and payment account are required.' };
  }
  const normalized = String(paymentMethod || 'cash').toLowerCase();
  const methodMap: Record<string, 'cash' | 'bank' | 'card' | 'other'> = {
    cash: 'cash',
    bank: 'bank',
    card: 'card',
    cheque: 'other',
    'mobile wallet': 'other',
    mobile_wallet: 'other',
    wallet: 'other',
  };
  const enumMethod = methodMap[normalized] || 'cash';
  // When the caller did not pass a reference, let the DB trigger assign a unique
  // value atomically. This avoids the payments_reference_number_unique race
  // condition we saw when two client-side document-number lookups landed the
  // same next value.
  const refNum: string | null = referenceNumber && referenceNumber.trim() ? referenceNumber.trim() : null;
  const dateVal = paymentDate || new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.rpc('record_payment_with_accounting', {
    p_company_id: companyId,
    p_branch_id: branchId,
    p_payment_type: 'received',
    p_reference_type: 'sale',
    p_reference_id: saleId,
    p_amount: amount,
    p_payment_method: enumMethod,
    p_payment_date: dateVal,
    p_payment_account_id: paymentAccountId,
    p_reference_number: refNum,
    p_notes: notes ?? null,
    p_created_by: userId ?? null,
  });
  if (error) return { data: null, error: error.message };
  const res = data as { success?: boolean; payment_id?: string; error?: string } | null;
  if (res?.success && res.payment_id) return { data: { payment_id: res.payment_id }, error: null };
  return { data: null, error: res?.error ?? 'Payment failed.' };
}

/** Record customer payment via RPC (atomic: payment + journal Dr Cash/Bank Cr A/R + update sale). Used by mobile Receive Payment screen. */
export async function recordCustomerPayment(params: {
  companyId: string;
  customerId: string | null;
  referenceId: string; // sale id
  amount: number;
  accountId: string;
  paymentMethod: string;
  paymentDate: string; // YYYY-MM-DD
  notes?: string | null;
  createdBy?: string | null;
}): Promise<{ data: { payment_id: string; reference_number?: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const {
    companyId,
    customerId,
    referenceId,
    amount,
    accountId,
    paymentMethod,
    paymentDate,
    notes,
    createdBy,
  } = params;
  if (!companyId || !referenceId || amount <= 0 || !accountId) {
    return { data: null, error: 'Company, reference (sale), amount and account are required.' };
  }
  const dateVal = paymentDate || new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.rpc('record_customer_payment', {
    p_company_id: companyId,
    p_customer_id: customerId || null,
    p_reference_id: referenceId,
    p_amount: amount,
    p_account_id: accountId,
    p_payment_method: paymentMethod || 'cash',
    p_payment_date: dateVal,
    p_notes: notes ?? null,
    p_created_by: createdBy ?? null,
  });
  if (error) return { data: null, error: error.message };
  const res = data as { success?: boolean; payment_id?: string; reference_number?: string; error?: string } | null;
  if (res?.success && res.payment_id) {
    return { data: { payment_id: res.payment_id, reference_number: res.reference_number }, error: null };
  }
  return { data: null, error: res?.error ?? 'Payment failed.' };
}

export type PaymentAttachment = { url: string; name: string };

/** Get payment history for a sale (including attachments for preview) */
export async function getSalePayments(saleId: string): Promise<{
  data: Array<{ id: string; date: string; amount: number; method: string; referenceNo: string; attachments?: PaymentAttachment[] }>;
  error: string | null;
}> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('payments')
    .select('id, payment_date, reference_number, amount, payment_method, attachments, voided_at')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
    .is('voided_at', null)
    .order('payment_date', { ascending: false });
  if (error) return { data: [], error: error.message };
  const direct = (data || [])
    .filter((p: Record<string, unknown>) => !p.voided_at)
    .map((p: Record<string, unknown>) => {
    let attachments: PaymentAttachment[] | undefined;
    const raw = p.attachments;
    if (Array.isArray(raw) && raw.length > 0) {
      attachments = raw.map((a: unknown) => {
        const o = a as Record<string, unknown>;
        return { url: String(o?.url ?? ''), name: String(o?.name ?? 'Attachment') };
      }).filter((a) => a.url);
    }
    return {
      id: String(p.id ?? ''),
      date: p.payment_date ? new Date(String(p.payment_date)).toLocaleDateString('en-PK') : '—',
      amount: Number(p.amount ?? 0),
      method: String(p.payment_method ?? '—'),
      referenceNo: String(p.reference_number ?? '—'),
      attachments: attachments?.length ? attachments : undefined,
    };
  });

  const allocRows: Array<{ id: string; date: string; amount: number; method: string; referenceNo: string; attachments?: PaymentAttachment[] }> = [];
  try {
    const { data: allocs } = await supabase
      .from('payment_allocations')
      .select('id, allocated_amount, allocation_date, payment_id, allocation_order')
      .eq('sale_id', saleId);
    const payIds = [...new Set((allocs || []).map((a: { payment_id?: string }) => a.payment_id).filter(Boolean))] as string[];
    if (payIds.length > 0) {
      const { data: parents } = await supabase
        .from('payments')
        .select('id, payment_date, reference_number, amount, payment_method, attachments, voided_at')
        .in('id', payIds);
      const parentById = new Map((parents || []).map((pr: Record<string, unknown>) => [String(pr.id), pr]));
      for (const a of allocs || []) {
        const row = a as { id?: string; payment_id?: string; allocated_amount?: number; allocation_date?: string; allocation_order?: number };
        const pr = parentById.get(String(row.payment_id));
        if (!pr || pr.voided_at) continue;
        let attachments: PaymentAttachment[] | undefined;
        const raw = pr.attachments;
        if (Array.isArray(raw) && raw.length > 0) {
          attachments = raw.map((x: unknown) => {
            const o = x as Record<string, unknown>;
            return { url: String(o?.url ?? ''), name: String(o?.name ?? 'Attachment') };
          }).filter((x) => x.url);
        }
        const ord = Number(row.allocation_order) || 0;
        allocRows.push({
          id: `alloc:${row.id}`,
          date: pr.payment_date ? new Date(String(pr.payment_date)).toLocaleDateString('en-PK') : '—',
          amount: Number(row.allocated_amount ?? 0),
          method: String(pr.payment_method ?? '—'),
          referenceNo: `${String(pr.reference_number ?? '—')} (alloc #${ord || '—'})`,
          attachments: attachments?.length ? attachments : undefined,
        });
      }
    }
  } catch {
    // no payment_allocations
  }

  const combined = [...direct, ...allocRows].sort((x, y) => {
    const dx = new Date(x.date).getTime();
    const dy = new Date(y.date).getTime();
    if (dy !== dx) return dy - dx;
    return String(y.referenceNo).localeCompare(String(x.referenceNo));
  });
  return { data: combined, error: null };
}

/** Log share action for audit (whatsapp / pdf / link) */
export async function logShare(saleId: string, shareType: 'whatsapp' | 'pdf' | 'link', userId?: string | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.rpc('log_share', {
      p_sale_id: saleId,
      p_share_type: shareType,
      p_user_id: userId ?? null,
      p_metadata: {},
    });
  } catch {
    // RPC may not exist
  }
}

/** Log print action (A4 / Thermal) */
export async function logPrint(saleId: string, printType: 'A4' | 'Thermal' | 'thermal_80mm' | 'thermal_58mm', userId?: string | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.rpc('log_print', {
      p_sale_id: saleId,
      p_print_type: printType,
      p_user_id: userId ?? null,
      p_metadata: {},
    });
  } catch {
    // RPC may not exist
  }
}

export type SaleReturnCandidateItem = {
  saleItemId: string | null;
  productId: string;
  variationId: string | null;
  productName: string;
  sku: string;
  soldQty: number;
  unitPrice: number;
  lineTotal: number;
};

export async function getSaleReturnCandidateItems(saleId: string): Promise<{
  data: SaleReturnCandidateItem[];
  error: string | null;
}> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  if (!saleId) return { data: [], error: 'Sale id is required.' };

  const mapRows = (rows: Record<string, unknown>[]) =>
    rows
      .map((r) => ({
        saleItemId: r.id ? String(r.id) : null,
        productId: String(r.product_id ?? ''),
        variationId: r.variation_id ? String(r.variation_id) : null,
        productName: String(r.product_name ?? 'Item'),
        sku: String(r.sku ?? '—'),
        soldQty: Number(r.quantity ?? 0),
        unitPrice: Number(r.unit_price ?? 0),
        lineTotal: Number(r.total ?? 0),
      }))
      .filter((r) => r.productId && r.soldQty > 0);

  const { data, error } = await supabase
    .from('sales_items')
    .select('id, product_id, variation_id, product_name, sku, quantity, unit_price, total')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: true });
  if (!error) return { data: mapRows((data || []) as Record<string, unknown>[]), error: null };

  if (error.code === '42P01' || String(error.message).toLowerCase().includes('does not exist')) {
    const fallback = await supabase
      .from('sale_items')
      .select('id, product_id, variation_id, product_name, sku, quantity, unit_price, total')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true });
    if (fallback.error) return { data: [], error: fallback.error.message };
    return { data: mapRows((fallback.data || []) as Record<string, unknown>[]), error: null };
  }

  return { data: [], error: error.message };
}

export type CreateSaleReturnPayload = {
  companyId: string;
  branchId: string;
  saleId: string;
  customerId?: string | null;
  customerName?: string | null;
  userId?: string | null;
  reason?: string | null;
  notes?: string | null;
  items: Array<{
    saleItemId?: string | null;
    productId: string;
    variationId?: string | null;
    productName: string;
    sku?: string | null;
    quantity: number;
    unitPrice: number;
  }>;
};

export async function createAndFinalizeSaleReturn(payload: CreateSaleReturnPayload): Promise<{
  data: { returnId: string; returnNo: string } | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  if (!payload.companyId || !payload.branchId || !payload.saleId) {
    return { data: null, error: 'Company, branch and sale are required.' };
  }

  const items = payload.items
    .map((i) => ({ ...i, quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitPrice) || 0 }))
    .filter((i) => i.productId && i.quantity > 0);
  if (items.length === 0) return { data: null, error: 'Select at least one return item.' };

  let returnNo = '';
  try {
    const { data: numData, error: numErr } = await supabase.rpc('generate_document_number', {
      p_company_id: payload.companyId,
      p_branch_id: payload.branchId,
      p_document_type: 'sale_return',
      p_include_year: false,
    });
    if (numErr || !numData) throw new Error(numErr?.message || 'Numbering failed');
    returnNo = String(numData);
  } catch {
    returnNo = `SRET-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`;
  }

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const normalizedDate = new Date().toISOString().slice(0, 10);

  const { data: saleReturn, error: headerErr } = await supabase
    .from('sale_returns')
    .insert({
      company_id: payload.companyId,
      branch_id: payload.branchId,
      original_sale_id: payload.saleId,
      return_no: returnNo,
      return_date: normalizedDate,
      customer_id: payload.customerId ?? null,
      customer_name: payload.customerName || 'Walk-in',
      status: 'draft',
      subtotal,
      discount_amount: 0,
      tax_amount: 0,
      total: subtotal,
      reason: payload.reason ?? null,
      notes: payload.notes ?? null,
      created_by: payload.userId ?? null,
    })
    .select('id, return_no')
    .single();
  if (headerErr || !saleReturn) return { data: null, error: headerErr?.message ?? 'Failed to create sale return.' };

  const returnItems = items.map((i) => ({
    sale_return_id: saleReturn.id,
    sale_item_id: i.saleItemId ?? null,
    product_id: i.productId,
    variation_id: i.variationId ?? null,
    product_name: i.productName,
    sku: i.sku || '—',
    quantity: i.quantity,
    unit: 'piece',
    unit_price: i.unitPrice,
    total: i.quantity * i.unitPrice,
  }));

  const { error: itemsErr } = await supabase.from('sale_return_items').insert(returnItems);
  if (itemsErr) return { data: null, error: itemsErr.message };

  const { data: finalizeData, error: finalizeErr } = await supabase.rpc('finalize_sale_return', {
    p_sale_return_id: saleReturn.id,
    p_company_id: payload.companyId,
    p_created_by: payload.userId ?? null,
  });

  if (finalizeErr) {
    const msg = finalizeErr.message || 'Failed to finalize sale return.';
    if (msg.includes('Could not find the function')) {
      return {
        data: null,
        error: `${msg} Apply sale return finalization migration on Postgres and retry.`,
      };
    }
    return { data: null, error: msg };
  }

  const finalizeRes = (finalizeData || {}) as { success?: boolean; error?: string };
  if (finalizeRes.success === false) return { data: null, error: finalizeRes.error || 'Failed to finalize sale return.' };

  return { data: { returnId: String(saleReturn.id), returnNo: String(saleReturn.return_no || returnNo) }, error: null };
}
