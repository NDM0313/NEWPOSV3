/**
 * Packing list API for mobile. Uses same Supabase tables as web (packing_lists, packing_list_items).
 * Flow: Sale → Create Packing List → View Packing Items.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface PackingListItemRow {
  id: string;
  packing_list_id: string;
  product_id: string | null;
  product_name: string | null;
  sku: string | null;
  pieces: number;
  cartons: number;
  weight: string | null;
  sort_order: number;
}

export interface PackingListRow {
  id: string;
  company_id: string;
  sale_id: string;
  branch_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  items?: PackingListItemRow[];
}

export async function listPackingListsBySale(saleId: string): Promise<{ data: PackingListRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('packing_lists')
    .select('*')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: (data || []) as PackingListRow[], error: null };
}

/** List packing lists by company (to show which sales already have a packing list). */
export async function listPackingListsByCompany(companyId: string, limit = 200): Promise<{ data: PackingListRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('packing_lists')
    .select('id, sale_id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: [], error: error.message };
  return { data: (data || []) as PackingListRow[], error: null };
}

export async function getPackingListWithItems(id: string): Promise<{ data: PackingListRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data: pl, error: plErr } = await supabase
    .from('packing_lists')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (plErr) return { data: null, error: plErr.message };
  if (!pl) return { data: null, error: null };
  const row = pl as PackingListRow;
  const { data: items } = await supabase
    .from('packing_list_items')
    .select('*')
    .eq('packing_list_id', id)
    .order('sort_order', { ascending: true });
  row.items = (items || []) as PackingListItemRow[];
  return { data: row, error: null };
}

export async function createPackingListFromSale(payload: {
  companyId: string;
  saleId: string;
  branchId?: string | null;
  createdBy?: string | null;
}): Promise<{ data: PackingListRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { companyId, saleId, branchId, createdBy } = payload;

  const { data: saleRow, error: saleErr } = await supabase
    .from('sales')
    .select('id, branch_id')
    .eq('id', saleId)
    .single();
  if (saleErr || !saleRow) return { data: null, error: 'Sale not found.' };

  const branch = branchId ?? (saleRow as { branch_id?: string }).branch_id ?? null;

  const { data: pl, error: plErr } = await supabase
    .from('packing_lists')
    .insert({
      company_id: companyId,
      sale_id: saleId,
      branch_id: branch,
      status: 'draft',
      created_by: createdBy ?? null,
    })
    .select()
    .single();
  if (plErr || !pl) return { data: null, error: plErr?.message ?? 'Failed to create packing list.' };

  let items: Array<{ product_id: string | null; product_name: string | null; sku: string | null; quantity: number; packing_details?: unknown; packing_quantity?: number }> = [];
  const { data: salesItems } = await supabase
    .from('sales_items')
    .select('product_id, product_name, sku, quantity, packing_details, packing_quantity')
    .eq('sale_id', saleId)
    .order('id');
  if (salesItems && salesItems.length > 0) {
    items = salesItems as typeof items;
  } else {
    const { data: saleItems } = await supabase
      .from('sale_items')
      .select('product_id, product_name, sku, quantity, packing_details, packing_quantity')
      .eq('sale_id', saleId)
      .order('id');
    if (saleItems && saleItems.length > 0) items = saleItems as typeof items;
  }

  const toInsert = items.map((it, idx) => {
    const pd = it.packing_details && typeof it.packing_details === 'object'
      ? it.packing_details as { total_pieces?: number; total_boxes?: number; thaans?: number; weight?: unknown; total_weight?: unknown }
      : null;
    const pieces = pd?.total_pieces ?? it.quantity ?? 0;
    const cartons = pd?.total_boxes ?? (pd as { thaans?: number } | null)?.thaans ?? 0;
    const weight = pd?.weight != null ? String(pd.weight) : (pd?.total_weight != null ? String(pd.total_weight) : '');
    return {
      packing_list_id: pl.id,
      product_id: it.product_id ?? null,
      product_name: it.product_name ?? null,
      sku: it.sku ?? null,
      pieces: Number(pieces) || 0,
      cartons: Number(cartons) || 0,
      weight: weight || null,
      sort_order: idx,
    };
  });

  if (toInsert.length > 0) {
    const { error: itemsErr } = await supabase.from('packing_list_items').insert(toInsert);
    if (itemsErr) return { data: null, error: itemsErr.message };
  }

  return getPackingListWithItems(pl.id);
}

export type PackingListItemPatch = {
  pieces?: number;
  cartons?: number;
  weight?: string | null;
  sort_order?: number;
};

/** Update one packing list line (RLS same as select on packing_list_items). */
export async function updatePackingListItem(
  itemId: string,
  patch: PackingListItemPatch,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const row: Record<string, unknown> = {};
  if (patch.pieces !== undefined) row.pieces = Math.max(0, Math.floor(Number(patch.pieces) || 0));
  if (patch.cartons !== undefined) row.cartons = Math.max(0, Math.floor(Number(patch.cartons) || 0));
  if (patch.weight !== undefined) row.weight = patch.weight;
  if (patch.sort_order !== undefined) row.sort_order = patch.sort_order;
  if (Object.keys(row).length === 0) return { error: null };
  const { error } = await supabase.from('packing_list_items').update(row).eq('id', itemId);
  return { error: error?.message ?? null };
}
