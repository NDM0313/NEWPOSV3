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
}

/**
 * Get next invoice number from server – ATOMIC, no race conditions.
 * Uses RPC get_next_document_number. Studio sales use 'studio' (STD-xxx), regular use 'sale' (SL-xxx).
 */
async function getNextInvoiceNumber(companyId: string, branchId: string, isStudio: boolean): Promise<string> {
  const documentType = isStudio ? 'studio' : 'sale';
  const { data, error } = await supabase.rpc('get_next_document_number', {
    p_company_id: companyId,
    p_branch_id: branchId,
    p_document_type: documentType,
  });

  if (error) {
    console.error('[SALES API] get_next_document_number failed:', error);
    throw new Error(`Failed to get invoice number: ${error.message}`);
  }

  if (!data || typeof data !== 'string') {
    throw new Error('Invalid invoice number from server');
  }

  return data;
}

export async function createSale(input: CreateSaleInput): Promise<{ data: { id: string; invoiceNo: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'App not configured.' };
  }

  const { companyId, branchId, customerId, customerName, contactNumber, items, subtotal, discountAmount, taxAmount, expenses, total, paymentMethod, notes, isStudio, userId, paidAmount, dueAmount, paymentAccountId } = input;

  if (!companyId || !branchId || !userId) {
    return { data: null, error: 'Missing company, branch, or user.' };
  }
  if (!items.length) {
    return { data: null, error: 'No items in sale.' };
  }

  let invoiceNo: string;
  try {
    invoiceNo = await getNextInvoiceNumber(companyId, branchId, !!isStudio);
  } catch (err) {
    return { data: null, error: (err as Error).message ?? 'Failed to get invoice number' };
  }

  const totalNum = Number(total) || 0;
  const isCredit = String(paymentMethod || '').toLowerCase() === 'credit';
  const isSplit = paidAmount != null && dueAmount != null;
  const paid = isSplit ? Number(paidAmount) : (isCredit ? 0 : totalNum);
  const due = isSplit ? Number(dueAmount) : (isCredit ? totalNum : 0);
  const saleRow = {
    company_id: companyId,
    branch_id: branchId,
    invoice_no: invoiceNo,
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
  };

  const { data: saleData, error: saleError } = await supabase
    .from('sales')
    .insert(saleRow)
    .select('id')
    .single();

  if (saleError) {
    return { data: null, error: saleError.message };
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
        branch_id: branchId,
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

  // Create payment record when paid > 0 (for payment history)
  if (paid > 0) {
    const payMethod = (paymentMethod || 'Cash').toLowerCase();
    let enumMethod: 'cash' | 'bank' | 'card' | 'other' = 'cash';
    if (payMethod.includes('bank') || payMethod.includes('transfer')) enumMethod = 'bank';
    else if (payMethod.includes('credit') || payMethod.includes('card')) enumMethod = 'card';
    const payRef = await getNextDocumentNumber(companyId, branchId, 'payment');
    const { error: payErr } = await supabase.from('payments').insert({
      company_id: companyId,
      branch_id: branchId,
      payment_type: 'received',
      reference_type: 'sale',
      reference_id: saleId,
      amount: paid,
      payment_method: enumMethod,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_account_id: paymentAccountId || null,
      reference_number: payRef,
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
        branch_id: branchId,
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

  return {
    data: { id: saleId, invoiceNo },
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

  if (branchId && branchId !== 'all') {
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
      const retry = branchId && branchId !== 'all' ? retryQuery.eq('branch_id', branchId) : retryQuery;
      const { data: retryData, error: retryError } = await retry;
      if (retryError) return { data: [], error: retryError.message };
      const retryList = retryData || [];
      const enrichedRetry = await enrichSalesWithPayments(companyId, branchId, retryList);
      return { data: enrichedRetry, error: null };
    }
    return { data: [], error: error.message };
  }

  const list = data || [];
  const enriched = await enrichSalesWithPayments(companyId, branchId, list);
  return { data: enriched, error: null };
}

/** Aggregate payments by sale (reference_type='sale'); respect company_id and branch_id. */
async function enrichSalesWithPayments(
  companyId: string,
  branchId: string | null | undefined,
  sales: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  if (!sales.length) return sales;
  const saleIds = sales.map((s) => s.id as string).filter(Boolean);
  let payQuery = supabase
    .from('payments')
    .select('reference_id, amount')
    .eq('reference_type', 'sale')
    .eq('company_id', companyId)
    .in('reference_id', saleIds);
  if (branchId && branchId !== 'all') {
    payQuery = payQuery.eq('branch_id', branchId);
  }
  const { data: payData } = await payQuery;
  const bySale: Record<string, number> = {};
  for (const p of payData || []) {
    const refId = (p as Record<string, unknown>).reference_id as string;
    if (refId) {
      bySale[refId] = (bySale[refId] || 0) + Number((p as Record<string, unknown>).amount ?? 0);
    }
  }
  return sales.map((s) => {
    const saleTotal = Number(s.total ?? 0);
    const studioCharges = Number(s.studio_charges ?? 0);
    const grandTotal = saleTotal + studioCharges;
    const totalReceived = bySale[(s.id as string) || ''] || 0;
    const overpaid = totalReceived > grandTotal;
    const balanceDue = overpaid ? 0 : Math.max(0, grandTotal - totalReceived);
    const creditBalance = overpaid ? totalReceived - grandTotal : 0;
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
    breakdown: Array<{ task_type: string; cost: number; worker_id?: string }>;
    tasks_with_workers: Array<{
      task_type: string;
      cost: number;
      worker_id?: string;
      worker_name?: string;
      created_by?: string;
      completed_by?: string;
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
      breakdown: Array.isArray(raw.breakdown) ? (raw.breakdown as Array<{ task_type: string; cost: number; worker_id?: string }>) : [],
      tasks_with_workers: Array.isArray(raw.tasks_with_workers)
        ? (raw.tasks_with_workers as Array<{
            task_type: string;
            cost: number;
            worker_id?: string;
            worker_name?: string;
            created_by?: string;
            completed_by?: string;
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
  let refNum: string;
  try {
    refNum =
      referenceNumber ||
      (await getNextDocumentNumber(companyId, branchId, 'payment'));
  } catch {
    refNum = `PMT-${Date.now()}`;
  }
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
    .select('id, payment_date, reference_number, amount, payment_method, attachments')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
    .order('payment_date', { ascending: false });
  if (error) return { data: [], error: error.message };
  const list = (data || []).map((p: Record<string, unknown>) => {
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
  return { data: list, error: null };
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
