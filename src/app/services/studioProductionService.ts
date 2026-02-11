/**
 * Studio Production Service
 * Production jobs: draft → in_progress → completed / cancelled
 * Inventory impact ONLY when status = completed (finished goods ADD via stock_movements)
 * Audit: studio_production_logs for create/update/status_change
 */

import { supabase } from '@/lib/supabase';
import { productService } from '@/app/services/productService';
import { settingsService } from '@/app/services/settingsService';

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
  expected_completion_date?: string | null;
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
      const saleId = existing.sale_id;
      if (!saleId) throw new Error('Production must be linked to a sale to complete. Link this production to a sale first.');

      const stages = await this.getStagesByProductionId(id);
      let studioCharges = 0;
      if (stages.length > 0) {
        const notCompleted = stages.filter(s => (s as any).status !== 'completed');
        if (notCompleted.length > 0) throw new Error('All production stages must be completed before completing production.');
        studioCharges = stages.reduce((sum, s) => sum + (Number((s as any).cost) || 0), 0);
      }

      const { data: saleRow, error: saleFetchErr } = await supabase
        .from('sales')
        .select('id, total, company_id')
        .eq('id', saleId)
        .single();
      if (saleFetchErr || !saleRow) throw new Error('Linked sale not found. Cannot complete production.');
      const companyIdForLedger = (saleRow as any).company_id || existing.company_id;

      // Order: ledger first, then inventory, then sale, then production status (so failure doesn't leave inconsistent state).
      // 1. Worker ledger (idempotent: skip if entry already exists for this stage).
      for (const stage of stages) {
        const workerId = (stage as any).assigned_worker_id;
        const amount = Number((stage as any).cost) || 0;
        if (workerId && amount > 0) {
          const { data: existingLedger } = await supabase
            .from('worker_ledger_entries')
            .select('id')
            .eq('reference_type', 'studio_production_stage')
            .eq('reference_id', (stage as any).id)
            .limit(1)
            .maybeSingle();
          if (!existingLedger) {
            let jobRef: string | null = null;
            try {
              jobRef = await settingsService.getNextDocumentNumber(
                companyIdForLedger,
                existing.branch_id || undefined,
                'job'
              );
            } catch (e) {
              console.warn('[studioProductionService] getNextDocumentNumber(job) failed:', e);
            }
            const insertPayload: Record<string, unknown> = {
              company_id: companyIdForLedger,
              worker_id: workerId,
              amount,
              reference_type: 'studio_production_stage',
              reference_id: (stage as any).id,
              notes: `Studio production ${existing.production_no} – stage completed`,
              ...(jobRef ? { document_no: jobRef } : {}),
            };
            const { error: ledgerErr } = await supabase.from('worker_ledger_entries').insert(insertPayload);
            if (ledgerErr) throw new Error(`Worker ledger failed: ${ledgerErr.message}`);
          }
        }
      }

      // 2. Inventory
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

      // 3. Sale: studio_charges and total
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

  /** Ledger status per stage (for Payable vs Paid). Returns {} if status column missing. */
  async getLedgerStatusForStages(stageIds: string[]): Promise<Record<string, 'unpaid' | 'paid'>> {
    if (stageIds.length === 0) return {};
    try {
      const { data, error } = await supabase
        .from('worker_ledger_entries')
        .select('reference_id, status')
        .eq('reference_type', 'studio_production_stage')
        .in('reference_id', stageIds);
      if (error) return {}; // e.g. column "status" does not exist before migration
      const out: Record<string, 'unpaid' | 'paid'> = {};
      (data || []).forEach((row: { reference_id: string; status?: string }) => {
        const st = (row.status || 'unpaid').toLowerCase();
        out[row.reference_id] = st === 'paid' ? 'paid' : 'unpaid';
      });
      return out;
    } catch {
      return {};
    }
  },

  /** Create a stage (process step) for a production. Manager assigns worker, estimated cost, expected date. */
  async createStage(
    productionId: string,
    input: {
      stage_type: StudioProductionStageType;
      assigned_worker_id?: string | null;
      cost: number;
      expected_completion_date?: string | null;
      notes?: string | null;
    }
  ): Promise<StudioProductionStage> {
    const production = await this.getProductionById(productionId);
    if (!production) throw new Error('Production not found');
    if (!production.sale_id) throw new Error('Production must be linked to a sale to add a stage.');
    const { data, error } = await supabase
      .from('studio_production_stages')
      .insert({
        production_id: productionId,
        stage_type: input.stage_type,
        assigned_worker_id: input.assigned_worker_id ?? null,
        cost: input.cost,
        expected_completion_date: input.expected_completion_date || null,
        status: 'pending',
        notes: input.notes ?? null,
      })
      .select('*, worker:workers(id, name)')
      .single();
    if (error) throw error;
    return data as StudioProductionStage;
  },

  /** Update stage (worker, cost, status, etc.). Completed stages: only notes allowed (cost lock). */
  /**
   * Sync worker_ledger_entries for a production: create missing entries for completed stages.
   * Call when loading production to fix stages that were completed via Save (not Receive).
   */
  async syncWorkerLedgerEntriesForProduction(productionId: string): Promise<void> {
    const { data: stages } = await supabase
      .from('studio_production_stages')
      .select('id, cost, assigned_worker_id, status')
      .eq('production_id', productionId);
    if (!stages?.length) return;
    for (const s of stages as any[]) {
      if (s.status === 'completed' && s.assigned_worker_id && Number(s.cost || 0) > 0) {
        await this.ensureWorkerLedgerEntryForStage(s.id, Number(s.cost), s.assigned_worker_id);
      }
    }
  },

  /**
   * Ensure worker_ledger_entry exists for a completed stage (when saved via persist, not Receive).
   * Called from updateStage when marking stage completed with cost + worker.
   */
  async ensureWorkerLedgerEntryForStage(stageId: string, cost: number, workerId: string): Promise<void> {
    if (!workerId || cost <= 0) return;
    const { data: existing } = await supabase
      .from('worker_ledger_entries')
      .select('id')
      .eq('reference_type', 'studio_production_stage')
      .eq('reference_id', stageId)
      .limit(1)
      .maybeSingle();
    if (existing) return;

    const { data: stageRow } = await supabase
      .from('studio_production_stages')
      .select('production_id')
      .eq('id', stageId)
      .single();
    if (!stageRow) return;
    const { data: prodRow } = await supabase
      .from('studio_productions')
      .select('id, company_id, branch_id, production_no')
      .eq('id', (stageRow as any).production_id)
      .single();
    if (!prodRow) return;
    const production = prodRow as any;

    let jobRef: string | null = null;
    try {
      jobRef = await settingsService.getNextDocumentNumber(
        production.company_id,
        production.branch_id || undefined,
        'job'
      );
    } catch {
      /* ignore */
    }
    const insertPayload: Record<string, unknown> = {
      company_id: production.company_id,
      worker_id: workerId,
      amount: cost,
      reference_type: 'studio_production_stage',
      reference_id: stageId,
      notes: `Studio production ${production.production_no} – stage completed`,
      status: 'unpaid',
      ...(jobRef ? { document_no: jobRef } : {}),
    };
    const { error: ledgerErr } = await supabase.from('worker_ledger_entries').insert(insertPayload);
    if (ledgerErr) {
      console.warn('[studioProductionService] ensureWorkerLedgerEntry failed:', ledgerErr.message);
      return;
    }
    const { data: workerRow } = await supabase.from('workers').select('current_balance').eq('id', workerId).single();
    const currentBalance = Number((workerRow as any)?.current_balance) || 0;
    await supabase.from('workers').update({ current_balance: currentBalance + cost, updated_at: new Date().toISOString() }).eq('id', workerId);
  },

  async updateStage(
    stageId: string,
    updates: {
      status?: StudioProductionStageStatus;
      cost?: number;
      completed_at?: string | null;
      notes?: string | null;
      assigned_worker_id?: string | null;
      expected_completion_date?: string | null;
    }
  ): Promise<StudioProductionStage> {
    const { data: existingRow } = await supabase.from('studio_production_stages').select('status').eq('id', stageId).single();
    if (!existingRow) throw new Error('Stage not found');
    const isCompleted = (existingRow as any).status === 'completed';
    const isReopening = isCompleted && updates.status === 'in_progress';
    if (isCompleted && !isReopening) {
      if (updates.status !== undefined && updates.status !== 'completed') throw new Error('Completed stage cannot be reopened.');
      if (updates.cost !== undefined) throw new Error('Completed stage cost is locked.');
      if (updates.completed_at !== undefined) throw new Error('Completed stage cannot be edited.');
      if (updates.assigned_worker_id !== undefined) throw new Error('Completed stage worker is locked.');
      if (updates.notes === undefined) return (await supabase.from('studio_production_stages').select('*, worker:workers(id, name)').eq('id', stageId).single()).data as StudioProductionStage;
    }
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.cost !== undefined) payload.cost = updates.cost;
    if (updates.completed_at !== undefined) payload.completed_at = updates.completed_at;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.assigned_worker_id !== undefined) payload.assigned_worker_id = updates.assigned_worker_id;
    if (updates.expected_completion_date !== undefined) payload.expected_completion_date = updates.expected_completion_date;
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
    const result = data as StudioProductionStage;

    // When marking completed via Save (not Receive): ensure worker_ledger_entry exists
    if (updates.status === 'completed') {
      const cost = updates.cost ?? result.cost ?? 0;
      const workerId = updates.assigned_worker_id ?? (result as any).assigned_worker_id ?? null;
      if (workerId && cost > 0) {
        await this.ensureWorkerLedgerEntryForStage(stageId, cost, workerId);
      }
    }
    return result;
  },

  /**
   * Receive from worker: mark stage completed with actual cost, add worker_ledger_entries as unpaid only.
   * No auto payment – user chooses Pay Now or Pay Later (Accounting → Worker Payments).
   * Returns { stage, ledgerEntryId } so UI can show "Pay Now?" and record payment against this entry.
   */
  async receiveStage(
    stageId: string,
    actualCost: number,
    notes?: string | null
  ): Promise<{ stage: StudioProductionStage; ledgerEntryId: string | null }> {
    const { data: stageRow, error: stageErr } = await supabase
      .from('studio_production_stages')
      .select('id, production_id, assigned_worker_id, status')
      .eq('id', stageId)
      .single();
    if (stageErr || !stageRow) throw new Error('Stage not found');
    const stage = stageRow as any;
    if (stage.status === 'completed') throw new Error('Stage already received/completed');

    const { data: prodRow, error: prodErr } = await supabase
      .from('studio_productions')
      .select('id, company_id, branch_id, production_no')
      .eq('id', stage.production_id)
      .single();
    if (prodErr || !prodRow) throw new Error('Production not found');
    const production = prodRow as any;

    const updated = await this.updateStage(stageId, {
      status: 'completed',
      cost: actualCost,
      completed_at: new Date().toISOString(),
      notes: notes ?? null,
    });

    let ledgerEntryId: string | null = null;
    const workerId = stage.assigned_worker_id;
    if (workerId && actualCost > 0) {
      const { data: existingLedger } = await supabase
        .from('worker_ledger_entries')
        .select('id')
        .eq('reference_type', 'studio_production_stage')
        .eq('reference_id', stageId)
        .limit(1)
        .maybeSingle();
      if (!existingLedger) {
        let jobRef: string | null = null;
        try {
          jobRef = await settingsService.getNextDocumentNumber(
            production.company_id,
            production.branch_id || undefined,
            'job'
          );
        } catch (e) {
          console.warn('[studioProductionService] getNextDocumentNumber(job) failed:', e);
        }
        const insertPayload: Record<string, unknown> = {
          company_id: production.company_id,
          worker_id: workerId,
          amount: actualCost,
          reference_type: 'studio_production_stage',
          reference_id: stageId,
          notes: notes || `Studio production ${production.production_no} – stage received`,
          status: 'unpaid',
          ...(jobRef ? { document_no: jobRef } : {}),
        };
        const { data: inserted, error: ledgerErr } = await supabase
          .from('worker_ledger_entries')
          .insert(insertPayload)
          .select('id')
          .single();
        if (ledgerErr) throw new Error(`Worker ledger failed: ${ledgerErr.message}`);
        ledgerEntryId = (inserted as any)?.id ?? null;
        // Increase worker's payable balance (amount we owe); reduced when user pays via markStageLedgerPaid
        const { data: workerRow } = await supabase.from('workers').select('current_balance').eq('id', workerId).single();
        const currentBalance = Number((workerRow as any)?.current_balance) || 0;
        await supabase.from('workers').update({ current_balance: currentBalance + actualCost, updated_at: new Date().toISOString() }).eq('id', workerId);
      }
    }

    return { stage: updated, ledgerEntryId };
  },

  /**
   * Mark worker ledger entry for a stage as paid (after user records payment via Pay Now or Accounting).
   * Updates ledger status and decrements worker current_balance.
   */
  async markStageLedgerPaid(stageId: string, paymentReference?: string | null): Promise<void> {
    const { data: ledgerRow, error: ledgerFindErr } = await supabase
      .from('worker_ledger_entries')
      .select('id, worker_id, amount, status')
      .eq('reference_type', 'studio_production_stage')
      .eq('reference_id', stageId)
      .limit(1)
      .maybeSingle();
    if (ledgerFindErr || !ledgerRow) throw new Error('Ledger entry for this stage not found');
    const entry = ledgerRow as { id: string; worker_id: string; amount: number; status?: string };
    if (entry.status === 'paid') return; // already paid
    const amount = Number(entry.amount) || 0;
    const { error: updateErr } = await supabase
      .from('worker_ledger_entries')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        ...(paymentReference != null && paymentReference !== '' ? { payment_reference: paymentReference } : {}),
      })
      .eq('id', entry.id);
    if (updateErr) throw new Error(`Ledger update failed: ${updateErr.message}`);
    if (amount > 0 && entry.worker_id) {
      const { data: workerRow } = await supabase.from('workers').select('current_balance').eq('id', entry.worker_id).single();
      const currentBalance = Number((workerRow as any)?.current_balance) || 0;
      const newBalance = Math.max(0, currentBalance - amount);
      await supabase.from('workers').update({ current_balance: newBalance, updated_at: new Date().toISOString() }).eq('id', entry.worker_id);
    }
  },

  /**
   * Record an accounting payment in worker ledger (Accounting → Pay Worker flow).
   * Inserts one row: amount, status=paid, reference_type=accounting_payment.
   * Used when user pays worker from Ledger/Accounting without a specific stage (generic payment).
   */
  async recordAccountingPaymentToLedger(params: {
    companyId: string;
    workerId: string;
    amount: number;
    paymentReference?: string | null;
    notes?: string | null;
    /** Optional: use journal entry id for reference_id when available (links journal ↔ worker ledger) */
    journalEntryId?: string | null;
  }): Promise<void> {
    const { companyId, workerId, amount, paymentReference, notes, journalEntryId } = params;
    if (!companyId || !workerId || amount <= 0) throw new Error('companyId, workerId, amount required');
    // reference_id must be UUID; prefer journalEntryId when available, else generate one
    const refId = journalEntryId || crypto.randomUUID();
    const { error } = await supabase.from('worker_ledger_entries').insert({
      company_id: companyId,
      worker_id: workerId,
      amount,
      reference_type: 'accounting_payment',
      reference_id: refId,
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_reference: paymentReference || null,
      notes: notes || `Payment via Accounting`,
    });
    if (error) throw new Error(`Worker ledger (accounting payment) failed: ${error.message}`);
    // Reduce worker's current_balance (amount we owe)
    const { data: workerRow } = await supabase.from('workers').select('current_balance').eq('id', workerId).single();
    const currentBalance = Number((workerRow as any)?.current_balance) || 0;
    const newBalance = Math.max(0, currentBalance - amount);
    await supabase.from('workers').update({ current_balance: newBalance, updated_at: new Date().toISOString() }).eq('id', workerId);
  },

  /**
   * Record a salary payment in worker ledger (Expenses → Salary flow).
   * Inserts one row: amount, status=paid, reference_type=salary, reference_id=expenseId.
   * Workers list Due Balance = sum(unpaid); this entry is paid so it only increases total earnings.
   */
  async recordSalaryPayment(params: {
    companyId: string;
    workerId: string;
    amount: number;
    expenseId: string;
    paymentReference?: string | null;
    notes?: string | null;
  }): Promise<void> {
    const { companyId, workerId, amount, expenseId, paymentReference, notes } = params;
    if (!companyId || !workerId || amount <= 0 || !expenseId) throw new Error('companyId, workerId, amount, expenseId required');
    const { error } = await supabase.from('worker_ledger_entries').insert({
      company_id: companyId,
      worker_id: workerId,
      amount,
      reference_type: 'salary',
      reference_id: expenseId,
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_reference: paymentReference || null,
      notes: notes || `Salary payment`,
    });
    if (error) throw new Error(`Worker ledger (salary) failed: ${error.message}`);
  },
};
