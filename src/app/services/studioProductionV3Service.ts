/**
 * Studio Production V3 Service (Safe Zone)
 * Uses only V3 tables: studio_production_orders_v3, studio_production_stages_v3,
 * studio_production_cost_breakdown_v3. Does NOT modify V2 or legacy tables.
 */

import { supabase } from '@/lib/supabase';

export type StudioProductionOrderV3Status = 'draft' | 'in_progress' | 'completed' | 'cancelled';
export type StudioProductionStageV3Status = 'pending' | 'assigned' | 'in_progress' | 'completed';

export interface StudioProductionOrderV3 {
  id: string;
  production_no: string;
  customer_id: string | null;
  sale_id: string;
  product_id: string | null;
  fabric: string | null;
  design_notes: string | null;
  deadline: string | null;
  status: StudioProductionOrderV3Status;
  production_cost: number;
  profit_percent: number | null;
  profit_amount: number | null;
  final_price: number | null;
  generated_invoice_id: string | null;
  branch_id: string;
  company_id: string;
  created_at: string;
}

export interface StudioProductionStageV3 {
  id: string;
  order_id: string;
  stage_name: string;
  worker_id: string | null;
  expected_cost: number;
  actual_cost: number;
  status: StudioProductionStageV3Status;
  sort_order: number;
  created_at: string;
}

export interface StudioProductionCostBreakdownV3 {
  id: string;
  production_id: string;
  stage_name: string;
  worker_name: string | null;
  worker_cost: number;
  type: 'worker_cost' | 'profit';
}

const DEFAULT_STAGE_NAMES = ['Dyeing', 'Stitching', 'Handwork', 'Embroidery', 'Finishing'];

export const studioProductionV3Service = {
  async getOrdersByCompany(companyId: string, branchId?: string): Promise<StudioProductionOrderV3[]> {
    let q = supabase
      .from('studio_production_orders_v3')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (branchId) q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as StudioProductionOrderV3[];
  },

  async getOrderById(orderId: string): Promise<StudioProductionOrderV3 | null> {
    const { data, error } = await supabase
      .from('studio_production_orders_v3')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    return data as StudioProductionOrderV3 | null;
  },

  async getOrdersBySaleId(saleId: string): Promise<StudioProductionOrderV3[]> {
    const { data, error } = await supabase
      .from('studio_production_orders_v3')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as StudioProductionOrderV3[];
  },

  async createOrder(params: {
    companyId: string;
    branchId: string;
    saleId: string;
    productionNo: string;
    customerId?: string | null;
    fabric?: string | null;
    designNotes?: string | null;
    deadline?: string | null;
  }): Promise<StudioProductionOrderV3> {
    const { data, error } = await supabase
      .from('studio_production_orders_v3')
      .insert({
        company_id: params.companyId,
        branch_id: params.branchId,
        sale_id: params.saleId,
        production_no: params.productionNo,
        customer_id: params.customerId ?? null,
        fabric: params.fabric ?? null,
        design_notes: params.designNotes ?? null,
        deadline: params.deadline ?? null,
        status: 'draft',
        production_cost: 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data as StudioProductionOrderV3;
  },

  async updateOrder(
    orderId: string,
    updates: Partial<Pick<StudioProductionOrderV3, 'fabric' | 'design_notes' | 'deadline' | 'status' | 'production_cost' | 'profit_percent' | 'profit_amount' | 'final_price' | 'generated_invoice_id' | 'product_id'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('studio_production_orders_v3')
      .update(updates)
      .eq('id', orderId);
    if (error) throw error;
  },

  async getStagesByOrderId(orderId: string): Promise<StudioProductionStageV3[]> {
    const { data, error } = await supabase
      .from('studio_production_stages_v3')
      .select('*')
      .eq('order_id', orderId)
      .order('sort_order');
    if (error) throw error;
    return (data ?? []) as StudioProductionStageV3[];
  },

  async createStage(orderId: string, stageName: string, sortOrder: number): Promise<StudioProductionStageV3> {
    const { data, error } = await supabase
      .from('studio_production_stages_v3')
      .insert({
        order_id: orderId,
        stage_name: stageName,
        status: 'pending',
        sort_order: sortOrder,
        expected_cost: 0,
        actual_cost: 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data as StudioProductionStageV3;
  },

  async updateStage(
    stageId: string,
    updates: Partial<Pick<StudioProductionStageV3, 'worker_id' | 'expected_cost' | 'actual_cost' | 'status'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('studio_production_stages_v3')
      .update(updates)
      .eq('id', stageId);
    if (error) throw error;
  },

  async assignWorker(stageId: string, workerId: string, expectedCost?: number): Promise<void> {
    await this.updateStage(stageId, {
      worker_id: workerId,
      expected_cost: expectedCost ?? 0,
      status: 'assigned',
    });
  },

  async completeStage(stageId: string, actualCost: number): Promise<void> {
    await this.updateStage(stageId, { actual_cost: actualCost, status: 'completed' });
  },

  /** Recompute production_cost from stages and persist on order */
  async recalculateProductionCost(orderId: string): Promise<number> {
    const stages = await this.getStagesByOrderId(orderId);
    const total = stages.reduce((sum, s) => sum + (Number(s.actual_cost) || 0), 0);
    await this.updateOrder(orderId, { production_cost: total });
    return total;
  },

  async getCostBreakdownByOrderId(orderId: string): Promise<StudioProductionCostBreakdownV3[]> {
    const { data, error } = await supabase
      .from('studio_production_cost_breakdown_v3')
      .select('*')
      .eq('production_id', orderId)
      .order('id');
    if (error) throw error;
    return (data ?? []) as StudioProductionCostBreakdownV3[];
  },

  async saveCostBreakdown(
    orderId: string,
    rows: { stage_name: string; worker_name: string | null; worker_cost: number; type: 'worker_cost' | 'profit' }[]
  ): Promise<void> {
    await supabase.from('studio_production_cost_breakdown_v3').delete().eq('production_id', orderId);
    if (rows.length === 0) return;
    const { error } = await supabase.from('studio_production_cost_breakdown_v3').insert(
      rows.map((r) => ({
        production_id: orderId,
        stage_name: r.stage_name,
        worker_name: r.worker_name ?? null,
        worker_cost: r.worker_cost,
        type: r.type,
      }))
    );
    if (error) throw error;
  },

  getDefaultStageNames(): string[] {
    return [...DEFAULT_STAGE_NAMES];
  },
};

/**
 * Ensure every STD-* sale has a V3 production order and default stages.
 * Idempotent; does not duplicate.
 */
export async function ensureStudioProductionV3OrdersForCompany(
  companyId: string,
  branchId?: string | null
): Promise<{ created: number }> {
  const { data: sales, error: salesErr } = await supabase
    .from('sales')
    .select('id, company_id, branch_id, invoice_no, customer_id')
    .eq('company_id', companyId)
    .ilike('invoice_no', 'STD-%')
    .neq('status', 'cancelled');

  if (salesErr || !sales?.length) return { created: 0 };

  const salesList = sales as { id: string; company_id: string; branch_id: string; invoice_no: string; customer_id?: string }[];
  const { data: existing } = await supabase
    .from('studio_production_orders_v3')
    .select('id, sale_id')
    .eq('company_id', companyId)
    .in('sale_id', salesList.map((s) => s.id));

  const existingBySaleId = new Map((existing ?? []).map((r: { sale_id: string }) => [r.sale_id, true]));
  let created = 0;

  for (const sale of salesList) {
    if (existingBySaleId.get(sale.id)) continue;
    try {
      const productionNo = sale.invoice_no || `STD-${sale.id.slice(0, 8)}`;
      await studioProductionV3Service.createOrder({
        companyId: sale.company_id,
        branchId: sale.branch_id,
        saleId: sale.id,
        productionNo,
        customerId: sale.customer_id ?? null,
      });
      const order = await supabase
        .from('studio_production_orders_v3')
        .select('id')
        .eq('sale_id', sale.id)
        .single();
      const orderId = (order.data as { id: string } | null)?.id;
      if (orderId) {
        const names = studioProductionV3Service.getDefaultStageNames();
        for (let i = 0; i < names.length; i++) {
          await studioProductionV3Service.createStage(orderId, names[i], i);
        }
      }
      created++;
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('[V3] ensureOrder failed for sale', sale.id, e);
    }
  }
  return { created };
}
