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

  const { companyId, branchId, customerId, customerName, contactNumber, items, subtotal, discountAmount, taxAmount, expenses, total, paymentMethod, notes, isStudio, userId, paidAmount, dueAmount } = input;

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
      payment_account_id: null,
      reference_number: payRef,
      created_by: userId,
    });
    if (payErr) console.warn('[SALES API] Payment record insert failed:', payErr);
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
    .order('created_at', { ascending: false })
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
      return { data: retryData || [], error: null };
    }
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
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

/** Get payment history for a sale */
export async function getSalePayments(saleId: string): Promise<{
  data: Array<{ id: string; date: string; amount: number; method: string; referenceNo: string }>;
  error: string | null;
}> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('payments')
    .select('id, payment_date, reference_number, amount, payment_method')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
    .order('payment_date', { ascending: false });
  if (error) return { data: [], error: error.message };
  const list = (data || []).map((p: Record<string, unknown>) => ({
    id: String(p.id ?? ''),
    date: p.payment_date ? new Date(String(p.payment_date)).toLocaleDateString('en-PK') : '—',
    amount: Number(p.amount ?? 0),
    method: String(p.payment_method ?? '—'),
    referenceNo: String(p.reference_number ?? '—'),
  }));
  return { data: list, error: null };
}
