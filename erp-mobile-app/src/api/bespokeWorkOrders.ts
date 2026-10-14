/**
 * Bespoke work orders — thin mobile wrapper over Postgres RPCs (no client stock writes).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  buildBespokeMetadataForPersist,
  normalizeFabricMaterials,
  parseCustomizationDetails,
} from '../types/bespoke';

export type BespokeWorkOrderStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';

export interface BespokeWorkOrderRow {
  id: string;
  company_id: string;
  branch_id: string;
  sale_id: string;
  parent_sales_item_id: string;
  work_order_no: string;
  tailor_contact_id: string;
  production_cost: number;
  status: BespokeWorkOrderStatus;
  instructions_snapshot?: Record<string, unknown>;
  notes?: string | null;
  created_at?: string;
  completed_at?: string | null;
  journal_entry_id?: string | null;
  tailor?: { id: string; name?: string; phone?: string | null };
  sale?: {
    id: string;
    invoice_no?: string | null;
    order_no?: string | null;
    customer_name?: string | null;
    status?: string | null;
  } | null;
  parent_item?: { id: string; product_name?: string | null } | null;
}

export type WorkOrderStockPostStatus = {
  fabricPosted: boolean;
  parentPosted: boolean;
  expectsFabric: boolean;
  needsStockPost: boolean;
};

const BESPOKE_FABRIC_STOCK_NOTE_PREFIX = 'Bespoke fabric OUT';
const BESPOKE_PARENT_STOCK_NOTE_PREFIX = 'Bespoke custom order IN';
const BESPOKE_PARENT_STOCK_LEGACY_OUT_PREFIX = 'Bespoke custom order OUT';

function isBespokeParentStockNote(notes: string | null | undefined): boolean {
  const n = String(notes ?? '');
  return (
    n.startsWith(BESPOKE_PARENT_STOCK_NOTE_PREFIX) ||
    n.startsWith(BESPOKE_PARENT_STOCK_LEGACY_OUT_PREFIX)
  );
}

function isBespokeStockMovementActive(
  note: string,
  allNotes: string[],
  woLabel: string,
): boolean {
  const notes = String(note ?? '');
  if (!notes || notes.startsWith('Bespoke stock reversal')) return false;
  const reversalNote = `Bespoke stock reversal — ${woLabel} — ${notes}`;
  return !allNotes.includes(reversalNote);
}

function saleHasFabricForWorkOrder(
  parentItem: { id?: string; customization_details?: unknown } | null,
  parentSalesItemId: string,
  childLines: Array<{ bespoke_parent_item_id?: string | null }>,
): boolean {
  const parentId = parentItem?.id ? String(parentItem.id) : parentSalesItemId;
  const linked = childLines.some((c) => String(c.bespoke_parent_item_id ?? '') === parentId);
  if (linked) return true;
  const details = parseCustomizationDetails(parentItem?.customization_details);
  const materials =
    details?.fabric_materials ??
    normalizeFabricMaterials(
      (parentItem?.customization_details as Record<string, unknown> | null)?.fabric_materials,
    );
  return materials.some((m) => m.product_id && m.quantity > 0);
}

/** Whether fabric + parent custom-order stock are actively posted (not reversed) for this WO. */
export async function getWorkOrderStockPostStatus(
  workOrderId: string,
  parentSalesItemId: string,
  saleId: string,
  workOrderNo?: string,
): Promise<WorkOrderStockPostStatus> {
  if (!isSupabaseConfigured) {
    return { fabricPosted: false, parentPosted: false, expectsFabric: false, needsStockPost: false };
  }
  const [{ data: movements }, { data: parentItem }, { data: childLines }] = await Promise.all([
    supabase
      .from('stock_movements')
      .select('id, notes')
      .eq('reference_type', 'bespoke_work_order')
      .eq('reference_id', workOrderId),
    supabase
      .from('sales_items')
      .select('id, product_id, customization_details')
      .eq('id', parentSalesItemId)
      .maybeSingle(),
    supabase
      .from('sales_items')
      .select('id, bespoke_parent_item_id')
      .eq('sale_id', saleId),
  ]);

  const notesList = (movements ?? []).map((m) => String((m as { notes?: string }).notes ?? ''));
  const woLabel = workOrderNo?.trim() || workOrderId;
  const fabricPosted = notesList.some(
    (n) =>
      n.startsWith(BESPOKE_FABRIC_STOCK_NOTE_PREFIX) &&
      isBespokeStockMovementActive(n, notesList, woLabel),
  );
  const parentPosted = notesList.some(
    (n) => isBespokeParentStockNote(n) && isBespokeStockMovementActive(n, notesList, woLabel),
  );
  const expectsFabric = saleHasFabricForWorkOrder(
    parentItem as { id?: string; customization_details?: unknown } | null,
    parentSalesItemId,
    childLines ?? [],
  );
  const needsStockPost = (!fabricPosted && expectsFabric) || !parentPosted;

  return { fabricPosted, parentPosted, expectsFabric, needsStockPost };
}

async function resolveErpUserId(authUserId: string | null | undefined): Promise<string | null> {
  if (!authUserId) return null;
  const { data } = await supabase
    .from('users')
    .select('id')
    .or(`id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

const WORK_ORDER_LIST_SELECT =
  '*, tailor:contacts!tailor_contact_id(id, name, phone), sale:sales!sale_id(id, invoice_no, order_no, customer_name, status), parent_item:sales_items!parent_sales_item_id(id, product_name)';

export async function listBespokeWorkOrdersBySale(saleId: string): Promise<BespokeWorkOrderRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('bespoke_work_orders')
    .select(WORK_ORDER_LIST_SELECT)
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BespokeWorkOrderRow[];
}

export async function listBespokeWorkOrdersByCompany(
  companyId: string,
  opts?: { status?: BespokeWorkOrderStatus | 'all'; branchId?: string | null },
): Promise<BespokeWorkOrderRow[]> {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from('bespoke_work_orders')
    .select(WORK_ORDER_LIST_SELECT)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (opts?.status && opts.status !== 'all') {
    query = query.eq('status', opts.status);
  }
  if (opts?.branchId) {
    query = query.eq('branch_id', opts.branchId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as BespokeWorkOrderRow[];
}

export async function createBespokeWorkOrder(params: {
  companyId: string;
  branchId: string;
  saleId: string;
  parentSalesItemId: string;
  tailorContactId: string;
  productionCost: number;
  instructionsSnapshot?: Record<string, unknown> | null;
  notes?: string;
  createdByAuthUserId?: string;
}): Promise<BespokeWorkOrderRow> {
  if (!isSupabaseConfigured) throw new Error('App not configured.');
  const prefix = `BWO-${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const snapshot =
    buildBespokeMetadataForPersist(params.instructionsSnapshot) ??
    (params.instructionsSnapshot && typeof params.instructionsSnapshot === 'object'
      ? params.instructionsSnapshot
      : {});
  const createdBy = await resolveErpUserId(params.createdByAuthUserId);
  const { data, error } = await supabase
    .from('bespoke_work_orders')
    .insert({
      company_id: params.companyId,
      branch_id: params.branchId,
      sale_id: params.saleId,
      parent_sales_item_id: params.parentSalesItemId,
      work_order_no: prefix,
      tailor_contact_id: params.tailorContactId,
      production_cost: params.productionCost,
      instructions_snapshot: snapshot,
      notes: params.notes?.trim() || null,
      status: 'draft',
      created_by: createdBy,
    })
    .select('*, tailor:contacts!tailor_contact_id(id, name, phone)')
    .single();
  if (error) throw new Error(error.message);
  return data as BespokeWorkOrderRow;
}

async function runCompleteBespokeWorkOrderRpc(
  workOrderId: string,
  userId?: string,
): Promise<{ stockMovementsPosted?: number; journalEntryId?: string }> {
  if (!isSupabaseConfigured) throw new Error('App not configured.');
  const erpUserId = await resolveErpUserId(userId);
  const { data, error } = await supabase.rpc('complete_bespoke_work_order', {
    p_work_order_id: workOrderId,
    p_user_id: erpUserId,
  });
  if (error) throw new Error(error.message);
  const result = data as {
    success?: boolean;
    error?: string;
    stock_movements_posted?: number;
    journal_entry_id?: string;
  };
  if (result?.success === false) {
    throw new Error(result.error || 'Failed to complete work order');
  }
  return {
    stockMovementsPosted: result.stock_movements_posted,
    journalEntryId: result.journal_entry_id,
  };
}

export async function completeBespokeWorkOrder(
  workOrderId: string,
  userId?: string,
): Promise<{ stockMovementsPosted?: number; journalEntryId?: string }> {
  return runCompleteBespokeWorkOrderRpc(workOrderId, userId);
}

/** Idempotent stock retry for completed WOs with missing fabric/parent movements. */
export async function repostBespokeWorkOrderStock(
  workOrderId: string,
  userId?: string,
): Promise<{ stockMovementsPosted?: number; journalEntryId?: string }> {
  return runCompleteBespokeWorkOrderRpc(workOrderId, userId);
}

function toWorkOrderTimestamp(d?: Date | string | null): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function updateBespokeWorkOrder(params: {
  workOrderId: string;
  tailorContactId: string;
  productionCost: number;
  notes?: string | null;
  status?: BespokeWorkOrderStatus | null;
  createdAt?: Date | string | null;
  completedAt?: Date | string | null;
  userId?: string;
}): Promise<BespokeWorkOrderRow> {
  if (!isSupabaseConfigured) throw new Error('App not configured.');
  const erpUserId = await resolveErpUserId(params.userId);
  const { data, error } = await supabase.rpc('update_bespoke_work_order', {
    p_work_order_id: params.workOrderId,
    p_tailor_contact_id: params.tailorContactId,
    p_production_cost: params.productionCost,
    p_notes: params.notes?.trim() || null,
    p_user_id: erpUserId,
    p_status: params.status ?? null,
    p_created_at: toWorkOrderTimestamp(params.createdAt),
    p_completed_at: toWorkOrderTimestamp(params.completedAt),
  });
  if (error) throw new Error(error.message);
  const result = data as { success?: boolean; error?: string };
  if (result?.success === false) {
    throw new Error(result.error || 'Failed to update work order');
  }
  const { data: row, error: fetchErr } = await supabase
    .from('bespoke_work_orders')
    .select(
      '*, tailor:contacts!tailor_contact_id(id, name, phone), sale:sales!sale_id(id, invoice_no, order_no, customer_name, status), parent_item:sales_items!parent_sales_item_id(id, product_name)',
    )
    .eq('id', params.workOrderId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  return row as BespokeWorkOrderRow;
}

export async function cancelBespokeWorkOrder(
  workOrderId: string,
  userId?: string,
  reason?: string,
): Promise<{ stockMovementsReversed: number }> {
  if (!isSupabaseConfigured) throw new Error('App not configured.');
  const erpUserId = await resolveErpUserId(userId);
  const { data, error } = await supabase.rpc('cancel_bespoke_work_order', {
    p_work_order_id: workOrderId,
    p_user_id: erpUserId,
    p_reason: reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
  const result = data as {
    success?: boolean;
    error?: string;
    stock_movements_reversed?: number;
  };
  if (result?.success === false) {
    throw new Error(result.error || 'Failed to cancel work order');
  }
  return { stockMovementsReversed: result.stock_movements_reversed ?? 0 };
}

export async function listBespokeParentSaleItems(saleId: string): Promise<
  Array<{ id: string; product_name: string | null; sku: string | null; quantity: number }>
> {
  const { data, error } = await supabase
    .from('sales_items')
    .select('id, product_name, sku, quantity, bespoke_parent_item_id, product:products(sku)')
    .eq('sale_id', saleId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    id: string;
    product_name: string | null;
    sku: string | null;
    quantity: number;
    bespoke_parent_item_id?: string | null;
    product?: { sku?: string | null };
  }>;

  // All top-level sale lines can attach a work order (web parity).
  return rows
    .filter((r) => !r.bespoke_parent_item_id)
    .map((r) => ({
      id: r.id,
      product_name: r.product_name,
      sku: r.product?.sku ?? r.sku,
      quantity: Number(r.quantity) || 1,
    }));
}
