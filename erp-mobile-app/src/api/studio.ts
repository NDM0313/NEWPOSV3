import { supabase, isSupabaseConfigured } from '../lib/supabase';

/** DB stage types - only these 3 exist in enum */
export type DbStageType = 'dyer' | 'stitching' | 'handwork';

/** UI stage types - map to DB: dyeing->dyer, rest map to handwork if not in DB */
export type UiStageType = 'dyeing' | 'stitching' | 'handwork' | 'embroidery' | 'finishing' | 'quality-check';

function uiToDbStageType(ui: UiStageType): DbStageType {
  if (ui === 'dyeing') return 'dyer';
  if (ui === 'stitching') return 'stitching';
  return 'handwork'; // handwork, embroidery, finishing, quality-check
}

function dbToUiStageType(db: string): UiStageType {
  if (db === 'dyer') return 'dyeing';
  if (db === 'stitching') return 'stitching';
  return 'handwork';
}

export interface StudioSaleRow {
  id: string;
  invoiceNo: string;
  date: string;
  customer: string;
  total: number;
  paid: number;
  due: number;
  paymentStatus: string;
}

export interface StudioProductionRow {
  id: string;
  sale_id: string;
  production_no: string;
  production_date: string;
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  product_id: string;
  product?: { id: string; name: string; sku?: string };
  sale?: { id: string; invoice_no: string; customer_name: string; total: number; invoice_date: string };
}

export interface StudioStageRow {
  id: string;
  production_id: string;
  stage_type: DbStageType;
  assigned_worker_id: string | null;
  cost: number;
  expected_cost?: number | null;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  expected_completion_date: string | null;
  completed_at: string | null;
  assigned_at?: string | null;
  worker?: { id: string; name: string };
}

export interface WorkerRow {
  id: string;
  name: string;
}

export async function getStudioSales(companyId: string, branchId?: string | null) {
  if (!isSupabaseConfigured) return { data: [] as StudioSaleRow[], error: 'App not configured.' };
  let q = supabase
    .from('sales')
    .select('id, invoice_no, invoice_date, customer_name, total, paid_amount, due_amount, payment_status')
    .eq('company_id', companyId)
    .eq('is_studio', true)
    .order('invoice_date', { ascending: false })
    .limit(50);
  if (branchId && branchId !== 'all') q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ''),
      invoiceNo: String(r.invoice_no ?? `STD-${String(r.id ?? '').slice(0, 8)}`),
      date: r.invoice_date ? new Date(r.invoice_date as string).toISOString().slice(0, 10) : '—',
      customer: String(r.customer_name ?? '—'),
      total: Number(r.total) || 0,
      paid: Number(r.paid_amount) || 0,
      due: Number(r.due_amount) || 0,
      paymentStatus: String(r.payment_status ?? '—'),
    })),
    error: null,
  };
}

/** Fetch studio productions with sale + product, for company/branch */
export async function getStudioProductions(
  companyId: string,
  branchId?: string | null
): Promise<{ data: StudioProductionRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  try {
    let q = supabase
      .from('studio_productions')
      .select('id, sale_id, production_no, production_date, status, product_id, product:products(id, name, sku), sale:sales(id, invoice_no, customer_name, total, invoice_date)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (branchId && branchId !== 'all') q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) return { data: [], error: error.message };
    return { data: (data || []) as StudioProductionRow[], error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { data: [], error: msg };
  }
}

/** Shared workflow: Assign worker to stage (STEP 1). Uses RPC when available. */
export async function assignWorkerToStep(
  stageId: string,
  params: {
    worker_id: string;
    expected_cost: number;
    expected_completion_date?: string | null;
    notes?: string | null;
  }
): Promise<{ data: StudioStageRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  try {
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('rpc_assign_worker_to_stage', {
      p_stage_id: stageId,
      p_worker_id: params.worker_id,
      p_expected_cost: params.expected_cost,
      p_expected_completion_date: params.expected_completion_date ?? null,
      p_notes: params.notes ?? null,
    });
    if (rpcErr) {
      if (rpcErr.code === '42883' || rpcErr.message?.includes('function') || rpcErr.message?.includes('does not exist')) {
        const payload: Record<string, unknown> = {
          assigned_worker_id: params.worker_id,
          expected_cost: params.expected_cost,
          assigned_at: new Date().toISOString(),
          status: 'assigned',
          cost: 0,
          expected_completion_date: params.expected_completion_date ?? null,
          notes: params.notes ?? null,
        };
        let { data: stage, error: updErr } = await supabase
          .from('studio_production_stages')
          .update(payload)
          .eq('id', stageId)
          .select('*, worker:workers(id, name)')
          .single();
        if (updErr && (updErr.message?.includes('assigned') || updErr.message?.includes('enum'))) {
          payload.status = 'in_progress';
          delete payload.expected_cost;
          delete payload.assigned_at;
          const retry = await supabase
            .from('studio_production_stages')
            .update(payload)
            .eq('id', stageId)
            .select('*, worker:workers(id, name)')
            .single();
          stage = retry.data;
          updErr = retry.error;
        }
        if (updErr) return { data: null, error: updErr.message };
        return { data: stage as StudioStageRow, error: null };
      }
      return { data: null, error: (rpcResult as { error?: string })?.error ?? rpcErr.message };
    }
    if (!(rpcResult as { ok?: boolean })?.ok) {
      return { data: null, error: (rpcResult as { error?: string })?.error ?? 'Assign failed' };
    }
    const { data: stages } = await getStudioStages(
      (await supabase.from('studio_production_stages').select('production_id').eq('id', stageId).single()).data?.production_id ?? ''
    );
    const updated = stages.data?.find((s) => s.id === stageId);
    return { data: updated ?? null, error: null };
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/** Shared workflow: Receive and finalize stage (STEP 2). Creates accounting entry. Uses RPC when available. */
export async function receiveStepAndFinalizeCost(
  stageId: string,
  params: { final_cost: number; notes?: string | null }
): Promise<{ data: StudioStageRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  try {
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('rpc_receive_stage_and_finalize', {
      p_stage_id: stageId,
      p_final_cost: params.final_cost,
      p_notes: params.notes ?? null,
    });
    if (rpcErr) {
      if (rpcErr.code === '42883' || rpcErr.message?.includes('function') || rpcErr.message?.includes('does not exist')) {
        const { data: stageRow } = await supabase
          .from('studio_production_stages')
          .select('production_id, assigned_worker_id')
          .eq('id', stageId)
          .single();
        if (!(stageRow as { assigned_worker_id?: string })?.assigned_worker_id) {
          return { data: null, error: 'Assign a worker before receiving' };
        }
        const { data, error } = await updateStudioStage(stageId, {
          status: 'completed',
          cost: params.final_cost,
          completed_at: new Date().toISOString(),
        });
        return { data: data ?? null, error };
      }
      return { data: null, error: (rpcResult as { error?: string })?.error ?? rpcErr.message };
    }
    if (!(rpcResult as { ok?: boolean })?.ok) {
      return { data: null, error: (rpcResult as { error?: string })?.error ?? 'Receive failed' };
    }
    const { data: stages } = await getStudioStages(
      (await supabase.from('studio_production_stages').select('production_id').eq('id', stageId).single()).data?.production_id ?? ''
    );
    const updated = stages.data?.find((s) => s.id === stageId);
    return { data: updated ?? null, error: null };
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/** Shared workflow: Reopen completed stage (admin/manager). Reverses accounting. Uses RPC when available. */
export async function reopenStep(stageId: string): Promise<{ data: StudioStageRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  try {
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('rpc_reopen_stage', { p_stage_id: stageId });
    if (rpcErr) {
      if (rpcErr.code === '42883' || rpcErr.message?.includes('function') || rpcErr.message?.includes('does not exist')) {
        const { data, error } = await updateStudioStage(stageId, {
          status: 'assigned',
          cost: 0,
          completed_at: null,
        });
        return { data: data ?? null, error };
      }
      return { data: null, error: (rpcResult as { error?: string })?.error ?? rpcErr.message };
    }
    if (!(rpcResult as { ok?: boolean })?.ok) {
      return { data: null, error: (rpcResult as { error?: string })?.error ?? 'Reopen failed' };
    }
    const { data: stages } = await getStudioStages(
      (await supabase.from('studio_production_stages').select('production_id').eq('id', stageId).single()).data?.production_id ?? ''
    );
    const updated = stages.data?.find((s) => s.id === stageId);
    return { data: updated ?? null, error: null };
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/** Fetch stages for a production */
export async function getStudioStages(productionId: string): Promise<{
  data: StudioStageRow[];
  error: string | null;
}> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  try {
    const { data, error } = await supabase
      .from('studio_production_stages')
      .select('id, production_id, stage_type, assigned_worker_id, cost, expected_cost, status, expected_completion_date, completed_at, assigned_at, worker:workers(id, name)')
      .eq('production_id', productionId)
      .order('created_at', { ascending: true });
    if (error) return { data: [], error: error.message };
    return { data: (data || []) as StudioStageRow[], error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { data: [], error: msg };
  }
}

/** Fetch workers for company (for stage assignment) */
export async function getWorkers(companyId: string): Promise<{ data: WorkerRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  try {
    const { data, error } = await supabase
      .from('workers')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    if (error) return { data: [], error: error.message };
    return { data: (data || []) as WorkerRow[], error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { data: [], error: msg };
  }
}

/** Create a stage for a production. PHASE 1: No auto-assignment – always assigned_worker_id=null. Manager assigns via Assign flow only. */
export async function createStudioStage(
  productionId: string,
  input: {
    stage_type: UiStageType;
    assigned_worker_id?: string | null;
    cost: number;
    expected_completion_date: string | null;
    notes?: string | null;
  }
): Promise<{ data: StudioStageRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  if (input.assigned_worker_id) {
    console.warn('[studioApi] createStudioStage: ignoring assigned_worker_id – assignment only via Assign flow');
  }
  try {
    const { data, error } = await supabase
      .from('studio_production_stages')
      .insert({
        production_id: productionId,
        stage_type: uiToDbStageType(input.stage_type),
        assigned_worker_id: null,
        cost: 0,
        expected_completion_date: input.expected_completion_date,
        status: 'pending',
        notes: input.notes ?? null,
      })
      .select('id, production_id, stage_type, assigned_worker_id, cost, status, expected_completion_date, completed_at, worker:workers(id, name)')
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as StudioStageRow, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { data: null, error: msg };
  }
}

/** Delete a stage. Only allowed for pending stages (no worker assigned, not completed). */
export async function deleteStudioStage(stageId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  try {
    const { data: existing } = await supabase
      .from('studio_production_stages')
      .select('id, status, assigned_worker_id')
      .eq('id', stageId)
      .single();
    if (!existing) return { error: 'Stage not found' };
    const row = existing as { status?: string; assigned_worker_id?: string | null };
    if (row.status === 'completed') {
      return { error: 'Cannot remove a completed stage. Reopen it first if needed.' };
    }
    if (row.assigned_worker_id) {
      return { error: 'Cannot remove a stage that has a worker assigned. Unassign first.' };
    }
    const { error } = await supabase.from('studio_production_stages').delete().eq('id', stageId);
    return { error: error?.message ?? null };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/** Update stage (status, cost, worker, expected date) */
export async function updateStudioStage(
  stageId: string,
  updates: {
    status?: 'pending' | 'in_progress' | 'completed';
    cost?: number;
    assigned_worker_id?: string | null;
    expected_completion_date?: string | null;
    completed_at?: string | null;
  }
): Promise<{ data: StudioStageRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  try {
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.cost !== undefined) payload.cost = updates.cost;
    if (updates.assigned_worker_id !== undefined) payload.assigned_worker_id = updates.assigned_worker_id;
    if (updates.expected_completion_date !== undefined) payload.expected_completion_date = updates.expected_completion_date;
    if (updates.completed_at !== undefined) payload.completed_at = updates.completed_at;
    if (updates.status === 'completed') {
      payload.completed_at = payload.completed_at ?? new Date().toISOString();
    }
    if (Object.keys(payload).length === 0) {
      const { data } = await supabase
        .from('studio_production_stages')
        .select('*, worker:workers(id, name)')
        .eq('id', stageId)
        .single();
      return { data: data as StudioStageRow, error: null };
    }
    const { data, error } = await supabase
      .from('studio_production_stages')
      .update(payload)
      .eq('id', stageId)
      .select('*, worker:workers(id, name)')
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as StudioStageRow, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { data: null, error: msg };
  }
}

/** Update production status */
export async function updateStudioProductionStatus(
  productionId: string,
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled'
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  try {
    const payload: Record<string, unknown> = { status };
    if (status === 'completed') payload.completed_at = new Date().toISOString();
    const { error } = await supabase.from('studio_productions').update(payload).eq('id', productionId);
    return { error: error?.message ?? null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: msg };
  }
}

/** Fetch sale by id (for order detail) */
export async function getSaleById(saleId: string): Promise<{
  data: { id: string; invoice_no: string; customer_name: string; total: number; invoice_date: string } | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data, error } = await supabase
    .from('sales')
    .select('id, invoice_no, customer_name, total, invoice_date')
    .eq('id', saleId)
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as { id: string; invoice_no: string; customer_name: string; total: number; invoice_date: string }, error: null };
}
