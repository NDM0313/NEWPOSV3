/**
 * Studio Production Service
 * Production jobs: draft → in_progress → completed / cancelled
 * Inventory impact ONLY when status = completed (finished goods ADD via stock_movements)
 * Audit: studio_production_logs for create/update/status_change
 */

import { supabase } from '@/lib/supabase';
import { productService } from '@/app/services/productService';

export type StudioProductionStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';

export interface StudioProduction {
  id: string;
  company_id: string;
  branch_id: string;
  sale_id?: string | null;
  production_no: string;
  production_date: string;
  product_id: string;
  variation_id?: string | null;
  quantity: number;
  boxes?: number | null;
  pieces?: number | null;
  unit: string;
  estimated_cost: number;
  actual_cost: number;
  status: StudioProductionStatus;
  start_date?: string | null;
  expected_date?: string | null;
  completed_at?: string | null;
  assigned_worker_id?: string | null;
  assigned_machine_or_karigar?: string | null;
  notes?: string | null;
  instructions?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  product?: { id: string; name: string; sku?: string };
  worker?: { id: string; name: string };
}

export type StudioProductionStageType = 'dyer' | 'stitching' | 'handwork';
export type StudioProductionStageStatus = 'pending' | 'in_progress' | 'completed';

export interface StudioProductionStage {
  id: string;
  production_id: string;
  stage_type: StudioProductionStageType;
  assigned_worker_id?: string | null;
  cost: number;
  status: StudioProductionStageStatus;
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  worker?: { id: string; name: string };
}

export interface StudioProductionLog {
  id: string;
  production_id: string;
  action_type: string;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  performed_by?: string | null;
  performed_at: string;
}

export interface CreateProductionInput {
  company_id: string;
  branch_id: string;
  sale_id: string;
  production_no: string;
  production_date: string;
  product_id: string;
  variation_id?: string | null;
  quantity: number;
  boxes?: number | null;
  pieces?: number | null;
  unit?: string;
  estimated_cost?: number;
  actual_cost?: number;
  assigned_worker_id?: string | null;
  assigned_machine_or_karigar?: string | null;
  notes?: string | null;
  instructions?: string | null;
  start_date?: string | null;
  expected_date?: string | null;
  created_by?: string | null;
}

function logAction(
  productionId: string,
  actionType: string,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  performedBy?: string | null
) {
  return supabase.from('studio_production_logs').insert({
    production_id: productionId,
    action_type: actionType,
    old_value: oldValue,
    new_value: newValue,
    performed_by: performedBy || null,
  });
}

export const studioProductionService = {
  async getProductions(companyId: string, branchId?: string | null): Promise<StudioProduction[]> {
    try {
      let query = supabase
        .from('studio_productions')
        .select(`
          *,
          product:products(id, name, sku),
          worker:workers(id, name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (branchId && branchId !== 'all') {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) return [];
        throw error;
      }
      return (data || []) as StudioProduction[];
    } catch (e: any) {
      if (e?.code === 'PGRST204' || e?.message?.includes('relation') || e?.message?.includes('does not exist'))
        return [];
      throw e;
    }
  },

  async getProductionById(id: string): Promise<StudioProduction | null> {
    const { data, error } = await supabase
      .from('studio_productions')
      .select(`
        *,
        product:products(id, name, sku),
        worker:workers(id, name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data as StudioProduction;
  },

  async getProductionsBySaleId(saleId: string): Promise<StudioProduction[]> {
    try {
      const { data, error } = await supabase
        .from('studio_productions')
        .select(`*, product:products(id, name, sku), worker:workers(id, name)`)
        .eq('sale_id', saleId)
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('sale_id')) return [];
        throw error;
      }
      return (data || []) as StudioProduction[];
    } catch (e: any) {
      if (e?.code === '42703' || e?.message?.includes('sale_id')) return [];
      throw e;
    }
  },

  async createProductionJob(input: CreateProductionInput): Promise<StudioProduction> {
    if (!input.sale_id) throw new Error('Sale is required. Studio production must be linked to a sale.');
    const payload = {
      company_id: input.company_id,
      branch_id: input.branch_id,
      sale_id: input.sale_id,
      production_no: input.production_no,
      production_date: input.production_date,
      product_id: input.product_id,
      variation_id: input.variation_id ?? null,
      quantity: input.quantity,
      boxes: input.boxes ?? null,
      pieces: input.pieces ?? null,
      unit: input.unit ?? 'piece',
      estimated_cost: input.estimated_cost ?? 0,
      actual_cost: input.actual_cost ?? 0,
      status: 'draft' as const,
      start_date: input.start_date ?? null,
      expected_date: input.expected_date ?? null,
      assigned_worker_id: input.assigned_worker_id ?? null,
      assigned_machine_or_karigar: input.assigned_machine_or_karigar ?? null,
      notes: input.notes ?? null,
      instructions: input.instructions ?? null,
      created_by: input.created_by ?? null,
    };

    const { data, error } = await supabase
      .from('studio_productions')
      .insert(payload)
      .select(`
        *,
        product:products(id, name, sku),
        worker:workers(id, name)
      `)
      .single();

    if (error) throw error;

    await logAction(
      data.id,
      'created',
      null,
      payload as unknown as Record<string, unknown>,
      input.created_by ?? null
    ).then(({ error: logErr }) => { if (logErr) console.warn('[studio_production_logs]', logErr); });

    return data as StudioProduction;
  },

  async updateProductionJob(
    id: string,
    updates: Partial<Omit<StudioProduction, 'id' | 'company_id' | 'production_no' | 'created_at'>>,
    performedBy?: string | null
  ): Promise<StudioProduction> {
    const existing = await this.getProductionById(id);
    if (!existing) throw new Error('Production not found');
    if (existing.status === 'completed') throw new Error('Completed production cannot be edited (admin override not implemented)');

    const allowed: Record<string, unknown> = {};
    const keys = [
      'production_date', 'product_id', 'variation_id', 'quantity', 'boxes', 'pieces', 'unit',
      'estimated_cost', 'actual_cost', 'start_date', 'expected_date', 'assigned_worker_id',
      'assigned_machine_or_karigar', 'notes', 'instructions',
    ] as const;
    keys.forEach(k => { if (updates[k] !== undefined) allowed[k] = updates[k]; });

    const { data, error } = await supabase
      .from('studio_productions')
      .update(allowed)
      .eq('id', id)
      .select(`
        *,
        product:products(id, name, sku),
        worker:workers(id, name)
      `)
      .single();

    if (error) throw error;

    await logAction(
      id,
      'updated',
      existing as unknown as Record<string, unknown>,
      allowed,
      performedBy ?? null
    ).then(({ error: logErr }) => { if (logErr) console.warn('[studio_production_logs]', logErr); });

    return data as StudioProduction;
  },

  async changeProductionStatus(
    id: string,
    newStatus: StudioProductionStatus,
    performedBy?: string | null
  ): Promise<StudioProduction> {
    const existing = await this.getProductionById(id);
    if (!existing) throw new Error('Production not found');

    const oldStatus = existing.status;
    if (oldStatus === newStatus) return existing;

    if (newStatus === 'completed') {
      if (oldStatus === 'cancelled') throw new Error('Cancelled production cannot be completed');
      // Option A: Production must be linked to a sale to complete.
      const saleId = existing.sale_id;
      if (!saleId) throw new Error('Production must be linked to a sale to complete. Link this production to a sale first.');

      // Stages: if any exist, all must be completed; sum costs for studio_charges and worker ledger.
      const stages = await this.getStagesByProductionId(id);
      let studioCharges = 0;
      if (stages.length > 0) {
        const notCompleted = stages.filter(s => (s as any).status !== 'completed');
        if (notCompleted.length > 0) throw new Error('All production stages must be completed before completing production.');
        studioCharges = stages.reduce((sum, s) => sum + (Number((s as any).cost) || 0), 0);
      }

      // Update sale: studio_charges and total (customer bill includes studio charges).
      const { data: saleRow, error: saleFetchErr } = await supabase
        .from('sales')
        .select('id, total, company_id')
        .eq('id', saleId)
        .single();
      if (saleFetchErr || !saleRow) throw new Error('Linked sale not found. Cannot complete production.');
      const currentTotal = Number(saleRow.total) || 0;
      const newTotal = currentTotal + studioCharges;
      const { error: saleUpdateErr } = await supabase
        .from('sales')
        .update({
          studio_charges: studioCharges,
          total: newTotal,
          status: 'final',
        })
        .eq('id', saleId);
      if (saleUpdateErr) throw new Error(`Failed to update sale with studio charges: ${saleUpdateErr.message}`);

      // Worker ledger: one entry per stage (worker cost). Separate from customer payments.
      const companyIdForLedger = (saleRow as any).company_id || existing.company_id;
      for (const stage of stages) {
        const workerId = (stage as any).assigned_worker_id;
        const amount = Number((stage as any).cost) || 0;
        if (workerId && amount > 0) {
          const { error: ledgerErr } = await supabase.from('worker_ledger_entries').insert({
            company_id: companyIdForLedger,
            worker_id: workerId,
            amount,
            reference_type: 'studio_production_stage',
            reference_id: (stage as any).id,
            notes: `Studio production ${existing.production_no} – stage completed`,
          });
          if (ledgerErr) console.warn('[worker_ledger_entries]', ledgerErr);
        }
      }

      // Inventory: add finished goods ONLY when production is completed (controlled).
      const qty = Number(existing.quantity) || 0;
      if (qty > 0) {
        const movementType = 'PRODUCTION_IN';
        const insertPayload: Record<string, unknown> = {
          company_id: existing.company_id,
          branch_id: existing.branch_id,
          product_id: existing.product_id,
          movement_type: movementType,
          quantity: qty,
          unit_cost: existing.actual_cost ? Number(existing.actual_cost) / qty : 0,
          total_cost: existing.actual_cost ?? 0,
          reference_type: 'studio_production',
          reference_id: id,
          notes: `Production ${existing.production_no} completed`,
          created_by: performedBy ?? null,
        };
        const { error: movErr } = await supabase.from('stock_movements').insert(insertPayload);
        if (movErr) throw new Error(`Inventory update failed: ${movErr.message}`);
        const product = await productService.getProduct(existing.product_id);
        if (product?.id) {
          const newStock = (Number(product.current_stock) || 0) + qty;
          await productService.updateProduct(existing.product_id, { current_stock: newStock });
        }
      }
    }
    // cancelled: no inventory impact

    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'completed') updatePayload.completed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('studio_productions')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        product:products(id, name, sku),
        worker:workers(id, name)
      `)
      .single();

    if (error) throw error;

    await logAction(
      id,
      'status_changed',
      { status: oldStatus },
      { status: newStatus, completed_at: (updatePayload as any).completed_at },
      performedBy ?? null
    ).then(({ error: logErr }) => { if (logErr) console.warn('[studio_production_logs]', logErr); });

    return data as StudioProduction;
  },

  async deleteProductionJob(id: string): Promise<void> {
    const existing = await this.getProductionById(id);
    if (!existing) throw new Error('Production not found');
    if (existing.status !== 'draft') throw new Error('Only draft productions can be deleted');
    const { error } = await supabase.from('studio_productions').delete().eq('id', id);
    if (error) throw error;
  },

  async getProductionLogs(productionId: string): Promise<StudioProductionLog[]> {
    const { data, error } = await supabase
      .from('studio_production_logs')
      .select('*')
      .eq('production_id', productionId)
      .order('performed_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) return [];
      throw error;
    }
    return (data || []) as StudioProductionLog[];
  },

  /** Stages for a production (Dyer, Stitching, Handwork). Used for completion and worker ledger. */
  async getStagesByProductionId(productionId: string): Promise<StudioProductionStage[]> {
    try {
      const { data, error } = await supabase
        .from('studio_production_stages')
        .select('*, worker:workers(id, name)')
        .eq('production_id', productionId)
        .order('created_at', { ascending: true });
      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) return [];
        throw error;
      }
      return (data || []) as StudioProductionStage[];
    } catch (e: any) {
      if (e?.code === '42P01' || e?.message?.includes('does not exist')) return [];
      throw e;
    }
  },

  /** Create a stage (process step) for a production. Manager assigns worker and estimated cost. */
  async createStage(
    productionId: string,
    input: { stage_type: StudioProductionStageType; assigned_worker_id?: string | null; cost: number; notes?: string | null }
  ): Promise<StudioProductionStage> {
    const { data, error } = await supabase
      .from('studio_production_stages')
      .insert({
        production_id: productionId,
        stage_type: input.stage_type,
        assigned_worker_id: input.assigned_worker_id ?? null,
        cost: input.cost,
        status: 'pending',
        notes: input.notes ?? null,
      })
      .select('*, worker:workers(id, name)')
      .single();
    if (error) throw error;
    return data as StudioProductionStage;
  },

  /** Update stage (e.g. set actual cost, mark completed). */
  async updateStage(
    stageId: string,
    updates: { status?: StudioProductionStageStatus; cost?: number; completed_at?: string | null; notes?: string | null }
  ): Promise<StudioProductionStage> {
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.cost !== undefined) payload.cost = updates.cost;
    if (updates.completed_at !== undefined) payload.completed_at = updates.completed_at;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (Object.keys(payload).length === 0) {
      const existing = await supabase.from('studio_production_stages').select('*').eq('id', stageId).single();
      if (existing.data) return existing.data as StudioProductionStage;
      throw new Error('Stage not found');
    }
    const { data, error } = await supabase
      .from('studio_production_stages')
      .update(payload)
      .eq('id', stageId)
      .select('*, worker:workers(id, name)')
      .single();
    if (error) throw error;
    return data as StudioProductionStage;
  },
};
