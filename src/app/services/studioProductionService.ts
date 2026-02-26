/**
 * Studio Production Service
 * Production jobs: draft → in_progress → completed / cancelled
 * Inventory impact ONLY when status = completed (finished goods ADD via stock_movements)
 * Audit: studio_production_logs for create/update/status_change
 */

import { supabase } from '@/lib/supabase';
import { productService } from '@/app/services/productService';
import { settingsService } from '@/app/services/settingsService';
import { accountHelperService } from '@/app/services/accountHelperService';
import { accountingService, type JournalEntry, type JournalEntryLine } from '@/app/services/accountingService';

/** Resolve worker name from contacts for a stage row (avoids workers table join which can 400). */
async function resolveStageWorker(stage: any): Promise<void> {
  if (!stage?.assigned_worker_id) return;
  const { data: c } = await supabase.from('contacts').select('id, name').eq('id', stage.assigned_worker_id).maybeSingle();
  if (c) stage.worker = { id: stage.assigned_worker_id, name: (c as any).name || '' };
}

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
export type StudioProductionStageStatus = 'pending' | 'assigned' | 'in_progress' | 'completed';

export interface StudioProductionStage {
  id: string;
  production_id: string;
  stage_type: StudioProductionStageType;
  assigned_worker_id?: string | null;
  cost: number;
  status: StudioProductionStageStatus;
  expected_cost?: number | null;
  assigned_at?: string | null;
  journal_entry_id?: string | null;
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

/** PHASE 3: Create journal entry Dr Production Expense (5000) Cr Worker Payable (2010). Links to stage + sale. */
async function createProductionCostJournalEntry(params: {
  companyId: string;
  branchId: string | null;
  stageId: string;
  productionNo: string;
  saleId: string | null;
  amount: number;
  stageType: string;
  performedBy?: string | null;
}): Promise<string | null> {
  const { companyId, branchId, stageId, productionNo, saleId, amount, stageType, performedBy } = params;
  if (amount <= 0) return null;
  const costAccount = await accountHelperService.getAccountByCode('5000', companyId);
  const payableAccount = await accountHelperService.getAccountByCode('2010', companyId);
  if (!costAccount?.id || !payableAccount?.id) {
    console.warn('[studioProductionService] Cost of Production (5000) or Worker Payable (2010) account not found');
    return null;
  }
  const entryNo = `JE-STD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const entryDate = new Date().toISOString().split('T')[0];
  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId || undefined,
    entry_no: entryNo,
    entry_date: entryDate,
    description: `Studio production ${productionNo} – ${stageType} stage completed`,
    reference_type: 'studio_production_stage',
    reference_id: stageId,
    created_by: performedBy || undefined,
  };
  const lines: JournalEntryLine[] = [
    { id: '', journal_entry_id: '', account_id: costAccount.id, debit: amount, credit: 0, description: `Production cost – ${stageType}` },
    { id: '', journal_entry_id: '', account_id: payableAccount.id, debit: 0, credit: amount, description: `Worker payable – ${stageType}` },
  ];
  const result = await accountingService.createEntry(entry, lines);
  return (result as any)?.id ?? null;
}

/** PHASE 4: Create reversal entry Dr Worker Payable Cr Production Expense (same amount). */
async function createProductionCostReversalEntry(params: {
  companyId: string;
  branchId: string | null;
  stageId: string;
  productionNo: string;
  amount: number;
  stageType: string;
  performedBy?: string | null;
}): Promise<string | null> {
  const { companyId, branchId, stageId, productionNo, amount, stageType, performedBy } = params;
  if (amount <= 0) return null;
  const costAccount = await accountHelperService.getAccountByCode('5000', companyId);
  const payableAccount = await accountHelperService.getAccountByCode('2010', companyId);
  if (!costAccount?.id || !payableAccount?.id) return null;
  const entryNo = `JE-STD-REV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const entryDate = new Date().toISOString().split('T')[0];
  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId || undefined,
    entry_no: entryNo,
    entry_date: entryDate,
    description: `Reversal: Studio ${productionNo} – ${stageType} stage reopened`,
    reference_type: 'studio_production_stage_reversal',
    reference_id: stageId,
    created_by: performedBy || undefined,
  };
  const lines: JournalEntryLine[] = [
    { id: '', journal_entry_id: '', account_id: payableAccount.id, debit: amount, credit: 0, description: `Reversal worker payable – ${stageType}` },
    { id: '', journal_entry_id: '', account_id: costAccount.id, debit: 0, credit: amount, description: `Reversal production cost – ${stageType}` },
  ];
  const result = await accountingService.createEntry(entry, lines);
  return (result as any)?.id ?? null;
}

export const studioProductionService = {
  async getProductions(companyId: string, branchId?: string | null): Promise<StudioProduction[]> {
    try {
      let query = supabase
        .from('studio_productions')
        .select(`
          *,
          product:products(id, name, sku),
          worker:workers(id, name),
          sale:sales(invoice_no)
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
        worker:workers(id, name),
        sale:sales(invoice_no)
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
        .select('id, total, paid_amount, company_id')
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

      // 3. Sale: studio_charges and due_amount (do NOT merge into total; balance_due = total + studio_charges - paid_amount)
      const currentTotal = Number(saleRow.total) || 0;
      const paidAmount = Number((saleRow as any).paid_amount) || 0;
      const dueAmount = Math.max(0, currentTotal + studioCharges - paidAmount);
      const { error: saleUpdateErr } = await supabase
        .from('sales')
        .update({
          studio_charges: studioCharges,
          due_amount: dueAmount,
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

  /** Stages for a production. Select * only (no workers join) to avoid 400 when workers table missing or assigned_worker_id = contact id. Resolve names from contacts. */
  async getStagesByProductionId(productionId: string): Promise<StudioProductionStage[]> {
    try {
      const { data, error } = await supabase
        .from('studio_production_stages')
        .select('*')
        .eq('production_id', productionId)
        .order('created_at', { ascending: true });
      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) return [];
        throw error;
      }
      const stages = (data || []) as any[];
      const workerIds = stages.filter((s) => s.assigned_worker_id).map((s) => s.assigned_worker_id);
      if (workerIds.length > 0) {
        const uniqueIds = [...new Set(workerIds)];
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, name')
          .in('id', uniqueIds);
        const nameById = new Map((contacts || []).map((c: any) => [c.id, c.name || '']));
        stages.forEach((s) => {
          if (s.assigned_worker_id) {
            const name = nameById.get(s.assigned_worker_id);
            s.worker = name ? { id: s.assigned_worker_id, name } : { id: s.assigned_worker_id, name: '' };
          }
        });
      }
      return stages as StudioProductionStage[];
    } catch (e: any) {
      if (e?.code === '42P01' || e?.message?.includes('does not exist')) return [];
      throw e;
    }
  },

  /** Ledger status per stage (for Payable vs Paid vs Partial). Returns {} if status column missing. */
  async getLedgerStatusForStages(stageIds: string[]): Promise<Record<string, 'unpaid' | 'partial' | 'paid'>> {
    if (stageIds.length === 0) return {};
    try {
      const { data, error } = await supabase
        .from('worker_ledger_entries')
        .select('reference_id, status')
        .eq('reference_type', 'studio_production_stage')
        .in('reference_id', stageIds);
      if (error) return {}; // e.g. column "status" does not exist before migration
      const byStage: Record<string, { paid: number; unpaid: number }> = {};
      (data || []).forEach((row: { reference_id: string; status?: string }) => {
        const sid = row.reference_id;
        if (!byStage[sid]) byStage[sid] = { paid: 0, unpaid: 0 };
        const st = (row.status || 'unpaid').toLowerCase();
        if (st === 'paid') byStage[sid].paid++;
        else byStage[sid].unpaid++;
      });
      const out: Record<string, 'unpaid' | 'partial' | 'paid'> = {};
      Object.entries(byStage).forEach(([sid, counts]) => {
        if (counts.unpaid === 0) out[sid] = 'paid';
        else if (counts.paid === 0) out[sid] = 'unpaid';
        else out[sid] = 'partial';
      });
      return out;
    } catch {
      return {};
    }
  },

  /** Create a stage (process step) for a production. PHASE 1: No auto-assignment – status=pending, cost=0, assigned_worker_id=null. Assignment ONLY via Assign flow (RPC). */
  async createStage(
    productionId: string,
    input: {
      stage_type: StudioProductionStageType;
      assigned_worker_id?: string | null;
      cost?: number;
      expected_completion_date?: string | null;
      notes?: string | null;
    }
  ): Promise<StudioProductionStage> {
    const production = await this.getProductionById(productionId);
    if (!production) throw new Error('Production not found');
    if (!production.sale_id) throw new Error('Production must be linked to a sale to add a stage.');
    // GUARD: Never use input.assigned_worker_id on create. Worker assignment only via assignWorkerToStage / RPC.
    if (input.assigned_worker_id) {
      console.warn('[studioProductionService] createStage: ignoring assigned_worker_id – assignment only via Assign flow');
    }
    const insertPayload: Record<string, unknown> = {
      production_id: productionId,
      stage_type: input.stage_type,
      assigned_worker_id: null,
      cost: 0,
      expected_completion_date: input.expected_completion_date || null,
      status: 'pending',
      notes: input.notes ?? null,
      expected_cost: 0,
    };
    let result = await supabase
      .from('studio_production_stages')
      .insert(insertPayload)
      .select('*')
      .single();
    if (result.error && (result.error.message?.includes('expected_cost') || result.error.message?.includes('schema cache'))) {
      delete insertPayload.expected_cost;
      result = await supabase
        .from('studio_production_stages')
        .insert(insertPayload)
        .select('*')
        .single();
    }
    if (result.error) throw result.error;
    const data = result.data as any;
    if (data?.assigned_worker_id) {
      const stages = await this.getStagesByProductionId(productionId);
      const found = stages.find((s) => s.id === data.id);
      if (found?.worker) data.worker = found.worker;
    }
    return data as StudioProductionStage;
  },

  /** Delete a stage. Only allowed for pending stages (no worker assigned, not completed). Used when manager removes a task via Customize Tasks. */
  async deleteStage(stageId: string): Promise<void> {
    const { data: existing } = await supabase
      .from('studio_production_stages')
      .select('id, status, assigned_worker_id')
      .eq('id', stageId)
      .single();
    if (!existing) throw new Error('Stage not found');
    const row = existing as any;
    if (row.status === 'completed') {
      throw new Error('Cannot remove a completed stage. Reopen it first if needed.');
    }
    if (row.assigned_worker_id) {
      throw new Error('Cannot remove a stage that has a worker assigned. Unassign first.');
    }
    const { error } = await supabase.from('studio_production_stages').delete().eq('id', stageId);
    if (error) throw error;
  },

  /** PHASE 2: Assign worker to stage. Uses RPC when available (authoritative). Saves assigned_worker_id, assigned_at, expected_cost; status → assigned. No journal entry. Step B: worker and expected_completion_date are mandatory. */
  async assignWorkerToStage(
    stageId: string,
    params: { worker_id: string; expected_cost: number; expected_completion_date?: string | null; notes?: string | null }
  ): Promise<StudioProductionStage> {
    if (!params.worker_id?.trim()) throw new Error('Worker is required to assign this step.');
    const expectedDate = params.expected_completion_date?.trim() || null;
    if (!expectedDate) throw new Error('Expected completion date is required to assign this step.');
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('rpc_assign_worker_to_stage', {
      p_stage_id: stageId,
      p_worker_id: params.worker_id,
      p_expected_cost: params.expected_cost,
      p_expected_completion_date: expectedDate,
      p_notes: params.notes ?? null,
    });
    if (!rpcErr && rpcResult?.ok) {
      const { data: stageRow } = await supabase.from('studio_production_stages').select('production_id').eq('id', stageId).single();
      if (stageRow?.production_id) {
        const stages = await this.getStagesByProductionId((stageRow as any).production_id);
        const updated = stages.find((s) => s.id === stageId);
        if (updated) return updated;
      }
    }
    if (rpcErr?.code === '42883' || rpcErr?.message?.includes('function') || rpcErr?.message?.includes('does not exist')) {
      // RPC not deployed – fallback to direct update (status=assigned or in_progress)
      const { data: existing } = await supabase
        .from('studio_production_stages')
        .select('id, status')
        .eq('id', stageId)
        .single();
      if (!existing) throw new Error('Stage not found');
      if ((existing as any).status === 'completed') throw new Error('Cannot assign worker to a completed stage.');
      const updatePayload: Record<string, unknown> = {
        assigned_worker_id: params.worker_id,
        assigned_at: new Date().toISOString(),
        expected_cost: params.expected_cost,
        cost: 0,
        status: 'assigned',
        expected_completion_date: expectedDate,
        ...(params.notes != null ? { notes: params.notes } : {}),
      };
      let result = await supabase
        .from('studio_production_stages')
        .update(updatePayload)
        .eq('id', stageId)
        .select('*')
        .single();
      if (result.error && (result.error.message?.includes('expected_cost') || result.error.message?.includes('assigned_at') || result.error.message?.includes('assigned'))) {
        updatePayload.status = 'in_progress';
        delete (updatePayload as any).expected_cost;
        delete (updatePayload as any).assigned_at;
        result = await supabase.from('studio_production_stages').update(updatePayload).eq('id', stageId).select('*').single();
      }
      if (result.error) throw result.error;
      const row = result.data as any;
      await resolveStageWorker(row);
      return row as StudioProductionStage;
    }
    if (rpcErr) throw new Error(rpcResult?.error ?? rpcErr.message);
    const { data: stageRow } = await supabase.from('studio_production_stages').select('production_id').eq('id', stageId).single();
    if (stageRow?.production_id) {
      const stages = await this.getStagesByProductionId((stageRow as any).production_id);
      const updated = stages.find((s) => s.id === stageId);
      if (updated) return updated;
    }
    throw new Error('Stage not found after assign');
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
    const { data: existingRow } = await supabase.from('studio_production_stages').select('status, production_id, stage_type').eq('id', stageId).single();
    if (!existingRow) throw new Error('Stage not found');
    const isCompleted = (existingRow as any).status === 'completed';
    const isReopening = isCompleted && updates.status === 'in_progress';
    if (isCompleted && !isReopening) {
      if (updates.status !== undefined && updates.status !== 'completed') throw new Error('Completed stage cannot be reopened.');
      if (updates.cost !== undefined) throw new Error('Completed stage cost is locked.');
      if (updates.completed_at !== undefined) throw new Error('Completed stage cannot be edited.');
      if (updates.assigned_worker_id !== undefined) throw new Error('Completed stage worker is locked.');
      if (updates.notes === undefined) {
        const { data: d } = await supabase.from('studio_production_stages').select('*').eq('id', stageId).single();
        if (d) {
          const row = d as any;
          if (row.assigned_worker_id) {
            const { data: c } = await supabase.from('contacts').select('id, name').eq('id', row.assigned_worker_id).maybeSingle();
            if (c) row.worker = { id: row.assigned_worker_id, name: (c as any).name || '' };
          }
          return row as StudioProductionStage;
        }
        throw new Error('Stage not found');
      }
    }

    // PHASE 3: When marking completed – create journal FIRST (transactional integrity), then single update. No completed stage without accounting entry.
    if (updates.status === 'completed') {
      const cost = Number(updates.cost ?? 0) || 0;
      const workerId = updates.assigned_worker_id ?? null;
      if (cost > 0 && !workerId)
        throw new Error('Assign a worker before marking this stage complete (required for accounting).');
      const { data: prodRow } = await supabase.from('studio_productions').select('id, company_id, branch_id, production_no, sale_id').eq('id', (existingRow as any).production_id).single();
      if (!prodRow) throw new Error('Production not found');
      const prod = prodRow as any;
      let journalId: string | null = null;
      if (workerId && cost > 0) {
        journalId = await createProductionCostJournalEntry({
          companyId: prod.company_id,
          branchId: prod.branch_id || null,
          stageId,
          productionNo: prod.production_no,
          saleId: prod.sale_id ?? null,
          amount: cost,
          stageType: (existingRow as any).stage_type || 'stage',
        });
        if (!journalId) throw new Error('Failed to create production cost journal entry. Stage not updated.');
      }
      const completedAt = updates.completed_at ?? new Date().toISOString();
      const payload: Record<string, unknown> = {
        status: 'completed',
        completed_at: completedAt,
        cost,
        journal_entry_id: journalId,
        notes: updates.notes ?? null,
        ...(updates.assigned_worker_id !== undefined ? { assigned_worker_id: updates.assigned_worker_id } : {}),
      };
      const { data: updated, error } = await supabase
        .from('studio_production_stages')
        .update(payload)
        .eq('id', stageId)
        .select('*')
        .single();
      if (error) throw error;
      const result = updated as StudioProductionStage;
      await resolveStageWorker(result);
      if (workerId && cost > 0) await this.ensureWorkerLedgerEntryForStage(stageId, cost, workerId);
      return result;
    }

    // Step B: When setting status to 'assigned', worker and expected completion date are required.
    if (updates.status === 'assigned') {
      if (!(updates.assigned_worker_id?.trim())) throw new Error('Worker is required when assigning this step.');
      if (!(updates.expected_completion_date?.trim())) throw new Error('Expected completion date is required when assigning this step.');
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
      .select('*')
      .single();
    if (error) throw error;
    const row = data as any;
    await resolveStageWorker(row);
    return row as StudioProductionStage;
  },

  /**
   * Receive from worker: mark stage completed with actual cost. Uses RPC when available (authoritative).
   * Creates journal (Dr Expense, Cr Payable) and worker ledger. workerIdFromUI: use when DB has no assigned_worker_id.
   * Returns { stage, ledgerEntryId } so UI can show "Pay Now?" and record payment against this entry.
   */
  async receiveStage(
    stageId: string,
    actualCost: number,
    notes?: string | null,
    workerIdFromUI?: string | null
  ): Promise<{ stage: StudioProductionStage; ledgerEntryId: string | null }> {
    const { data: stageRow, error: stageErr } = await supabase
      .from('studio_production_stages')
      .select('id, production_id, assigned_worker_id, status')
      .eq('id', stageId)
      .single();
    if (stageErr || !stageRow) throw new Error('Stage not found');
    const stage = stageRow as any;
    if (stage.status === 'completed') throw new Error('Stage already received/completed');

    const effectiveWorkerId = workerIdFromUI || stage.assigned_worker_id || null;
    if (actualCost > 0 && !effectiveWorkerId)
      throw new Error('Assign a worker to this task before receiving (required for accounting).');

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('rpc_receive_stage_and_finalize', {
      p_stage_id: stageId,
      p_final_cost: actualCost,
      p_notes: notes ?? null,
    });
    if (!rpcErr && rpcResult?.ok) {
      const { data: stageRow2 } = await supabase.from('studio_production_stages').select('production_id').eq('id', stageId).single();
      if (stageRow2?.production_id) {
        const stages = await this.getStagesByProductionId((stageRow2 as any).production_id);
        const updated = stages.find((s) => s.id === stageId);
        if (updated) {
          let ledgerEntryId: string | null = null;
          const { data: ledgerRow } = await supabase
            .from('worker_ledger_entries')
            .select('id')
            .eq('reference_type', 'studio_production_stage')
            .eq('reference_id', stageId)
            .limit(1)
            .maybeSingle();
          if (ledgerRow) ledgerEntryId = (ledgerRow as any).id;
          return { stage: updated, ledgerEntryId };
        }
      }
    }
    if (rpcErr?.code === '42883' || rpcErr?.message?.includes('function') || rpcErr?.message?.includes('does not exist')) {
      const updated = await this.updateStage(stageId, {
        status: 'completed',
        cost: actualCost,
        completed_at: new Date().toISOString(),
        notes: notes ?? null,
        assigned_worker_id: effectiveWorkerId,
      });
      let ledgerEntryId: string | null = null;
      const { data: ledgerRow } = await supabase
        .from('worker_ledger_entries')
        .select('id')
        .eq('reference_type', 'studio_production_stage')
        .eq('reference_id', stageId)
        .limit(1)
        .maybeSingle();
      if (ledgerRow) ledgerEntryId = (ledgerRow as any).id;
      return { stage: updated, ledgerEntryId };
    }
    if (rpcErr) throw new Error(rpcResult?.error ?? rpcErr.message);
    throw new Error('Stage not found after receive');
  },

  /**
   * PHASE 4: Reopen a completed stage. Uses RPC when available (authoritative).
   * Reverses journal entry, removes worker ledger, resets stage to assigned (keeps worker + expected cost).
   */
  async reopenStage(stageId: string, _performedBy?: string | null): Promise<StudioProductionStage> {
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('rpc_reopen_stage', { p_stage_id: stageId });
    if (!rpcErr && rpcResult?.ok) {
      const { data: stageRow } = await supabase.from('studio_production_stages').select('production_id').eq('id', stageId).single();
      if (stageRow?.production_id) {
        const stages = await this.getStagesByProductionId((stageRow as any).production_id);
        const updated = stages.find((s) => s.id === stageId);
        if (updated) return updated;
      }
    }
    if (rpcErr?.code === '42883' || rpcErr?.message?.includes('function') || rpcErr?.message?.includes('does not exist')) {
      const { data: stageRow, error: stageErr } = await supabase
        .from('studio_production_stages')
        .select('id, production_id, status, cost, assigned_worker_id, stage_type, journal_entry_id')
        .eq('id', stageId)
        .single();
      if (stageErr || !stageRow) throw new Error('Stage not found');
      const stage = stageRow as any;
      if (stage.status !== 'completed') throw new Error('Only completed stages can be reopened.');
      const cost = Number(stage.cost) || 0;
      const { data: prodRow } = await supabase
        .from('studio_productions')
        .select('id, company_id, branch_id, production_no')
        .eq('id', stage.production_id)
        .single();
      if (!prodRow) throw new Error('Production not found');
      const production = prodRow as any;
      if (cost > 0) {
        await createProductionCostReversalEntry({
          companyId: production.company_id,
          branchId: production.branch_id || null,
          stageId,
          productionNo: production.production_no,
          amount: cost,
          stageType: stage.stage_type || 'stage',
          performedBy: _performedBy,
        });
        const { data: ledgerRow } = await supabase
          .from('worker_ledger_entries')
          .select('id, worker_id, amount, status')
          .eq('reference_type', 'studio_production_stage')
          .eq('reference_id', stageId)
          .limit(1)
          .maybeSingle();
        if (ledgerRow) {
          const entry = ledgerRow as { id: string; worker_id: string; amount: number; status?: string };
          await supabase.from('worker_ledger_entries').delete().eq('id', entry.id);
          if (entry.status !== 'paid' && entry.worker_id) {
            const { data: wRow } = await supabase.from('workers').select('current_balance').eq('id', entry.worker_id).single();
            const bal = Number((wRow as any)?.current_balance) || 0;
            await supabase.from('workers').update({ current_balance: Math.max(0, bal - cost), updated_at: new Date().toISOString() }).eq('id', entry.worker_id);
          }
        }
      }
      const { data: updated, error: updateErr } = await supabase
        .from('studio_production_stages')
        .update({
          status: 'assigned',
          completed_at: null,
          cost: 0,
          journal_entry_id: null,
        })
        .eq('id', stageId)
        .select('*')
        .single();
      if (updateErr) throw updateErr;
      const row = updated as any;
      await resolveStageWorker(row);
      return row as StudioProductionStage;
    }
    if (rpcErr) throw new Error(rpcResult?.error ?? rpcErr.message);
    throw new Error('Stage not found after reopen');
  },

  /**
   * PHASE 5: Change cost after completion. Reverses old journal, creates new journal, updates stage + worker ledger.
   * Do NOT directly overwrite cost; use this method so accounting stays in sync.
   */
  async changeStageCostAfterComplete(
    stageId: string,
    newCost: number,
    performedBy?: string | null
  ): Promise<StudioProductionStage> {
    if (newCost < 0) throw new Error('Cost cannot be negative.');
    const { data: stageRow, error: stageErr } = await supabase
      .from('studio_production_stages')
      .select('id, production_id, status, cost, assigned_worker_id, stage_type')
      .eq('id', stageId)
      .single();
    if (stageErr || !stageRow) throw new Error('Stage not found');
    const stage = stageRow as any;
    if (stage.status !== 'completed') throw new Error('Only completed stages can have cost changed.');
    const oldCost = Number(stage.cost) || 0;
    if (oldCost === newCost) {
      const { data: d } = await supabase.from('studio_production_stages').select('*').eq('id', stageId).single();
      if (d) {
        await resolveStageWorker(d);
        return d as StudioProductionStage;
      }
      throw new Error('Stage not found');
    }
    const { data: prodRow } = await supabase.from('studio_productions').select('id, company_id, branch_id, production_no').eq('id', stage.production_id).single();
    if (!prodRow) throw new Error('Production not found');
    const production = prodRow as any;
    await createProductionCostReversalEntry({
      companyId: production.company_id,
      branchId: production.branch_id || null,
      stageId,
      productionNo: production.production_no,
      amount: oldCost,
      stageType: stage.stage_type || 'stage',
      performedBy,
    });
    const journalId = await createProductionCostJournalEntry({
      companyId: production.company_id,
      branchId: production.branch_id || null,
      stageId,
      productionNo: production.production_no,
      saleId: null,
      amount: newCost,
      stageType: stage.stage_type || 'stage',
      performedBy,
    });
    await supabase.from('studio_production_stages').update({ cost: newCost, journal_entry_id: journalId }).eq('id', stageId);
    // PHASE 5: Log cost change history (production-level audit log)
    await logAction(
      stage.production_id,
      'stage_cost_changed',
      { stage_id: stageId, old_cost: oldCost },
      { stage_id: stageId, new_cost: newCost },
      performedBy ?? null
    ).then(({ error: logErr }) => { if (logErr) console.warn('[studio_production_logs]', logErr); });
    const { data: ledgerRow } = await supabase
      .from('worker_ledger_entries')
      .select('id, worker_id')
      .eq('reference_type', 'studio_production_stage')
      .eq('reference_id', stageId)
      .limit(1)
      .maybeSingle();
    if (ledgerRow && stage.assigned_worker_id) {
      await supabase.from('worker_ledger_entries').update({ amount: newCost }).eq('id', (ledgerRow as any).id);
      const diff = newCost - oldCost;
      const { data: wRow } = await supabase.from('workers').select('current_balance').eq('id', stage.assigned_worker_id).single();
      const bal = Number((wRow as any)?.current_balance) || 0;
      await supabase.from('workers').update({ current_balance: Math.max(0, bal + diff), updated_at: new Date().toISOString() }).eq('id', stage.assigned_worker_id);
    }
    const { data: d } = await supabase.from('studio_production_stages').select('*').eq('id', stageId).single();
    if (d) {
      await resolveStageWorker(d);
      return d as StudioProductionStage;
    }
    throw new Error('Stage not found');
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

  /**
   * Studio summary for a sale (Sales Detail page: breakdown, status, duration).
   * Real-time: reads from studio_productions + studio_production_stages linked to sale_id.
   */
  async getStudioSummaryBySaleId(saleId: string): Promise<{
    hasStudio: boolean;
    productionStatus: 'in_progress' | 'completed' | 'none';
    totalStudioCost: number;
    tasksCompleted: number;
    tasksTotal: number;
    productionDurationDays: number | null;
    completedAt: string | null;
    breakdown: { stageType: string; amount: number; label: string }[];
    productions: { id: string; productionNo: string; status: string; completedAt: string | null }[];
  }> {
    const empty = {
      hasStudio: false,
      productionStatus: 'none' as const,
      totalStudioCost: 0,
      tasksCompleted: 0,
      tasksTotal: 0,
      productionDurationDays: null,
      completedAt: null,
      breakdown: [],
      productions: [],
    };
    try {
      const productions = await this.getProductionsBySaleId(saleId);
      if (!productions.length) return empty;

      let totalCost = 0;
      let tasksCompleted = 0;
      let tasksTotal = 0;
      const byType: Record<string, number> = {};
      let latestCompletedAt: string | null = null;
      let earliestStart: string | null = null;

      for (const p of productions) {
        const stages = await this.getStagesByProductionId(p.id);
        tasksTotal += stages.length;
        for (const s of stages) {
          const cost = Number((s as any).cost) || 0;
          totalCost += cost;
          if ((s as any).status === 'completed') tasksCompleted++;
          const t = ((s as any).stage_type || '').toLowerCase();
          byType[t] = (byType[t] || 0) + cost;
          const completedAt = (s as any).completed_at;
          if (completedAt) {
            if (!latestCompletedAt || completedAt > latestCompletedAt) latestCompletedAt = completedAt;
          }
        }
        if (p.start_date) {
          if (!earliestStart || p.start_date < earliestStart) earliestStart = p.start_date;
        }
        if ((p as any).completed_at && (!latestCompletedAt || (p as any).completed_at > latestCompletedAt)) {
          latestCompletedAt = (p as any).completed_at;
        }
      }

      const stageLabels: Record<string, string> = {
        dyer: 'Dyeing',
        dyeing: 'Dyeing',
        stitching: 'Stitching',
        handwork: 'Handwork',
        embroidery: 'Embroidery',
      };
      const breakdown = Object.entries(byType)
        .filter(([, amt]) => amt > 0)
        .map(([stageType, amount]) => ({
          stageType,
          amount,
          label: stageLabels[stageType] || stageType.charAt(0).toUpperCase() + stageType.slice(1),
        }))
        .sort((a, b) => b.amount - a.amount);

      const allCompleted = productions.every((p) => p.status === 'completed');
      const anyInProgress = productions.some((p) => p.status === 'in_progress');
      let productionDurationDays: number | null = null;
      if (earliestStart && latestCompletedAt) {
        const start = new Date(earliestStart).getTime();
        const end = new Date(latestCompletedAt).getTime();
        productionDurationDays = Math.max(0, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
      }

      return {
        hasStudio: true,
        productionStatus: allCompleted ? 'completed' : anyInProgress ? 'in_progress' : 'none',
        totalStudioCost: totalCost,
        tasksCompleted,
        tasksTotal,
        productionDurationDays,
        completedAt: latestCompletedAt,
        breakdown,
        productions: productions.map((p) => ({
          id: p.id,
          productionNo: p.production_no,
          status: p.status,
          completedAt: (p as any).completed_at || null,
        })),
      };
    } catch (e: any) {
      if (e?.code === 'PGRST116' || e?.message?.includes('does not exist')) return empty;
      throw e;
    }
  },
};
