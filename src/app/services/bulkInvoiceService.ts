/**
 * Wholesale: Bulk invoices (Step 5).
 * Select multiple packing lists → generate one bulk invoice. Print via UnifiedSalesInvoiceView (invoice doc built from bulk).
 */
import { supabase } from '@/lib/supabase';
import type { InvoiceDocument } from '@/app/types/invoiceDocument';

export interface BulkInvoiceRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  customer_id: string | null;
  customer_name: string;
  invoice_no: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BulkInvoiceItemRow {
  id: string;
  bulk_invoice_id: string;
  packing_list_id: string;
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

export interface CreateBulkInvoiceFromPackingListsPayload {
  companyId: string;
  branchId?: string | null;
  packingListIds: string[];
  customerId?: string | null;
  customerName: string;
  createdBy?: string | null;
}

/** Generate next bulk invoice number (BINV-0001, ...). */
async function nextBulkInvoiceNo(companyId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('bulk_invoices')
    .select('invoice_no')
    .eq('company_id', companyId)
    .like('invoice_no', 'BINV-%')
    .order('invoice_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  const maxNum = existing?.invoice_no
    ? parseInt(String(existing.invoice_no).replace(/\D/g, ''), 10) || 0
    : 0;
  return `BINV-${String(maxNum + 1).padStart(4, '0')}`;
}

export const bulkInvoiceService = {
  async listByCompany(companyId: string, options?: { status?: string; limit?: number }): Promise<BulkInvoiceRow[]> {
    let q = supabase
      .from('bulk_invoices')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (options?.status) q = q.eq('status', options.status);
    if (options?.limit) q = q.limit(options.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as BulkInvoiceRow[];
  },

  async getById(id: string, withItems = true): Promise<{
    invoice: BulkInvoiceRow;
    items: BulkInvoiceItemRow[];
    packingListIds: string[];
  } | null> {
    const { data: inv, error: invErr } = await supabase
      .from('bulk_invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (invErr || !inv) return null;
    const items: BulkInvoiceItemRow[] = withItems
      ? ((await supabase.from('bulk_invoice_items').select('*').eq('bulk_invoice_id', id).order('sort_order')).data as BulkInvoiceItemRow[]) || []
      : [];
    const { data: plLinks } = await supabase
      .from('bulk_invoice_packing_lists')
      .select('packing_list_id')
      .eq('bulk_invoice_id', id);
    const packingListIds = (plLinks || []).map((r: { packing_list_id: string }) => r.packing_list_id);
    return { invoice: inv as BulkInvoiceRow, items, packingListIds };
  },

  /**
   * Create bulk invoice from selected packing lists.
   * For each packing list: get sale_id, fetch sale items (for unit_price); map packing_list_items to sale items by order; add bulk_invoice_items.
   */
  async createFromPackingLists(payload: CreateBulkInvoiceFromPackingListsPayload): Promise<BulkInvoiceRow> {
    const { companyId, branchId, packingListIds, customerId, customerName, createdBy } = payload;
    if (packingListIds.length === 0) throw new Error('Select at least one packing list');

    const invoiceNo = await nextBulkInvoiceNo(companyId);

    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const allItems: Array<{
      packing_list_id: string;
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
    }> = [];
    let sortOrder = 0;

    for (const plId of packingListIds) {
      const { data: pl, error: plErr } = await supabase
        .from('packing_lists')
        .select('id, sale_id')
        .eq('id', plId)
        .single();
      if (plErr || !pl) continue;

      const saleId = (pl as { sale_id: string }).sale_id;

      const { data: plItems } = await supabase
        .from('packing_list_items')
        .select('*')
        .eq('packing_list_id', plId)
        .order('sort_order');
      if (!plItems?.length) continue;

      let saleItems: Array<{ product_id?: string; product_name?: string; sku?: string; quantity?: number; unit?: string; unit_price?: number; discount_amount?: number; tax_amount?: number; total?: number }> = [];
      const { data: salesItems } = await supabase
        .from('sales_items')
        .select('product_id, product_name, sku, quantity, unit, unit_price, discount_amount, tax_amount, total')
        .eq('sale_id', saleId)
        .order('id');
      if (salesItems?.length) saleItems = salesItems as any[];
      else {
        const { data: fallbackItems } = await supabase
          .from('sale_items')
          .select('product_id, product_name, sku, quantity, unit, unit_price, discount_amount, tax_amount, total')
          .eq('sale_id', saleId)
          .order('id');
        if (fallbackItems?.length) saleItems = fallbackItems as any[];
      }

      for (let i = 0; i < plItems.length; i++) {
        const pi = plItems[i] as { product_id?: string; product_name?: string; sku?: string; pieces: number; cartons: number };
        const saleItem = saleItems[i] || saleItems[0];
        const qty = Number(pi.pieces) || 0;
        const unitPrice = saleItem?.unit_price ?? 0;
        const discountAmount = saleItem?.discount_amount ?? 0;
        const taxAmount = saleItem?.tax_amount ?? 0;
        const lineTotal = saleItem?.total ?? qty * unitPrice;
        allItems.push({
          packing_list_id: plId,
          product_id: pi.product_id ?? null,
          product_name: pi.product_name ?? saleItem?.product_name ?? null,
          sku: pi.sku ?? saleItem?.sku ?? null,
          quantity: qty,
          unit: saleItem?.unit ?? 'pcs',
          unit_price: unitPrice,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total: lineTotal,
          sort_order: sortOrder++,
        });
        subtotal += lineTotal + (discountAmount + taxAmount) - discountAmount - taxAmount;
        totalDiscount += discountAmount;
        totalTax += taxAmount;
      }
    }

    const total = allItems.reduce((sum, it) => sum + it.total, 0);
    const subtotalCalc = allItems.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);

    const { data: bulkInv, error: invErr } = await supabase
      .from('bulk_invoices')
      .insert({
        company_id: companyId,
        branch_id: branchId ?? null,
        customer_id: customerId ?? null,
        customer_name: customerName || 'Customer',
        invoice_no: invoiceNo,
        subtotal: subtotalCalc,
        discount: totalDiscount,
        tax: totalTax,
        total: total,
        status: 'draft',
        created_by: createdBy ?? null,
      })
      .select()
      .single();
    if (invErr || !bulkInv) throw new Error(invErr?.message ?? 'Failed to create bulk invoice');

    await supabase
      .from('bulk_invoice_packing_lists')
      .insert(packingListIds.map((packing_list_id) => ({ bulk_invoice_id: bulkInv.id, packing_list_id })));

    if (allItems.length > 0) {
      await supabase.from('bulk_invoice_items').insert(
        allItems.map((it) => ({
          bulk_invoice_id: bulkInv.id,
          packing_list_id: it.packing_list_id,
          product_id: it.product_id,
          product_name: it.product_name,
          sku: it.sku,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          discount_amount: it.discount_amount,
          tax_amount: it.tax_amount,
          total: it.total,
          sort_order: it.sort_order,
        }))
      );
    }

    return bulkInv as BulkInvoiceRow;
  },

  /**
   * Build InvoiceDocument for UnifiedSalesInvoiceView (print/PDF).
   * Fetches company name/address from companies; uses bulk_invoice + bulk_invoice_items.
   */
  async getInvoiceDocument(
    bulkInvoiceId: string,
    company: { id: string; name: string; address?: string | null }
  ): Promise<InvoiceDocument | null> {
    const one = await this.getById(bulkInvoiceId, true);
    if (!one) return null;

    const { invoice, items } = one;
    const invoiceItems = items.map((it, idx) => ({
      id: it.id,
      product_name: it.product_name || '',
      sku: it.sku || '',
      quantity: it.quantity,
      unit: it.unit || 'pcs',
      unit_price: it.unit_price,
      discount_amount: it.discount_amount,
      tax_amount: it.tax_amount,
      total: it.total,
      packing_details: null,
    }));

    return {
      company: { id: company.id, name: company.name, address: company.address ?? null },
      customer: {
        id: invoice.customer_id || '',
        name: invoice.customer_name,
        contact_number: '',
        address: null,
      },
      items: invoiceItems,
      studio_cost: 0,
      payments: [],
      totals: {
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        tax: invoice.tax,
        expenses: 0,
        total: invoice.total,
        studio_charges: 0,
        grand_total: invoice.total,
        paid: 0,
        due: invoice.total,
      },
      meta: {
        sale_id: bulkInvoiceId,
        invoice_no: invoice.invoice_no,
        invoice_date: invoice.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        fiscal_period: null,
        status: invoice.status,
        type: 'bulk_invoice',
        payment_status: 'unpaid',
        notes: invoice.notes ?? null,
        branch_id: invoice.branch_id || '',
      },
    };
  },

  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('bulk_invoices')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
