import type { BespokeFabricMaterial, BespokeMetadata } from '@/app/types/bespoke';
import { buildBespokeMetadataForPersist, normalizeFabricMaterials } from '@/app/types/bespoke';
import type { LooseFabricProductOption } from '@/app/services/bespokeFabricProductService';

/** Client-side cart line flags for injected fabric children. */
export type BespokeInjectedRole = 'fabric';

export type BespokeParentCartRef = number | string;

export interface BespokeCartLineBase {
  id: number | string;
  productId: number | string;
  name: string;
  sku: string;
  price: number;
  qty: number;
  variationId?: string;
  unit?: string;
  customizationDetails?: Record<string, unknown> | null;
  bespokeParentCartId?: BespokeParentCartRef;
  bespokeRole?: BespokeInjectedRole;
  isBespokeInjected?: boolean;
}

export interface BespokeInjectionPayload {
  metadata: BespokeMetadata;
  fabrics: BespokeFabricMaterial[];
}

export const BESPOKE_GENERIC_SKU_PREFIX = 'CUSTOM-';

export function isBespokeGenericSku(sku: string | null | undefined): boolean {
  if (!sku) return false;
  return sku.trim().toUpperCase().startsWith(BESPOKE_GENERIC_SKU_PREFIX);
}

export function isInjectedBespokeLine(item: BespokeCartLineBase): boolean {
  return !!item.isBespokeInjected || item.bespokeRole === 'fabric' || item.bespokeParentCartId != null;
}

/** Retail unit price for an injected fabric material (picker or hydrated row). */
export function resolveFabricMaterialRetailPrice(fabric: BespokeFabricMaterial): number {
  const fromMaterial = Number(fabric.retail_price);
  if (Number.isFinite(fromMaterial) && fromMaterial > 0) return fromMaterial;
  return 0;
}

function fabricMaterialToOption(mat: BespokeFabricMaterial): Partial<LooseFabricProductOption> {
  return {
    product_id: mat.product_id,
    variation_id: mat.variation_id,
    name: mat.product_name,
    sku: mat.sku ?? '',
    unit_code: mat.unit_code || 'm',
    retail_price: 0,
  };
}

export function buildFabricCartLine<T extends BespokeCartLineBase>(
  fabric: BespokeFabricMaterial,
  parentCartId: BespokeParentCartRef,
  retailPrice: number,
  createId: () => number | string,
): T {
  const opt = fabricMaterialToOption(fabric);
  return {
    id: createId(),
    productId: fabric.product_id,
    name: fabric.product_name || opt.name || 'Fabric',
    sku: fabric.sku || opt.sku || '—',
    price: retailPrice,
    qty: fabric.quantity,
    variationId: fabric.variation_id,
    unit: fabric.unit_code || 'm',
    bespokeParentCartId: parentCartId,
    bespokeRole: 'fabric',
    isBespokeInjected: true,
    customizationDetails: null,
  } as T;
}

/**
 * Remove prior injected fabric lines for parent; append new fabric lines.
 * Parent line keeps metadata-only customizationDetails and unchanged base price.
 */
function sameCartRef(a: BespokeParentCartRef, b: BespokeParentCartRef): boolean {
  return String(a) === String(b);
}

export function syncFabricChildLines<T extends BespokeCartLineBase>(
  items: T[],
  parentCartId: BespokeParentCartRef,
  fabrics: BespokeFabricMaterial[],
  resolveFabricPrice: (fabric: BespokeFabricMaterial) => number,
  createId: () => number | string,
): { items: T[]; parentMetadata: BespokeMetadata | null } {
  const parent = items.find((i) => sameCartRef(i.id, parentCartId));
  if (!parent) return { items, parentMetadata: null };

  const withoutInjected = items.filter(
    (i) => !(sameCartRef(i.id, parentCartId) === false && i.bespokeParentCartId != null && sameCartRef(i.bespokeParentCartId, parentCartId)),
  );

  const validFabrics = normalizeFabricMaterials(fabrics).filter((m) => m.product_id && m.quantity > 0);
  const newFabricLines = validFabrics.map((f) =>
    buildFabricCartLine<T>(f, parentCartId, resolveFabricPrice(f), createId),
  );

  const parentIdx = withoutInjected.findIndex((i) => sameCartRef(i.id, parentCartId));
  const metadata =
    buildBespokeMetadataForPersist(parent.customizationDetails) ??
    buildBespokeMetadataForPersist({});

  const updatedParent = {
    ...withoutInjected[parentIdx],
    customizationDetails: metadata as Record<string, unknown>,
  } as T;

  const next = [...withoutInjected];
  next[parentIdx] = updatedParent;
  const insertAt = parentIdx + 1;
  next.splice(insertAt, 0, ...newFabricLines);

  return { items: next, parentMetadata: metadata };
}

/** Build sale line ordering: each parent followed by its injected children; assign parent_line_index. */
export function orderSaleLinesForPersist<
  T extends {
    productId: string;
    bespokeParentCartId?: BespokeParentCartRef;
    parentLineIndex?: number;
    id: string | number;
  },
>(lines: T[]): (T & { parentLineIndex?: number })[] {
  const parents = lines.filter((l) => l.bespokeParentCartId == null);
  const result: (T & { parentLineIndex?: number })[] = [];

  for (const p of parents) {
    const pIndex = result.length;
    result.push({ ...p, parentLineIndex: undefined });
    const children = lines.filter(
      (c) => c.bespokeParentCartId != null && sameCartRef(c.bespokeParentCartId, p.id),
    );
    for (const c of children) {
      result.push({ ...c, parentLineIndex: pIndex });
    }
  }

  const orphanChildren = lines.filter(
    (c) =>
      c.bespokeParentCartId != null &&
      !parents.some((p) => sameCartRef(c.bespokeParentCartId!, p.id)),
  );
  for (const c of orphanChildren) {
    result.push(c);
  }

  return result;
}

export function hydrateFabricDraftsFromChildren<
  T extends BespokeCartLineBase & { productId: string | number },
>(parentCartId: BespokeParentCartRef, allItems: T[]): BespokeFabricMaterial[] {
  return allItems
    .filter((i) => i.bespokeParentCartId != null && sameCartRef(i.bespokeParentCartId, parentCartId) && i.bespokeRole === 'fabric')
    .map((i) => ({
      product_id: String(i.productId),
      variation_id: i.variationId,
      product_name: i.name,
      sku: i.sku,
      unit_code: i.unit || 'm',
      quantity: i.qty,
    }));
}
