/**
 * Bespoke work orders — thin mobile wrapper over Postgres RPCs (no client stock writes).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { buildBespokeMetadataForPersist } from '../types/bespoke';

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
  completed_at?: string | null;
  journal_entry_id?: string | null;
  tailor?: { id: string; name?: string; phone?: string | null };
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

export async function listBespokeWorkOrdersBySale(saleId: string): Promise<BespokeWorkOrderRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('bespoke_work_orders')
    .select('*, tailor:contacts!tailor_contact_id(id, name, phone)')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false });
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

export async function completeBespokeWorkOrder(
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

export async function listBespokeParentSaleItems(saleId: string): Promise<
  Array<{ id: string; product_name: string | null; sku: string | null; quantity: number }>
> {
  const { data, error } = await supabase
    .from('sales_items')
    .select('id, product_name, sku, quantity, bespoke_parent_item_id, customization_details, product:products(sku)')
    .eq('sale_id', saleId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    id: string;
    product_name: string | null;
    sku: string | null;
    quantity: number;
    bespoke_parent_item_id?: string | null;
    customization_details?: unknown;
    product?: { sku?: string | null };
  }>;
  return rows
    .filter((r) => !r.bespoke_parent_item_id)
    .filter((r) => {
      const sku = (r.product?.sku ?? r.sku ?? '').trim();
      return sku.toUpperCase().startsWith('CUSTOM-') || r.customization_details != null;
    })
    .map((r) => ({
      id: r.id,
      product_name: r.product_name,
      sku: r.product?.sku ?? r.sku,
      quantity: Number(r.quantity) || 1,
    }));
}
