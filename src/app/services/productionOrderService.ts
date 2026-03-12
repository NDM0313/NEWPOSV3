/**
 * Manufacturing: Production Orders. Company, product, quantity, status, dates.
 */
import { supabase } from '@/lib/supabase';

export interface ProductionOrderRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  product_id: string;
  quantity: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  order_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionOrderWithDetails extends ProductionOrderRow {
  product_name?: string | null;
  product_sku?: string | null;
}

async function nextOrderNumber(companyId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('production_orders')
    .select('order_number')
    .eq('company_id', companyId)
    .not('order_number', 'is', null)
    .like('order_number', 'PO-%')
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const maxNum = existing?.order_number
    ? parseInt(String(existing.order_number).replace(/\D/g, ''), 10) || 0
    : 0;
  return `PO-${String(maxNum + 1).padStart(4, '0')}`;
}

export const productionOrderService = {
  async listByCompany(
    companyId: string,
    options?: { status?: string; limit?: number }
  ): Promise<ProductionOrderRow[]> {
    let q = supabase
      .from('production_orders')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (options?.status) q = q.eq('status', options.status);
    if (options?.limit) q = q.limit(options.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as ProductionOrderRow[];
  },

  async getById(id: string): Promise<ProductionOrderRow | null> {
    const { data, error } = await supabase
      .from('production_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as ProductionOrderRow | null;
  },

  async create(payload: {
    company_id: string;
    branch_id?: string | null;
    product_id: string;
    quantity: number;
    status?: string;
    start_date?: string | null;
    end_date?: string | null;
  }): Promise<ProductionOrderRow> {
    const order_number = await nextOrderNumber(payload.company_id);
    const { data, error } = await supabase
      .from('production_orders')
      .insert({
        company_id: payload.company_id,
        branch_id: payload.branch_id ?? null,
        product_id: payload.product_id,
        quantity: payload.quantity ?? 1,
        status: payload.status ?? 'draft',
        start_date: payload.start_date ?? null,
        end_date: payload.end_date ?? null,
        order_number,
      })
      .select()
      .single();
    if (error) throw error;
    return data as ProductionOrderRow;
  },

  async update(
    id: string,
    updates: {
      quantity?: number;
      status?: string;
      start_date?: string | null;
      end_date?: string | null;
    }
  ): Promise<ProductionOrderRow> {
    const { data, error } = await supabase
      .from('production_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ProductionOrderRow;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('production_orders').delete().eq('id', id);
    if (error) throw error;
  },
};
