/**
 * Mobile parity with web `studioStockLifecycleService`: one PRODUCTION_IN @ qty 1 (finished unit), idempotent.
 */
import { supabase } from '../lib/supabase';

export const STUDIO_FINISHED_GOODS_QTY = 1 as const;

function sumProductionCostFromStages(
  stages: Array<{ status?: string; cost?: unknown; expected_cost?: unknown }>
): number {
  return stages.reduce((sum, s) => {
    const st = String(s.status || '').toLowerCase();
    const cost =
      st === 'completed'
        ? Number((s as { cost?: number }).cost) || 0
        : Number((s as { expected_cost?: number }).expected_cost) || 0;
    return sum + cost;
  }, 0);
}

export async function ensureStudioProductionInForSale(
  saleId: string
): Promise<{ inserted: boolean; skippedReason?: string }> {
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('id, company_id, branch_id')
    .eq('id', saleId)
    .maybeSingle();
  if (saleErr || !sale) return { inserted: false, skippedReason: 'sale_not_found' };

  const { data: prods, error: pErr } = await supabase
    .from('studio_productions')
    .select('id, production_no, branch_id, sale_id')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: true })
    .limit(1);
  if (pErr || !prods?.length) return { inserted: false, skippedReason: 'no_production' };
  const production = prods[0] as { id: string; production_no?: string | null; branch_id?: string | null };

  const { data: items } = await supabase
    .from('sales_items')
    .select('id, product_id, quantity, is_studio_product')
    .eq('sale_id', saleId);
  const studioItem = (items || []).find(
    (i: { is_studio_product?: boolean | null }) => i.is_studio_product === true
  );
  if (!studioItem?.product_id) return { inserted: false, skippedReason: 'no_studio_line' };

  const productId = String(studioItem.product_id);
  const qty = STUDIO_FINISHED_GOODS_QTY;

  const { data: v2OrderRows } = await supabase
    .from('studio_production_orders_v2')
    .select('id')
    .eq('sale_id', saleId);
  const refIdsForDupCheck = Array.from(
    new Set([production.id, ...((v2OrderRows || []) as { id: string }[]).map((r) => r.id)])
  );
  const { data: existingRows } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('reference_type', 'studio_production')
    .eq('movement_type', 'PRODUCTION_IN')
    .eq('product_id', productId)
    .in('reference_id', refIdsForDupCheck);
  if (existingRows && existingRows.length > 0) {
    return { inserted: false, skippedReason: 'already_exists' };
  }

  const { data: stageRows } = await supabase
    .from('studio_production_stages')
    .select('id, status, cost, expected_cost')
    .eq('production_id', production.id);
  let productionCost = sumProductionCostFromStages((stageRows || []) as any[]);

  if (productionCost <= 0) {
    const { data: prodRow } = await supabase.from('products').select('cost_price').eq('id', productId).maybeSingle();
    productionCost = Number((prodRow as { cost_price?: number } | null)?.cost_price) || 0;
  }
  if (productionCost <= 0) return { inserted: false, skippedReason: 'zero_production_cost' };

  const unitCost = productionCost / qty;
  const companyId = String((sale as { company_id: string }).company_id);
  const branchId = ((sale as { branch_id?: string | null }).branch_id ?? production.branch_id ?? null) as string | null;

  const { data: auth } = await supabase.auth.getUser();

  const { error: insErr } = await supabase.from('stock_movements').insert({
    company_id: companyId,
    branch_id: branchId,
    product_id: productId,
    variation_id: null,
    movement_type: 'PRODUCTION_IN',
    quantity: qty,
    unit_cost: unitCost,
    total_cost: productionCost,
    reference_type: 'studio_production',
    reference_id: production.id,
    notes: `Studio finished goods IN — ${production.production_no ?? saleId.slice(0, 8)} (production cost)`,
    created_by: auth?.user?.id ?? null,
  });

  if (insErr) {
    console.warn('[studioStockLifecycle] PRODUCTION_IN insert failed:', insErr.message);
    return { inserted: false, skippedReason: insErr.message };
  }
  return { inserted: true };
}
