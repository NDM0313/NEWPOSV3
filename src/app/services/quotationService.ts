/**
 * Step 6: Quotations. Create, edit, list, convert to sale.
 */
import { supabase } from '@/lib/supabase';
import { saleService } from '@/app/services/saleService';

export interface QuotationItemRow {
  id: string;
  quotation_id: string;
  product_id: string | null;
  product_name: string | null;
  sku: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  sort_order: number;
}

export interface QuotationRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  customer_id: string | null;
  customer_name: string;
  quotation_no: string;
  status: string;
  valid_until: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  converted_sale_id: string | null;
  items?: QuotationItemRow[];
}

async function nextQuotationNo(companyId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('quotations')
    .select('quotation_no')
    .eq('company_id', companyId)
    .like('quotation_no', 'QT-%')
    .order('quotation_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  const maxNum = existing?.quotation_no
    ? parseInt(String(existing.quotation_no).replace(/\D/g, ''), 10) || 0
    : 0;
  return `QT-${String(maxNum + 1).padStart(4, '0')}`;
}

export const quotationService = {
  async listByCompany(companyId: string, options?: { status?: string; limit?: number }): Promise<QuotationRow[]> {
    let q = supabase
      .from('quotations')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (options?.status) q = q.eq('status', options.status);
    if (options?.limit) q = q.limit(options.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as QuotationRow[];
  },

  async getById(id: string, withItems = true): Promise<QuotationRow | null> {
    const { data, error } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as QuotationRow;
    if (withItems) {
      const { data: items } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', id)
        .order('sort_order');
      row.items = (items || []) as QuotationItemRow[];
    }
    return row;
  },

  async create(payload: {
    companyId: string;
    branchId?: string | null;
    customerId?: string | null;
    customerName: string;
    validUntil?: string | null;
    notes?: string | null;
    createdBy?: string | null;
    items: Array<{
      product_id?: string | null;
      product_name?: string | null;
      sku?: string | null;
      quantity: number;
      unit?: string;
      unit_price: number;
      discount_amount?: number;
      tax_amount?: number;
      total: number;
    }>;
  }): Promise<QuotationRow> {
    const quotationNo = await nextQuotationNo(payload.companyId);
    const subtotal = payload.items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const discount = payload.items.reduce((s, i) => s + (i.discount_amount ?? 0), 0);
    const tax = payload.items.reduce((s, i) => s + (i.tax_amount ?? 0), 0);
    const total = payload.items.reduce((s, i) => s + i.total, 0);

    const { data: q, error: qErr } = await supabase
      .from('quotations')
      .insert({
        company_id: payload.companyId,
        branch_id: payload.branchId ?? null,
        customer_id: payload.customerId ?? null,
        customer_name: payload.customerName || 'Customer',
        quotation_no: quotationNo,
        status: 'draft',
        valid_until: payload.validUntil ?? null,
        subtotal,
        discount,
        tax,
        total,
        notes: payload.notes ?? null,
        created_by: payload.createdBy ?? null,
      })
      .select()
      .single();
    if (qErr || !q) throw new Error(qErr?.message ?? 'Failed to create quotation');

    const itemRows = payload.items.map((it, idx) => ({
      quotation_id: q.id,
      product_id: it.product_id ?? null,
      product_name: it.product_name ?? null,
      sku: it.sku ?? null,
      quantity: it.quantity,
      unit: it.unit ?? 'pcs',
      unit_price: it.unit_price,
      discount_amount: it.discount_amount ?? 0,
      tax_amount: it.tax_amount ?? 0,
      total: it.total,
      sort_order: idx,
    }));
    if (itemRows.length > 0) {
      const { error: itemsErr } = await supabase.from('quotation_items').insert(itemRows);
      if (itemsErr) throw itemsErr;
    }

    return this.getById(q.id, true) as Promise<QuotationRow>;
  },

  async update(id: string, payload: Partial<Pick<QuotationRow, 'customer_id' | 'customer_name' | 'valid_until' | 'notes' | 'status'>>): Promise<void> {
    const { error } = await supabase
      .from('quotations')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async updateItems(quotationId: string, items: Array<{
    product_id?: string | null;
    product_name?: string | null;
    sku?: string | null;
    quantity: number;
    unit?: string;
    unit_price: number;
    discount_amount?: number;
    tax_amount?: number;
    total: number;
  }>): Promise<void> {
    const { error: delErr } = await supabase.from('quotation_items').delete().eq('quotation_id', quotationId);
    if (delErr) throw delErr;
    if (items.length === 0) return;
    const rows = items.map((it, idx) => ({
      quotation_id: quotationId,
      product_id: it.product_id ?? null,
      product_name: it.product_name ?? null,
      sku: it.sku ?? null,
      quantity: it.quantity,
      unit: it.unit ?? 'pcs',
      unit_price: it.unit_price,
      discount_amount: it.discount_amount ?? 0,
      tax_amount: it.tax_amount ?? 0,
      total: it.total,
      sort_order: idx,
    }));
    const { error: insErr } = await supabase.from('quotation_items').insert(rows);
    if (insErr) throw insErr;
  },

  /**
   * Convert quotation to sale (final invoice). Creates sale + sales_items, updates quotation status and converted_sale_id.
   */
  async convertToSale(quotationId: string, options?: { branchId?: string | null; createdBy?: string | null }): Promise<{ saleId: string; invoiceNo: string }> {
    const q = await this.getById(quotationId, true);
    if (!q) throw new Error('Quotation not found');
    if (q.converted_sale_id) throw new Error('Quotation already converted to sale');
    if (!q.items?.length) throw new Error('Quotation has no items');

    const { getNextDocumentNumberGlobal } = await import('@/app/services/documentNumberService');
    let invoiceNo: string;
    try {
      invoiceNo = await getNextDocumentNumberGlobal(q.company_id, 'SL');
    } catch {
      const { data: last } = await supabase.from('sales').select('invoice_no').eq('company_id', q.company_id).like('invoice_no', 'SL-%').order('invoice_no', { ascending: false }).limit(1).maybeSingle();
      const n = last?.invoice_no ? parseInt(String(last.invoice_no).replace(/\D/g, ''), 10) + 1 : 1;
      invoiceNo = `SL-${String(n).padStart(4, '0')}`;
    }

    const branchId = options?.branchId ?? q.branch_id;
    const sale: any = {
      company_id: q.company_id,
      branch_id: branchId,
      invoice_no: invoiceNo,
      invoice_date: new Date().toISOString().slice(0, 10),
      customer_id: q.customer_id ?? undefined,
      customer_name: q.customer_name,
      type: 'invoice',
      status: 'final',
      payment_status: 'unpaid',
      payment_method: 'Cash',
      subtotal: q.subtotal,
      discount_amount: q.discount,
      tax_amount: q.tax,
      expenses: 0,
      total: q.total,
      paid_amount: 0,
      due_amount: q.total,
      return_due: 0,
      notes: q.notes ?? null,
      created_by: options?.createdBy ?? null,
    };

    const saleItems: any[] = q.items.map((it) => ({
      product_id: it.product_id,
      product_name: it.product_name ?? '',
      sku: it.sku ?? '',
      quantity: it.quantity,
      unit: it.unit ?? 'pcs',
      unit_price: it.unit_price,
      discount_amount: it.discount_amount,
      tax_amount: it.tax_amount,
      total: it.total,
    }));

    const created = await saleService.createSale(sale, saleItems, { allowNegativeStock: true });
    const saleId = (created as any).id;

    await supabase
      .from('quotations')
      .update({ status: 'converted', converted_sale_id: saleId, updated_at: new Date().toISOString() })
      .eq('id', quotationId);

    return { saleId, invoiceNo };
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('quotations').delete().eq('id', id);
    if (error) throw error;
  },
};

/** Build QuotationDocument for UnifiedQuotationView (print). */
export function quotationToQuotationDocument(
  q: QuotationRow,
  companyName: string,
  companyAddress?: string | null
): import('@/app/documents/templates/QuotationTemplate').QuotationDocument {
  const items = (q.items || []).map((it) => ({
    id: it.id,
    product_name: it.product_name || '—',
    sku: it.sku || '',
    quantity: Number(it.quantity) || 0,
    unit: it.unit || 'pcs',
    unit_price: Number(it.unit_price) || 0,
    discount_amount: Number(it.discount_amount) || 0,
    tax_amount: Number(it.tax_amount) || 0,
    total: Number(it.total) || 0,
  }));
  return {
    companyName,
    companyAddress: companyAddress ?? null,
    customerName: q.customer_name,
    contactNumber: null,
    address: null,
    quotation_no: q.quotation_no,
    date: q.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    valid_until: q.valid_until ?? null,
    items,
    subtotal: Number(q.subtotal) || 0,
    discount: Number(q.discount) || 0,
    tax: Number(q.tax) || 0,
    total: Number(q.total) || 0,
  };
}

/** Build InvoiceDocument for UnifiedProformaInvoiceView (print proforma). */
export function quotationToProformaDocument(
  q: QuotationRow,
  company: { id: string; name: string; address?: string | null }
): import('@/app/types/invoiceDocument').InvoiceDocument {
  const items = (q.items || []).map((it) => ({
    id: it.id,
    product_name: it.product_name || '—',
    sku: it.sku || '',
    quantity: Number(it.quantity) || 0,
    unit: it.unit || 'pcs',
    unit_price: Number(it.unit_price) || 0,
    discount_amount: Number(it.discount_amount) || 0,
    tax_amount: Number(it.tax_amount) || 0,
    total: Number(it.total) || 0,
    packing_details: null,
  }));
  return {
    company: { id: company.id, name: company.name, address: company.address ?? null },
    customer: {
      id: q.customer_id || '',
      name: q.customer_name,
      contact_number: '',
      address: null,
    },
    items,
    studio_cost: 0,
    payments: [],
    totals: {
      subtotal: Number(q.subtotal) || 0,
      discount: Number(q.discount) || 0,
      tax: Number(q.tax) || 0,
      expenses: 0,
      total: Number(q.total) || 0,
      studio_charges: 0,
      grand_total: Number(q.total) || 0,
      paid: 0,
      due: Number(q.total) || 0,
    },
    meta: {
      sale_id: q.id,
      invoice_no: q.quotation_no,
      invoice_date: q.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      fiscal_period: null,
      status: q.status,
      type: 'proforma',
      payment_status: 'unpaid',
      notes: q.notes ?? null,
      branch_id: q.branch_id || '',
    },
  };
}
