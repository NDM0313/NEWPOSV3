/**
 * Wholesale: Packing lists and items (Step 5).
 * Create from sale, list by sale/company, get for print (UnifiedPackingListView).
 */
import { supabase } from '@/lib/supabase';

export interface PackingListItemRow {
  id: string;
  packing_list_id: string;
  product_id: string | null;
  product_name: string | null;
  sku: string | null;
  pieces: number;
  cartons: number;
  weight: string | null;
  sort_order: number;
}

export interface PackingListRow {
  id: string;
  company_id: string;
  sale_id: string;
  branch_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  items?: PackingListItemRow[];
}

export interface CreatePackingListFromSalePayload {
  companyId: string;
  saleId: string;
  branchId?: string | null;
  createdBy?: string | null;
}

export const packingListService = {
  async listBySale(saleId: string): Promise<PackingListRow[]> {
    const { data, error } = await supabase
      .from('packing_lists')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as PackingListRow[];
  },

  async listByCompany(companyId: string, options?: { status?: string; limit?: number }): Promise<PackingListRow[]> {
    let q = supabase
      .from('packing_lists')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (options?.status) q = q.eq('status', options.status);
    if (options?.limit) q = q.limit(options.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as PackingListRow[];
  },

  async getById(id: string, withItems = true): Promise<PackingListRow | null> {
    const { data, error } = await supabase
      .from('packing_lists')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as PackingListRow;
    if (withItems) {
      const { data: items } = await supabase
        .from('packing_list_items')
        .select('*')
        .eq('packing_list_id', id)
        .order('sort_order', { ascending: true });
      row.items = (items || []) as PackingListItemRow[];
    }
    return row;
  },

  /**
   * Create packing list and items from a sale.
   * Fetches sale items (sales_items / sale_items) and maps to packing_list_items (pieces, cartons, weight).
   */
  async createFromSale(payload: CreatePackingListFromSalePayload): Promise<PackingListRow> {
    const { companyId, saleId, branchId, createdBy } = payload;

    // Fetch sale for branch_id
    const { data: saleRow, error: saleErr } = await supabase
      .from('sales')
      .select('id, branch_id')
      .eq('id', saleId)
      .single();
    if (saleErr || !saleRow) throw new Error('Sale not found');

    const branch = branchId ?? (saleRow as { branch_id?: string }).branch_id ?? null;

    const { data: pl, error: plErr } = await supabase
      .from('packing_lists')
      .insert({
        company_id: companyId,
        sale_id: saleId,
        branch_id: branch,
        status: 'draft',
        created_by: createdBy ?? null,
      })
      .select()
      .single();
    if (plErr || !pl) throw new Error(plErr?.message ?? 'Failed to create packing list');

    // Fetch sale line items (try sales_items then sale_items)
    let items: Array<{
      product_id: string | null;
      product_name: string | null;
      sku: string | null;
      quantity: number;
      packing_details?: any;
      packing_quantity?: number;
    }> = [];
    const { data: salesItems } = await supabase
      .from('sales_items')
      .select('product_id, product_name, sku, quantity, packing_details, packing_quantity')
      .eq('sale_id', saleId)
      .order('id');
    if (salesItems && salesItems.length > 0) {
      items = salesItems as any[];
    } else {
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('product_id, product_name, sku, quantity, packing_details, packing_quantity')
        .eq('sale_id', saleId)
        .order('id');
      if (saleItems && saleItems.length > 0) items = saleItems as any[];
    }

    const toInsert = items.map((it, idx) => {
      const pd = it.packing_details && typeof it.packing_details === 'object'
        ? it.packing_details
        : typeof it.packing_details === 'string'
          ? (() => { try { return JSON.parse(it.packing_details); } catch { return null; } })()
          : null;
      const pieces = pd?.total_pieces ?? it.quantity ?? 0;
      const cartons = pd?.total_boxes ?? pd?.thaans ?? 0;
      const weight = pd?.weight != null ? String(pd.weight) : (pd?.total_weight != null ? String(pd.total_weight) : '');
      return {
        packing_list_id: pl.id,
        product_id: it.product_id ?? null,
        product_name: it.product_name ?? null,
        sku: it.sku ?? null,
        pieces: Number(pieces) || 0,
        cartons: Number(cartons) || 0,
        weight: weight || null,
        sort_order: idx,
      };
    });

    if (toInsert.length > 0) {
      const { error: itemsErr } = await supabase.from('packing_list_items').insert(toInsert);
      if (itemsErr) throw new Error(itemsErr.message);
    }

    return this.getById(pl.id, true) as Promise<PackingListRow>;
  },

  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('packing_lists')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('packing_lists').delete().eq('id', id);
    if (error) throw error;
  },
};
