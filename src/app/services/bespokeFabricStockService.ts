import { supabase } from '@/lib/supabase';
import { productService } from '@/app/services/productService';
import {
  type BespokeFabricMaterial,
  hasBespokeContent,
  parseCustomizationDetails,
  normalizeFabricMaterials,
} from '@/app/types/bespoke';
import { getFabricMaterialsForWorkOrder } from '@/app/lib/saleStockLineEligibility';

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

export interface PostBespokeFabricStockResult {
  posted: number;
  error?: string;
}

function detectUnlinkedFabricMismatch(
  parentItem: { id?: string; customization_details?: unknown } | null,
  parentSalesItemId: string,
  childLines: Array<{
    id?: string;
    bespoke_parent_item_id?: string | null;
    product_id?: string;
    quantity?: number | null;
  }>,
): string | null {
  const parentId = parentItem?.id ? String(parentItem.id) : parentSalesItemId;
  const fabrics = getFabricMaterialsForWorkOrder(parentItem ?? { id: parentId }, childLines);
  if (fabrics.length > 0) return null;

  const parentDetails = parseCustomizationDetails(parentItem?.customization_details);
  const parentIsBespoke = hasBespokeContent(parentDetails);
  const otherLines = childLines.filter((c) => String(c.id ?? '') !== parentId);
  const unlinkedOthers = otherLines.filter((c) => !c.bespoke_parent_item_id);
  if (parentIsBespoke && unlinkedOthers.length > 0) {
    return 'Fabric lines on this sale are not linked to the parent line. Edit and re-save the sale, then use Post stock.';
  }
  return null;
}

export interface PostBespokeFabricStockParams {
  saleId: string;
  companyId: string;
  branchId?: string | null;
  invoiceNo?: string;
  createdBy?: string;
  saleItemRows?: Array<{ customization_details?: unknown }>;
}

/** True when sale has fabric children or legacy fabric_materials for this work order parent. */
export function saleHasFabricForWorkOrder(
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

/** Original movement still counts as posted only if no matching reversal row exists. */
export function isBespokeStockMovementActive(
  note: string,
  allNotes: string[],
  woLabel: string,
): boolean {
  const notes = String(note ?? '');
  if (!notes || notes.startsWith('Bespoke stock reversal')) return false;
  const reversalNote = `Bespoke stock reversal — ${woLabel} — ${notes}`;
  return !allNotes.includes(reversalNote);
}

/** True when WO has stock rows not yet offset by a matching reversal movement. */
export async function hasWorkOrderActiveStockMovements(
  workOrderId: string,
  workOrderNo?: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('stock_movements')
    .select('id, notes')
    .eq('reference_type', 'bespoke_work_order')
    .eq('reference_id', workOrderId);
  const rows = (data ?? []) as Array<{ notes?: string }>;
  const woLabel = workOrderNo?.trim() || workOrderId;
  const allNotes = rows.map((r) => String(r.notes ?? ''));
  return allNotes.some((n) => isBespokeStockMovementActive(n, allNotes, woLabel));
}

export async function hasWorkOrderFabricStockMovements(workOrderId: string): Promise<boolean> {
  const { data } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('reference_type', 'bespoke_work_order')
    .eq('reference_id', workOrderId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export const BESPOKE_FABRIC_STOCK_NOTE_PREFIX = 'Bespoke fabric OUT';
export const BESPOKE_PARENT_STOCK_NOTE_PREFIX = 'Bespoke custom order IN';
/** Legacy RPC rows before 20260602150000 */
export const BESPOKE_PARENT_STOCK_LEGACY_OUT_PREFIX = 'Bespoke custom order OUT';

export function isBespokeParentStockNote(notes: string | null | undefined): boolean {
  const n = String(notes ?? '');
  return (
    n.startsWith(BESPOKE_PARENT_STOCK_NOTE_PREFIX) ||
    n.startsWith(BESPOKE_PARENT_STOCK_LEGACY_OUT_PREFIX)
  );
}

export type WorkOrderStockPostStatus = {
  fabricPosted: boolean;
  parentPosted: boolean;
  expectsFabric: boolean;
  needsStockPost: boolean;
};

/** Whether fabric + parent custom-order stock are actively posted (not reversed) for this WO. */
export async function getWorkOrderStockPostStatus(
  workOrderId: string,
  parentSalesItemId: string,
  saleId: string,
  workOrderNo?: string,
): Promise<WorkOrderStockPostStatus> {
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
    parentItem,
    parentSalesItemId,
    childLines ?? [],
  );
  const needsStockPost =
    (!fabricPosted && expectsFabric) || !parentPosted;

  return { fabricPosted, parentPosted, expectsFabric, needsStockPost };
}

const PARENT_STOCK_NOTE_PREFIX = BESPOKE_PARENT_STOCK_NOTE_PREFIX;

async function hasWorkOrderParentStockMovement(
  workOrderId: string,
  productId: string,
  variationId?: string | null,
): Promise<boolean> {
  let query = supabase
    .from('stock_movements')
    .select('id, notes')
    .eq('reference_type', 'bespoke_work_order')
    .eq('reference_id', workOrderId)
    .eq('product_id', productId)
    .limit(5);
  if (variationId) {
    query = query.eq('variation_id', variationId);
  } else {
    query = query.is('variation_id', null);
  }
  const { data } = await query;
  return (data ?? []).some((row) =>
    isBespokeParentStockNote(String((row as { notes?: string }).notes ?? '')),
  );
}

/**
 * @deprecated Fabric stock posts on work order complete (DB RPC). Kept for legacy callers only.
 */
export async function postBespokeFabricStockOnFinalize(
  _params: PostBespokeFabricStockParams,
): Promise<number> {
  return 0;
}

/** Notify UI after RPC posts fabric stock for a completed work order. */
export function dispatchBespokeFabricStockUpdated(saleId: string): void {
  window.dispatchEvent(new CustomEvent('saleSaved', { detail: { saleId } }));
  window.dispatchEvent(new CustomEvent('erp-mobile:autosync-complete'));
}

/**
 * Client fallback if RPC did not post fabric (e.g. migration not applied).
 * Prefer `complete_bespoke_work_order` which posts stock atomically.
 */
export async function postBespokeFabricStockOnWorkOrderComplete(
  workOrderId: string,
): Promise<number> {
  const { data: wo, error } = await supabase
    .from('bespoke_work_orders')
    .select('id, sale_id, company_id, branch_id, parent_sales_item_id, work_order_no')
    .eq('id', workOrderId)
    .maybeSingle();
  if (error || !wo) return 0;

  const saleId = String((wo as { sale_id: string }).sale_id);
  const parentSalesItemId = String((wo as { parent_sales_item_id: string }).parent_sales_item_id);

  const [{ data: parentItem }, { data: childLines }, { data: auth }] = await Promise.all([
    supabase
      .from('sales_items')
      .select(
        'id, product_id, variation_id, quantity, product_name, sku, unit_price, customization_details',
      )
      .eq('id', parentSalesItemId)
      .maybeSingle(),
    supabase
      .from('sales_items')
      .select(
        'id, bespoke_parent_item_id, product_id, variation_id, quantity, product_name, sku, unit_price',
      )
      .eq('sale_id', saleId),
    supabase.auth.getUser(),
  ]);

  const fabrics = getFabricMaterialsForWorkOrder(
    parentItem ?? { id: parentSalesItemId },
    childLines ?? [],
  );

  const companyId = String((wo as { company_id: string }).company_id);
  const branchId = (wo as { branch_id?: string | null }).branch_id ?? null;
  const woNo = String((wo as { work_order_no?: string }).work_order_no ?? workOrderId);
  let posted = 0;

  for (const m of fabrics) {
    const { data: existingFabric } = await supabase
      .from('stock_movements')
      .select('id')
      .eq('reference_type', 'bespoke_work_order')
      .eq('reference_id', workOrderId)
      .eq('product_id', m.product_id)
      .limit(1);
    if ((existingFabric?.length ?? 0) > 0) continue;

    const unitCost =
      m.unit_price != null && m.unit_price > 0
        ? m.unit_price
        : await resolveUnitCost(companyId, m.product_id);
    await productService.createStockMovement({
      company_id: companyId,
      branch_id: branchId ?? undefined,
      product_id: m.product_id,
      variation_id: m.variation_id ?? undefined,
      movement_type: 'sale',
      quantity: -Math.abs(m.quantity),
      unit_cost: unitCost,
      reference_type: 'bespoke_work_order',
      reference_id: workOrderId,
      notes: `${BESPOKE_FABRIC_STOCK_NOTE_PREFIX} — ${woNo} — ${m.product_name || m.sku || m.product_id}`,
      created_by: auth?.user?.id ?? undefined,
    });
    posted += 1;
  }

  if (fabrics.length === 0) {
    const mismatch = detectUnlinkedFabricMismatch(
      parentItem,
      parentSalesItemId,
      childLines ?? [],
    );
    if (mismatch) throw new Error(mismatch);
  }

  const parentRow = parentItem as {
    product_id?: string;
    variation_id?: string | null;
    quantity?: number | null;
    product_name?: string | null;
    sku?: string | null;
    unit_price?: number | null;
  } | null;
  const parentProductId = parentRow?.product_id ? String(parentRow.product_id) : '';
  const parentQty = Number(parentRow?.quantity) || 0;
  if (parentProductId && parentQty > 0) {
    const parentVid = parentRow?.variation_id ?? undefined;
    const alreadyParent = await hasWorkOrderParentStockMovement(
      workOrderId,
      parentProductId,
      parentVid,
    );
    if (!alreadyParent) {
      const parentUnitCost =
        parentRow?.unit_price != null && Number(parentRow.unit_price) > 0
          ? Number(parentRow.unit_price)
          : await resolveUnitCost(companyId, parentProductId);
      const parentName =
        parentRow?.product_name || parentRow?.sku || parentProductId;
      await productService.createStockMovement({
        company_id: companyId,
        branch_id: branchId ?? undefined,
        product_id: parentProductId,
        variation_id: parentVid,
        movement_type: 'sale',
        quantity: Math.abs(parentQty),
        unit_cost: parentUnitCost,
        reference_type: 'bespoke_work_order',
        reference_id: workOrderId,
        notes: `${PARENT_STOCK_NOTE_PREFIX} — ${woNo} — ${parentName}`,
        created_by: auth?.user?.id ?? undefined,
      });
      posted += 1;
    }
  }

  if (posted > 0) dispatchBespokeFabricStockUpdated(saleId);
  return posted;
}

/** Idempotent stock post for completed work orders (fabric + custom parent). */
export const repostWorkOrderStock = postBespokeFabricStockOnWorkOrderComplete;
