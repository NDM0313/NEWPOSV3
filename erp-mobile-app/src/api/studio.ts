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
  status: 'pending' | 'in_progress' | 'completed';
  expected_completion_date: string | null;
  completed_at: string | null;
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

/** Fetch stages for a production */
export async function getStudioStages(productionId: string): Promise<{
  data: StudioStageRow[];
  error: string | null;
}> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  try {
    const { data, error } = await supabase
      .from('studio_production_stages')
      .select('id, production_id, stage_type, assigned_worker_id, cost, status, expected_completion_date, completed_at, worker:workers(id, name)')
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

/** Create a stage for a production */
export async function createStudioStage(
  productionId: string,
  input: {
    stage_type: UiStageType;
    assigned_worker_id: string | null;
    cost: number;
    expected_completion_date: string | null;
    notes?: string | null;
  }
): Promise<{ data: StudioStageRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  try {
    const { data, error } = await supabase
      .from('studio_production_stages')
      .insert({
        production_id: productionId,
        stage_type: uiToDbStageType(input.stage_type),
        assigned_worker_id: input.assigned_worker_id,
        cost: input.cost,
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
