import { supabase } from '@/lib/supabase';
import { productService } from '@/app/services/productService';
import {
  type BespokeFabricMaterial,
  parseCustomizationDetails,
  normalizeFabricMaterials,
} from '@/app/types/bespoke';

const BESPOKE_FABRIC_NOTE_TOKEN = 'bespoke fabric';

export function extractFabricMaterialsFromSaleItems(
  rows: Array<{ customization_details?: unknown }>,
): BespokeFabricMaterial[] {
  const seen = new Map<string, BespokeFabricMaterial>();
  for (const row of rows) {
    const details = parseCustomizationDetails(row.customization_details);
    const materials = details?.fabric_materials ?? normalizeFabricMaterials(
      (row.customization_details as Record<string, unknown> | null)?.fabric_materials,
    );
    for (const m of materials) {
      if (!m.product_id || m.quantity <= 0) continue;
      const key = `${m.product_id}:${m.variation_id ?? ''}`;
      const existing = seen.get(key);
      if (existing) {
        existing.quantity += m.quantity;
      } else {
        seen.set(key, { ...m });
      }
    }
  }
  return Array.from(seen.values());
}

async function fetchExistingBespokeFabricKeys(saleId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('stock_movements')
    .select('product_id, variation_id, notes')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
    .eq('movement_type', 'sale');
  const keys = new Set<string>();
  for (const row of data ?? []) {
    const notes = String((row as { notes?: string }).notes ?? '').toLowerCase();
    if (!notes.includes(BESPOKE_FABRIC_NOTE_TOKEN)) continue;
    const pid = String((row as { product_id?: string }).product_id ?? '');
    const vid = String((row as { variation_id?: string }).variation_id ?? '');
    if (pid) keys.add(`${pid}:${vid}`);
  }
  return keys;
}

async function resolveUnitCost(companyId: string, productId: string): Promise<number> {
  const { data: movements } = await supabase
    .from('stock_movements')
    .select('quantity, unit_cost, total_cost')
    .eq('company_id', companyId)
    .eq('product_id', productId)
    .in('movement_type', ['purchase', 'opening_stock']);
  let sum = 0;
  let qty = 0;
  for (const m of movements ?? []) {
    const mQty = Math.abs(Number((m as { quantity?: number }).quantity) || 0);
    const mCost = Math.abs(
      Number((m as { total_cost?: number }).total_cost) ||
        mQty * (Number((m as { unit_cost?: number }).unit_cost) || 0),
    );
    sum += mCost;
    qty += mQty;
  }
  if (qty > 0) return sum / qty;
  const { data: product } = await supabase
    .from('products')
    .select('cost_price')
    .eq('id', productId)
    .maybeSingle();
  return Number((product as { cost_price?: number } | null)?.cost_price) || 0;
}

export interface PostBespokeFabricStockParams {
  saleId: string;
  companyId: string;
  branchId?: string | null;
  invoiceNo?: string;
  createdBy?: string;
  /** When provided, skip DB fetch (e.g. right after item insert). */
  saleItemRows?: Array<{ customization_details?: unknown }>;
}

/**
 * Post stock OUT for loose fabrics linked in customization_details.fabric_materials.
 * Idempotent per sale + product + variation (skips if movement already exists).
 */
export async function postBespokeFabricStockOnFinalize(
  params: PostBespokeFabricStockParams,
): Promise<number> {
  const { saleId, companyId, branchId, invoiceNo, createdBy, saleItemRows } = params;
  let rows = saleItemRows;
  if (!rows) {
    const { data } = await supabase
      .from('sales_items')
      .select('customization_details')
      .eq('sale_id', saleId);
    rows = data ?? [];
  }
  const materials = extractFabricMaterialsFromSaleItems(rows);
  if (materials.length === 0) return 0;

  const existingKeys = await fetchExistingBespokeFabricKeys(saleId);
  const label = invoiceNo?.trim() || saleId;
  let posted = 0;

  for (const m of materials) {
    const key = `${m.product_id}:${m.variation_id ?? ''}`;
    if (existingKeys.has(key)) continue;

    const unitCost = await resolveUnitCost(companyId, m.product_id);
    await productService.createStockMovement({
      company_id: companyId,
      branch_id: branchId ?? undefined,
      product_id: m.product_id,
      variation_id: m.variation_id,
      movement_type: 'sale',
      quantity: -Math.abs(m.quantity),
      unit_cost: unitCost,
      reference_type: 'sale',
      reference_id: saleId,
      notes: `Sale ${label} – bespoke fabric: ${m.product_name || m.sku || m.product_id}`,
      created_by: createdBy,
    });
    existingKeys.add(key);
    posted += 1;
  }

  return posted;
}
