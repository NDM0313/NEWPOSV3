/**
 * Studio Production V2 Service (Safe Zone)
 * Uses only V2 tables: studio_production_orders_v2, studio_production_stages_v2,
 * studio_stage_assignments_v2, studio_stage_receipts_v2.
 * Legacy studioProductionService is NOT modified or called from here.
 */

import { supabase } from '@/lib/supabase';

export type StudioProductionOrderV2Status = 'draft' | 'in_progress' | 'completed' | 'cancelled';
export type StudioProductionStageV2Status = 'pending' | 'assigned' | 'in_progress' | 'completed';
export type StudioStageTypeV2 = 'dyer' | 'stitching' | 'handwork' | 'embroidery' | 'finishing' | 'quality_check';

export interface StudioProductionOrderV2 {
  id: string;
  company_id: string;
  branch_id: string;
  sale_id: string;
  production_no: string;
  status: StudioProductionOrderV2Status;
  customer_invoice_generated?: boolean;
  generated_sale_id?: string | null;
  product_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudioProductionStageV2 {
  id: string;
  order_id: string;
  stage_type: StudioStageTypeV2;
  status: StudioProductionStageV2Status;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StudioStageAssignmentV2 {
  id: string;
  stage_id: string;
  assigned_worker_id: string;
  expected_cost: number;
  assigned_at: string;
  assigned_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudioStageReceiptV2 {
  id: string;
  stage_id: string;
  actual_cost: number;
  received_at: string;
  received_by?: string | null;
  notes?: string | null;
  created_at: string;
}

export const studioProductionV2Service = {
  async getOrdersByCompany(companyId: string, branchId?: string): Promise<StudioProductionOrderV2[]> {
    let q = supabase
      .from('studio_production_orders_v2')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (branchId) q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as StudioProductionOrderV2[];
  },

  async getOrdersBySaleId(saleId: string): Promise<StudioProductionOrderV2[]> {
    const { data, error } = await supabase
      .from('studio_production_orders_v2')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as StudioProductionOrderV2[];
  },

  async getOrderById(orderId: string): Promise<StudioProductionOrderV2 | null> {
    const { data, error } = await supabase
      .from('studio_production_orders_v2')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    return data as StudioProductionOrderV2 | null;
  },

  async createOrder(params: {
    companyId: string;
    branchId: string;
    saleId: string;
    productionNo: string;
  }): Promise<StudioProductionOrderV2> {
    const { data, error } = await supabase
      .from('studio_production_orders_v2')
      .insert({
        company_id: params.companyId,
        branch_id: params.branchId,
        sale_id: params.saleId,
        production_no: params.productionNo,
        status: 'draft',
      })
      .select()
      .single();
    if (error) throw error;
    return data as StudioProductionOrderV2;
  },

  async updateOrderStatus(orderId: string, status: StudioProductionOrderV2Status): Promise<void> {
    const { error } = await supabase
      .from('studio_production_orders_v2')
      .update({ status })
      .eq('id', orderId);
    if (error) throw error;
  },

  async getStagesByOrderId(orderId: string): Promise<StudioProductionStageV2[]> {
    const { data, error } = await supabase
      .from('studio_production_stages_v2')
      .select('*')
      .eq('order_id', orderId)
      .order('sort_order');
    if (error) throw error;
    return (data ?? []) as StudioProductionStageV2[];
  },

  async createStage(orderId: string, stageType: StudioStageTypeV2, sortOrder: number): Promise<StudioProductionStageV2> {
    const { data, error } = await supabase
      .from('studio_production_stages_v2')
      .insert({ order_id: orderId, stage_type: stageType, sort_order: sortOrder, status: 'pending' })
      .select()
      .single();
    if (error) throw error;
    return data as StudioProductionStageV2;
  },

  async getAssignmentByStageId(stageId: string): Promise<StudioStageAssignmentV2 | null> {
    const { data, error } = await supabase
      .from('studio_stage_assignments_v2')
      .select('*')
      .eq('stage_id', stageId)
      .maybeSingle();
    if (error) throw error;
    return data as StudioStageAssignmentV2 | null;
  },

  async assignWorker(params: {
    stageId: string;
    workerId: string;
    expectedCost?: number;
    assignedBy?: string | null;
  }): Promise<StudioStageAssignmentV2> {
    const { data, error } = await supabase
      .from('studio_stage_assignments_v2')
      .upsert(
        {
          stage_id: params.stageId,
          assigned_worker_id: params.workerId,
          expected_cost: params.expectedCost ?? 0,
          assigned_by: params.assignedBy ?? null,
        },
        { onConflict: 'stage_id' }
      )
      .select()
      .single();
    if (error) throw error;
    await supabase
      .from('studio_production_stages_v2')
      .update({ status: 'assigned' })
      .eq('id', params.stageId);
    return data as StudioStageAssignmentV2;
  },

  async getReceiptByStageId(stageId: string): Promise<StudioStageReceiptV2 | null> {
    const { data, error } = await supabase
      .from('studio_stage_receipts_v2')
      .select('*')
      .eq('stage_id', stageId)
      .maybeSingle();
    if (error) throw error;
    return data as StudioStageReceiptV2 | null;
  },

  async receiveStage(params: {
    stageId: string;
    actualCost: number;
    receivedBy?: string | null;
    notes?: string | null;
  }): Promise<StudioStageReceiptV2> {
    const { data, error } = await supabase
      .from('studio_stage_receipts_v2')
      .upsert(
        {
          stage_id: params.stageId,
          actual_cost: params.actualCost,
          received_by: params.receivedBy ?? null,
          notes: params.notes ?? null,
        },
        { onConflict: 'stage_id' }
      )
      .select()
      .single();
    if (error) throw error;
    await supabase
      .from('studio_production_stages_v2')
      .update({ status: 'completed' })
      .eq('id', params.stageId);
    return data as StudioStageReceiptV2;
  },
};

/** Map legacy stage status to V2 (pending | assigned | in_progress | completed). */
function mapLegacyStageStatusToV2(legacy: string): StudioProductionStageV2Status {
  const s = (legacy || '').toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'assigned') return 'assigned';
  if (s === 'pending') return 'pending';
  return 'in_progress'; // in_progress, sent_to_worker, received
}

/** Map legacy production status to V2. */
function mapLegacyOrderStatusToV2(legacy: string): StudioProductionOrderV2Status {
  const s = (legacy || '').toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'in_progress' || s === 'in progress') return 'in_progress';
  return 'draft';
}

/**
 * Ensure every studio sale (STD-*) has a V2 production order and migrate legacy production
 * data (stages, workers, costs, status) so Pipeline shows correct stage count and status.
 * Idempotent: safe to run multiple times; does not duplicate stages.
 */
export async function ensureStudioProductionV2OrdersForCompany(
  companyId: string,
  branchId?: string | null
): Promise<{ created: number; migrated: number }> {
  const { data: sales, error: salesErr } = await supabase
    .from('sales')
    .select('id, company_id, branch_id, invoice_no')
    .eq('company_id', companyId)
    .ilike('invoice_no', 'STD-%')
    .neq('status', 'cancelled');

  if (salesErr || !sales?.length) return { created: 0, migrated: 0 };

  const salesList = sales as { id: string; company_id: string; branch_id: string; invoice_no: string }[];

  let q = supabase
    .from('studio_production_orders_v2')
    .select('id, sale_id')
    .eq('company_id', companyId);
  if (branchId && branchId !== 'all') q = q.eq('branch_id', branchId);
  const { data: v2Orders } = await q;
  const v2BySaleId = new Map<string, { id: string }>((v2Orders || []).map((r: { id: string; sale_id: string }) => [r.sale_id, { id: r.id }]));

  const { data: legacyProds } = await supabase
    .from('studio_productions')
    .select('id, sale_id, status')
    .in('sale_id', salesList.map((s) => s.id));

  const legacyBySaleId = new Map<string, { id: string; status: string }>(
    (legacyProds || []).map((p: { id: string; sale_id: string; status: string }) => [p.sale_id, { id: p.id, status: p.status }])
  );

  let created = 0;
  let migrated = 0;

  for (const sale of salesList) {
    let v2OrderId = v2BySaleId.get(sale.id)?.id;
    const legacyProd = legacyBySaleId.get(sale.id);

    if (!v2OrderId) {
      const productionNo = `PRD-${sale.invoice_no || sale.id.slice(0, 8)}`;
      try {
        const order = await studioProductionV2Service.createOrder({
          companyId: sale.company_id,
          branchId: sale.branch_id,
          saleId: sale.id,
          productionNo,
        });
        v2OrderId = order.id;
        v2BySaleId.set(sale.id, { id: v2OrderId });
        created++;
      } catch (e) {
        if (import.meta.env?.DEV) console.warn('[V2] ensureOrder failed for sale', sale.id, e);
        continue;
      }
    }

    if (!legacyProd) continue;

    const { data: existingStages } = await supabase
      .from('studio_production_stages_v2')
      .select('id')
      .eq('order_id', v2OrderId)
      .limit(1);
    if (existingStages && existingStages.length > 0) continue;

    const { data: legacyStages } = await supabase
      .from('studio_production_stages')
      .select('id, stage_type, status, assigned_worker_id, cost, expected_cost, completed_at, assigned_at')
      .eq('production_id', legacyProd.id)
      .order('stage_type');

    if (!legacyStages?.length) {
      const v2Status = mapLegacyOrderStatusToV2(legacyProd.status);
      await supabase.from('studio_production_orders_v2').update({ status: v2Status }).eq('id', v2OrderId);
      continue;
    }

    const sortOrderByType: Record<string, number> = { dyer: 1, stitching: 2, handwork: 3, embroidery: 4, finishing: 5, quality_check: 6 };
    let sortOrder = 0;
    for (const ls of legacyStages as Array<{
      id: string;
      stage_type: string;
      status: string;
      assigned_worker_id: string | null;
      cost: number;
      expected_cost?: number | null;
      completed_at: string | null;
      assigned_at?: string | null;
    }>) {
      const stageType = (ls.stage_type || '').toLowerCase();
      if (!['dyer', 'stitching', 'handwork', 'embroidery', 'finishing', 'quality_check'].includes(stageType)) continue;
      sortOrder = sortOrderByType[stageType] ?? sortOrder + 1;

      const { data: v2Stage, error: stageErr } = await supabase
        .from('studio_production_stages_v2')
        .insert({
          order_id: v2OrderId,
          stage_type: stageType,
          status: mapLegacyStageStatusToV2(ls.status),
          sort_order: sortOrder,
        })
        .select('id')
        .single();

      if (stageErr || !v2Stage?.id) continue;

      if (ls.assigned_worker_id) {
        await supabase.from('studio_stage_assignments_v2').upsert(
          {
            stage_id: v2Stage.id,
            assigned_worker_id: ls.assigned_worker_id,
            expected_cost: Number(ls.expected_cost ?? ls.cost ?? 0),
            assigned_at: ls.assigned_at || new Date().toISOString(),
          },
          { onConflict: 'stage_id' }
        );
      }

      if (ls.status === 'completed' && (Number(ls.cost) || 0) >= 0) {
        await supabase.from('studio_stage_receipts_v2').upsert(
          {
            stage_id: v2Stage.id,
            actual_cost: Number(ls.cost) || 0,
            received_at: ls.completed_at || new Date().toISOString(),
          },
          { onConflict: 'stage_id' }
        );
      }
    }

    const v2Status = mapLegacyOrderStatusToV2(legacyProd.status);
    await supabase.from('studio_production_orders_v2').update({ status: v2Status }).eq('id', v2OrderId);
    migrated++;
  }

  return { created, migrated };
}
