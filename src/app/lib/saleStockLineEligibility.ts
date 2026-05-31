/**
 * Which sale lines post physical stock at Final vs defer until bespoke work order complete.
 */

import { isBespokeGenericSku } from '@/app/lib/bespokeCartInjection';
import {
  type BespokeFabricMaterial,
  hasBespokeContent,
  normalizeFabricMaterials,
  parseCustomizationDetails,
} from '@/app/types/bespoke';

export type SaleLineStockContext = {
  product_id: string;
  variation_id?: string | null;
  quantity?: number | null;
  bespoke_parent_item_id?: string | null;
  customization_details?: unknown;
  product_sku?: string | null;
  track_stock?: boolean | null;
};

export type SaleLineProductMeta = {
  sku?: string | null;
  track_stock?: boolean | null;
};

export function isBespokeFabricChildLine(line: SaleLineStockContext): boolean {
  const parentId = line.bespoke_parent_item_id;
  return parentId != null && String(parentId).trim() !== '';
}

export function isBespokeGenericParentLine(
  line: SaleLineStockContext,
  product?: SaleLineProductMeta | null,
  customGenericProductIds?: string[] | null,
): boolean {
  if (isBespokeFabricChildLine(line)) return false;
  const sku = (product?.sku ?? line.product_sku ?? '').trim();
  if (isBespokeGenericSku(sku)) return true;
  if (customGenericProductIds?.includes(line.product_id)) return true;
  const trackStock = product?.track_stock ?? line.track_stock;
  if (trackStock === false) return true;
  const details = parseCustomizationDetails(line.customization_details);
  if (hasBespokeContent(details)) return true;
  return false;
}

/** True when this line must not post stock at sale Final (fabric posts on WO complete). */
export function isSaleLineStockDeferred(
  line: SaleLineStockContext,
  product?: SaleLineProductMeta | null,
  customGenericProductIds?: string[] | null,
): boolean {
  if (isBespokeFabricChildLine(line)) return true;
  if (isBespokeGenericParentLine(line, product, customGenericProductIds)) return true;
  const trackStock = product?.track_stock ?? line.track_stock;
  if (trackStock === false) return true;
  return false;
}

/** Lines that should contribute to Final stock OUT / Z1 sync expected qty. */
export function filterSaleLinesForStockPosting<T extends SaleLineStockContext>(
  lines: T[],
  productMap?: Map<string, SaleLineProductMeta>,
  customGenericProductIds?: string[] | null,
): T[] {
  return lines.filter((line) => {
    const product = productMap?.get(line.product_id);
    return !isSaleLineStockDeferred(line, product, customGenericProductIds);
  });
}

export type WorkOrderFabricLine = {
  product_id: string;
  variation_id: string | null;
  quantity: number;
  product_name: string;
  sku?: string;
  unit_price?: number;
};

/**
 * Fabric to consume when a bespoke work order completes.
 * Prefers injected child sales_items; falls back to legacy fabric_materials JSON on parent.
 */
export function getFabricMaterialsForWorkOrder(
  parentItem: {
    id?: string;
    customization_details?: unknown;
  },
  childLines: Array<{
    bespoke_parent_item_id?: string | null;
    product_id: string;
    variation_id?: string | null;
    quantity?: number | null;
    product_name?: string | null;
    sku?: string | null;
    unit_price?: number | null;
  }>,
): WorkOrderFabricLine[] {
  const parentId = parentItem.id ? String(parentItem.id) : '';
  const fromChildren = childLines
    .filter((c) => parentId && String(c.bespoke_parent_item_id ?? '') === parentId)
    .map((c) => ({
      product_id: String(c.product_id),
      variation_id: c.variation_id ?? null,
      quantity: Number(c.quantity) || 0,
      product_name: String(c.product_name ?? ''),
      sku: c.sku ?? undefined,
      unit_price: c.unit_price != null ? Number(c.unit_price) : undefined,
    }))
    .filter((c) => c.quantity > 0);

  if (fromChildren.length > 0) return fromChildren;

  const details = parseCustomizationDetails(parentItem.customization_details);
  const materials: BespokeFabricMaterial[] =
    details?.fabric_materials ?? normalizeFabricMaterials(
      (parentItem.customization_details as Record<string, unknown> | null)?.fabric_materials,
    );

  return materials
    .filter((m) => m.product_id && m.quantity > 0)
    .map((m) => ({
      product_id: m.product_id,
      variation_id: m.variation_id ?? null,
      quantity: m.quantity,
      product_name: m.product_name || m.sku || m.product_id,
      sku: m.sku,
      unit_price: m.retail_price,
    }));
}
