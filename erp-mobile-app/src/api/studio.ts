import { supabase, isSupabaseConfigured } from '../lib/supabase';

/** DB stage types (enum: dyer, stitching, handwork, embroidery, finishing, quality_check after migration) */
export type DbStageType = 'dyer' | 'stitching' | 'handwork' | 'embroidery' | 'finishing' | 'quality_check';

/** UI stage types */
export type UiStageType = 'dyeing' | 'stitching' | 'handwork' | 'embroidery' | 'finishing' | 'quality-check';

function uiToDbStageType(ui: UiStageType): DbStageType {
  if (ui === 'dyeing') return 'dyer';
  if (ui === 'stitching') return 'stitching';
  if (ui === 'embroidery') return 'embroidery';
  if (ui === 'finishing') return 'finishing';
  if (ui === 'quality-check') return 'quality_check';
  return 'handwork';
}

function dbToUiStageType(db: string): UiStageType {
  if (db === 'dyer') return 'dyeing';
  if (db === 'stitching') return 'stitching';
  if (db === 'embroidery') return 'embroidery';
  if (db === 'finishing') return 'finishing';
  if (db === 'quality_check') return 'quality-check';
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
  current_stage_id?: string | null;
  product_id: string;
  product?: { id: string; name: string; sku?: string };
  sale?: { id: string; invoice_no: string; customer_name: string; total: number; invoice_date: string; deadline?: string | null };
}

export interface StudioStageRow {
  id: string;
  production_id: string;
  stage_type: DbStageType;
  assigned_worker_id: string | null;
  cost: number;
  expected_cost?: number | null;
  status: 'pending' | 'assigned' | 'in_progress' | 'sent_to_worker' | 'received' | 'completed';
  expected_completion_date: string | null;
  completed_at: string | null;
  assigned_at?: string | null;
  sent_date?: string | null;
  received_date?: string | null;
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
  if (branchId && branchId !== 'all' && branchId !== 'default') q = q.eq('branch_id', branchId);
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

/**
 * Ensure every studio sale has a studio_production (backfill).
 * Call before loading Studio dashboard so STD-* sales show in Studio.
 */
export async function ensureStudioProductionsForCompany(companyId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  try {
    const { data: sales, error: salesErr } = await supabase
      .from('sales')
      .select('id, company_id, branch_id, invoice_no, invoice_date, created_by')
      .eq('company_id', companyId)
      .eq('is_studio', true)
      .neq('status', 'cancelled');
    if (salesErr || !sales?.length) return { error: salesErr?.message ?? null };

    const { data: prods } = await supabase
      .from('studio_productions')
      .select('sale_id')
      .eq('company_id', companyId);
    const hasProduction = new Set((prods || []).map((p: { sale_id: string }) => p.sale_id));
    const missing = (sales as { id: string; company_id: string; branch_id: string; invoice_no: string; invoice_date: string; created_by: string | null }[]).filter((s) => !hasProduction.has(s.id));
    if (missing.length === 0) return { error: null };

    let items: { sale_id: string; product_id: string; variation_id: string | null; quantity: number }[] = [];
    const { data: itemsSales } = await supabase
      .from('sales_items')
      .select('sale_id, product_id, variation_id, quantity')
      .in('sale_id', missing.map((s) => s.id));
    if (itemsSales?.length) {
      items = (itemsSales as { sale_id: string; product_id: string; variation_id: string | null; quantity: number }[]).map((r) => ({
        sale_id: r.sale_id,
        product_id: r.product_id,
        variation_id: r.variation_id ?? null,
        quantity: Math.max(0.01, Number(r.quantity) || 1),
      }));
    } else {
      const { data: itemsLegacy } = await supabase
        .from('sale_items')
        .select('sale_id, product_id, variation_id, quantity')
        .in('sale_id', missing.map((s) => s.id));
      if (itemsLegacy?.length) {
        items = (itemsLegacy as { sale_id: string; product_id: string; variation_id: string | null; quantity: number }[]).map((r) => ({
          sale_id: r.sale_id,
          product_id: r.product_id,
          variation_id: r.variation_id ?? null,
          quantity: Math.max(0.01, Number(r.quantity) || 1),
        }));
      }
    }
    const firstItemBySale = new Map<string, { product_id: string; variation_id: string | null; quantity: number }>();
    for (const it of items) {
      if (!firstItemBySale.has(it.sale_id)) firstItemBySale.set(it.sale_id, { product_id: it.product_id, variation_id: it.variation_id, quantity: it.quantity });
    }

    for (const sale of missing) {
      const first = firstItemBySale.get(sale.id);
      if (!first?.product_id) continue;
      const productionNo = `PRD-${sale.invoice_no || sale.id}`;
      const productionDate = sale.invoice_date ? new Date(sale.invoice_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      const { data: inserted, error: insErr } = await supabase
        .from('studio_productions')
        .insert({
          company_id: sale.company_id,
          branch_id: sale.branch_id,
          sale_id: sale.id,
          production_no: productionNo,
          production_date: productionDate,
          product_id: first.product_id,
          variation_id: first.variation_id,
          quantity: first.quantity,
          status: 'draft',
          created_by: sale.created_by ?? null,
        })
        .select('id')
        .single();
      if (insErr) {
        if (insErr.code === '23505') continue;
        console.warn('[studio] ensureStudioProductions backfill insert failed:', insErr);
        continue;
      }
      // New productions start with 0 stages; user adds stages via "+" in Studio dashboard
      // (No default stages inserted – workflow: Assign Stages → Stage Execution → Receive → Next)
    }
    return { error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: msg };
  }
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
      .select('id, sale_id, production_no, production_date, status, product_id, product:products(id, name, sku), sale:sales(id, invoice_no, customer_name, total, invoice_date, deadline)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (branchId && branchId !== 'all' && branchId !== 'default') q = q.eq('branch_id', branchId);
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

/** Send to worker: assigned → sent_to_worker, set sent_date */
export async function sendToWorker(stageId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  try {
    const { data: r, error: e } = await supabase.rpc('rpc_send_to_worker', { p_stage_id: stageId });
    if (e) return { error: (r as { error?: string })?.error ?? e.message };
    if (!(r as { ok?: boolean })?.ok) return { error: (r as { error?: string })?.error ?? 'Send failed' };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/** Receive work: sent_to_worker → received, set received_date */
export async function receiveWork(stageId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  try {
    const { data: r, error: e } = await supabase.rpc('rpc_receive_work', { p_stage_id: stageId });
    if (e) return { error: (r as { error?: string })?.error ?? e.message };
    if (!(r as { ok?: boolean })?.ok) return { error: (r as { error?: string })?.error ?? 'Receive failed' };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/** Confirm payment: set cost + accounting. pay_now = true → Dr 5000 Cr Cash; false → Dr 5000 Cr 2010 + worker ledger unpaid */
export async function confirmStagePayment(
  stageId: string,
  params: { final_cost: number; pay_now: boolean }
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  try {
    const { data: r, error: e } = await supabase.rpc('rpc_confirm_stage_payment', {
      p_stage_id: stageId,
      p_final_cost: params.final_cost,
      p_pay_now: params.pay_now,
    });
    if (e) return { error: (r as { error?: string })?.error ?? e.message };
    if (!(r as { ok?: boolean })?.ok) return { error: (r as { error?: string })?.error ?? 'Confirm payment failed' };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/** Complete stage: received → completed, set completed_at. Payment must be confirmed first. */
export async function completeStage(stageId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  try {
    const { data: r, error: e } = await supabase.rpc('rpc_complete_stage', { p_stage_id: stageId });
    if (e) return { error: (r as { error?: string })?.error ?? e.message };
    if (!(r as { ok?: boolean })?.ok) return { error: (r as { error?: string })?.error ?? 'Complete failed' };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' };
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
      .select('id, production_id, stage_type, stage_order, assigned_worker_id, cost, expected_cost, status, expected_completion_date, completed_at, assigned_at, sent_date, received_date, notes, worker:workers(id, name)')
      .eq('production_id', productionId)
      .order('stage_order', { ascending: true });
    if (error) return { data: [], error: error.message };
    const rows = (data || []) as StudioStageRow[];
    const missingWorkerIds = rows
      .filter((s) => s.assigned_worker_id && !(s as { worker?: { name?: string } }).worker?.name)
      .map((s) => s.assigned_worker_id as string);
    if (missingWorkerIds.length > 0) {
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('id, name')
        .in('id', missingWorkerIds);
      const idToName = new Map<string, string>();
      (contactsData || []).forEach((c: { id: string; name: string }) => idToName.set(c.id, c.name || 'Worker'));
      rows.forEach((s) => {
        if (s.assigned_worker_id && !(s as { worker?: { name?: string } }).worker?.name) {
          const name = idToName.get(s.assigned_worker_id);
          if (name) (s as StudioStageRow).worker = { id: s.assigned_worker_id, name };
        }
      });
    }
    return { data: rows, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { data: [], error: msg };
  }
}

/** Fetch studio stages for a sale (by sale_id). Uses RPC when available so data is always returned; else direct query. */
export async function getStudioStagesBySaleId(saleId: string): Promise<{
  data: Array<{ task_type: string; cost: number; worker_name?: string; completed_at?: string | null }>;
  error: string | null;
}> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_studio_stages_for_sale', {
      p_sale_id: saleId,
    });
    if (!rpcErr && Array.isArray(rpcData) && rpcData.length >= 0) {
      const out = (rpcData as Array<{ task_type: string; cost: number; worker_name?: string | null; completed_at?: string | null }>).map((row) => ({
        task_type: row.task_type ?? '',
        cost: Number(row.cost) || 0,
        worker_name: row.worker_name ?? undefined,
        completed_at: row.completed_at ?? undefined,
      }));
      return { data: out, error: null };
    }
    const { data: prods, error: e1 } = await supabase
      .from('studio_productions')
      .select('id')
      .eq('sale_id', saleId);
    if (e1 || !prods?.length) return { data: [], error: rpcErr?.message ?? e1?.message ?? null };
    const productionIds = (prods as { id: string }[]).map((p) => p.id);
    const out: Array<{ task_type: string; cost: number; worker_name?: string; completed_at?: string | null }> = [];
    for (const pid of productionIds) {
      const { data: stages } = await getStudioStages(pid);
      for (const s of stages?.data ?? []) {
        const worker = s.worker as { name?: string } | undefined;
        out.push({
          task_type: s.stage_type,
          cost: Number(s.cost) || 0,
          worker_name: worker?.name ?? undefined,
          completed_at: s.completed_at ?? undefined,
        });
      }
    }
    return { data: out, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/** Fetch workers for company (for stage assignment). Uses workers table; fallback to contacts (type=worker) so dropdown shows when workers table is empty or not synced. */
export async function getWorkers(companyId: string): Promise<{ data: WorkerRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  try {
    const { data: workersData, error: workersErr } = await supabase
      .from('workers')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    if (!workersErr && workersData?.length) {
      return { data: workersData as WorkerRow[], error: null };
    }
    // Fallback: workers table empty or RLS/no sync – load from contacts (type=worker). Same id used by studio_production_stages.assigned_worker_id.
    const { data: contactsData, error: contactsErr } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('type', 'worker')
      .order('name');
    if (contactsErr) return { data: [], error: contactsErr.message };
    const list = (contactsData || []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name || 'Worker' }));
    return { data: list, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { data: [], error: msg };
  }
}

/** Create a stage for a production. Uses stage_order (next available if not provided). */
export async function createStudioStage(
  productionId: string,
  input: {
    stage_type: UiStageType;
    stage_order?: number;
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
    let stageOrder = input.stage_order;
    if (stageOrder == null) {
      const { data: existing } = await supabase
        .from('studio_production_stages')
        .select('stage_order')
        .eq('production_id', productionId)
        .order('stage_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      stageOrder = ((existing as { stage_order?: number } | null)?.stage_order ?? 0) + 1;
    }
    const { data, error } = await supabase
      .from('studio_production_stages')
      .insert({
        production_id: productionId,
        stage_type: uiToDbStageType(input.stage_type),
        stage_order: stageOrder,
        assigned_worker_id: null,
        cost: 0,
        expected_completion_date: input.expected_completion_date,
        status: 'pending',
        notes: input.notes ?? null,
      })
      .select('id, production_id, stage_type, stage_order, assigned_worker_id, cost, status, expected_completion_date, completed_at, worker:workers(id, name)')
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as StudioStageRow, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { data: null, error: msg };
  }
}

/** Add multiple stages to a production in order (stage_order 1, 2, 3...). Used when user selects stages from pipeline. */
export async function addStudioStagesBatch(
  productionId: string,
  stageTypes: UiStageType[]
): Promise<{ data: StudioStageRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  if (!stageTypes.length) return { data: [], error: null };
  try {
    const rows = stageTypes.map((st, i) => ({
      production_id: productionId,
      stage_type: uiToDbStageType(st),
      stage_order: i + 1,
      assigned_worker_id: null,
      cost: 0,
      status: 'pending',
    }));
    const { data, error } = await supabase
      .from('studio_production_stages')
      .insert(rows)
      .select('id, production_id, stage_type, stage_order, assigned_worker_id, cost, status, expected_completion_date, completed_at, worker:workers(id, name)');
    if (error) return { data: [], error: error.message };
    return { data: (data || []) as StudioStageRow[], error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { data: [], error: msg };
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

/** Update stage (status, cost, expected_cost, worker, expected date, sent_date, received_date) */
export async function updateStudioStage(
  stageId: string,
  updates: {
    status?: 'pending' | 'assigned' | 'in_progress' | 'sent_to_worker' | 'received' | 'completed';
    cost?: number;
    expected_cost?: number;
    assigned_worker_id?: string | null;
    expected_completion_date?: string | null;
    completed_at?: string | null;
    sent_date?: string | null;
    received_date?: string | null;
  }
): Promise<{ data: StudioStageRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  try {
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.cost !== undefined) payload.cost = updates.cost;
    if (updates.expected_cost !== undefined) payload.expected_cost = updates.expected_cost;
    if (updates.assigned_worker_id !== undefined) payload.assigned_worker_id = updates.assigned_worker_id;
    if (updates.expected_completion_date !== undefined) payload.expected_completion_date = updates.expected_completion_date;
    if (updates.completed_at !== undefined) payload.completed_at = updates.completed_at;
    if (updates.sent_date !== undefined) payload.sent_date = updates.sent_date;
    if (updates.received_date !== undefined) payload.received_date = updates.received_date;
    if (updates.status === 'completed') {
      payload.completed_at = payload.completed_at ?? new Date().toISOString();
    }
    if (payload.assigned_worker_id != null && payload.status === undefined) {
      payload.status = 'assigned';
    }
    if (Object.keys(payload).length === 0) {
      const { data } = await supabase
        .from('studio_production_stages')
        .select('*')
        .eq('id', stageId)
        .single();
      return { data: data as StudioStageRow, error: null };
    }
    const { data, error } = await supabase
      .from('studio_production_stages')
      .update(payload)
      .eq('id', stageId)
      .select('*')
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
