import { supabase } from '@/lib/supabase';

const NULL_UUID = '00000000-0000-0000-0000-000000000000';

export const BESPOKE_WO_RELINK_MIGRATION_HINT =
  'Database migration required: apply migrations/20260602130000_bespoke_work_orders_parent_fk_set_null.sql on Supabase before editing sales with bespoke work orders.';

let migrationProbeCache: boolean | null = null;

function isMigrationMissingRpcError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('could not find the function') ||
    m.includes('function public.snapshot_bespoke_work_order_anchors') ||
    m.includes('schema cache')
  );
}

function isMigrationMissingColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('parent_product_id') && (m.includes('column') || m.includes('schema cache'));
}

/** Probe whether WO relink migration (anchor columns + RPCs) is on the connected DB. */
export async function isBespokeWoRelinkMigrationAvailable(): Promise<boolean> {
  if (migrationProbeCache != null) return migrationProbeCache;

  const { error: colErr } = await supabase.from('bespoke_work_orders').select('parent_product_id').limit(1);
  if (colErr && isMigrationMissingColumnError(colErr.message)) {
    migrationProbeCache = false;
    return false;
  }

  const { error: rpcErr } = await supabase.rpc('snapshot_bespoke_work_order_anchors', {
    p_sale_id: '00000000-0000-0000-0000-000000000000',
  });
  if (rpcErr && isMigrationMissingRpcError(rpcErr.message)) {
    migrationProbeCache = false;
    return false;
  }

  migrationProbeCache = true;
  return true;
}

async function saleHasActiveWorkOrders(saleId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('bespoke_work_orders')
    .select('id')
    .eq('sale_id', saleId)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function assertWoRelinkMigrationForSale(saleId: string): Promise<void> {
  const hasWo = await saleHasActiveWorkOrders(saleId);
  if (!hasWo) return;
  const ok = await isBespokeWoRelinkMigrationAvailable();
  if (!ok) {
    throw new Error(BESPOKE_WO_RELINK_MIGRATION_HINT);
  }
}

/** Persist product/variation anchors on WOs before sales_items delete (FK SET NULL). */
export async function snapshotBespokeWorkOrderAnchors(saleId: string): Promise<void> {
  await assertWoRelinkMigrationForSale(saleId);

  const { error } = await supabase.rpc('snapshot_bespoke_work_order_anchors', {
    p_sale_id: saleId,
  });
  if (!error) return;

  if (isMigrationMissingRpcError(error.message)) {
    migrationProbeCache = false;
    throw new Error(BESPOKE_WO_RELINK_MIGRATION_HINT);
  }

  const { data: wos } = await supabase
    .from('bespoke_work_orders')
    .select('id, parent_sales_item_id')
    .eq('sale_id', saleId)
    .not('parent_sales_item_id', 'is', null);

  if (!wos?.length) return;

  const parentIds = [...new Set(wos.map((w) => String(w.parent_sales_item_id)))];
  const { data: parents } = await supabase
    .from('sales_items')
    .select('id, product_id, variation_id')
    .in('id', parentIds);

  const parentById = new Map(
    (parents ?? []).map((p) => [
      String(p.id),
      { product_id: String(p.product_id), variation_id: p.variation_id as string | null },
    ]),
  );

  for (const wo of wos) {
    const parent = parentById.get(String(wo.parent_sales_item_id));
    if (!parent) continue;
    const { error: upErr } = await supabase
      .from('bespoke_work_orders')
      .update({
        parent_product_id: parent.product_id,
        parent_variation_id: parent.variation_id,
      })
      .eq('id', wo.id);
    if (upErr) {
      if (isMigrationMissingColumnError(upErr.message)) {
        migrationProbeCache = false;
        throw new Error(BESPOKE_WO_RELINK_MIGRATION_HINT);
      }
      throw upErr;
    }
  }
  if (import.meta.env?.DEV) {
    console.warn('[bespokeWorkOrderRelink] snapshot via RPC failed, used fallback:', error.message);
  }
}

/** Restore parent_sales_item_id after sale line replace. */
export async function relinkBespokeWorkOrdersAfterSaleItemReplace(saleId: string): Promise<number> {
  const { data, error } = await supabase.rpc('relink_bespoke_work_orders_for_sale', {
    p_sale_id: saleId,
  });
  if (!error && typeof data === 'number') return data;

  if (error && isMigrationMissingRpcError(error.message)) {
    migrationProbeCache = false;
    throw new Error(BESPOKE_WO_RELINK_MIGRATION_HINT);
  }

  const { data: wos, error: woErr } = await supabase
    .from('bespoke_work_orders')
    .select('id, parent_product_id, parent_variation_id')
    .eq('sale_id', saleId)
    .is('parent_sales_item_id', null)
    .not('parent_product_id', 'is', null)
    .order('created_at', { ascending: true });

  if (woErr) {
    if (isMigrationMissingColumnError(woErr.message)) {
      migrationProbeCache = false;
      throw new Error(BESPOKE_WO_RELINK_MIGRATION_HINT);
    }
    throw woErr;
  }
  if (!wos?.length) return 0;

  const { data: parentLines, error: lineErr } = await supabase
    .from('sales_items')
    .select('id, product_id, variation_id, created_at')
    .eq('sale_id', saleId)
    .is('bespoke_parent_item_id', null)
    .order('created_at', { ascending: true });

  if (lineErr) throw lineErr;

  const { data: linked } = await supabase
    .from('bespoke_work_orders')
    .select('parent_sales_item_id')
    .eq('sale_id', saleId)
    .not('parent_sales_item_id', 'is', null);

  const usedParentIds = new Set(
    (linked ?? []).map((r) => String(r.parent_sales_item_id)).filter(Boolean),
  );

  let relinked = 0;
  for (const wo of wos) {
    const productId = String(wo.parent_product_id);
    const variationId = wo.parent_variation_id ? String(wo.parent_variation_id) : null;
    const match = (parentLines ?? []).find((line) => {
      if (usedParentIds.has(String(line.id))) return false;
      if (String(line.product_id) !== productId) return false;
      const lineVar = line.variation_id ? String(line.variation_id) : null;
      return (variationId ?? NULL_UUID) === (lineVar ?? NULL_UUID);
    });
    if (!match) {
      if (import.meta.env?.DEV) {
        console.warn('[bespokeWorkOrderRelink] no parent match for WO', wo.id, productId);
      }
      continue;
    }
    const { error: upErr } = await supabase
      .from('bespoke_work_orders')
      .update({ parent_sales_item_id: match.id })
      .eq('id', wo.id);
    if (upErr) throw upErr;
    usedParentIds.add(String(match.id));
    relinked += 1;
  }

  if (error && import.meta.env?.DEV) {
    console.warn('[bespokeWorkOrderRelink] RPC relink failed, used fallback:', error.message);
  }

  const { data: stillOrphaned } = await supabase
    .from('bespoke_work_orders')
    .select('id')
    .eq('sale_id', saleId)
    .is('parent_sales_item_id', null)
    .not('parent_product_id', 'is', null)
    .limit(1);

  if (stillOrphaned?.length) {
    throw new Error(
      'Sale lines updated but bespoke work order could not be re-linked to the parent line. Check product matches.',
    );
  }

  return relinked;
}
