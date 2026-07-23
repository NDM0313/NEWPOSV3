import type { BespokeFabricMaterial, BespokeFabricUsage, BespokeMetadata } from '@/app/types/bespoke';
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
  /** Piece-type preset attached to injected fabric line (display). */
  bespokeUsage?: BespokeFabricUsage;
  /** Catalog retail unit price for UI only — billed price stays 0. */
  bespokeRefUnitPrice?: number;
}

export interface BespokeInjectionPayload {
  metadata: BespokeMetadata;
  fabrics: BespokeFabricMaterial[];
}

export const BESPOKE_GENERIC_SKU_PREFIX = 'CUSTOM-';

export const FABRIC_USAGE_LABELS: Record<BespokeFabricUsage, string> = {
  shirt: 'Shirt',
  dupatta: 'Dupatta',
  trouser: 'Trouser',
};

const FABRIC_USAGE_PREFIXES: Array<{ usage: BespokeFabricUsage; prefix: string }> = (
  Object.entries(FABRIC_USAGE_LABELS) as Array<[BespokeFabricUsage, string]>
).map(([usage, label]) => ({ usage, prefix: `${label} — ` }));

export function parseFabricUsage(raw: unknown): BespokeFabricUsage | undefined {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'shirt' || v === 'dupatta' || v === 'trouser') return v;
  return undefined;
}

export function formatFabricLineName(
  productName: string,
  usage?: BespokeFabricUsage | null,
): string {
  const base = (productName || 'Fabric').trim() || 'Fabric';
  if (!usage) return base;
  const label = FABRIC_USAGE_LABELS[usage];
  return label ? `${label} — ${base}` : base;
}

export function stripFabricUsagePrefix(name: string): {
  productName: string;
  usage?: BespokeFabricUsage;
} {
  const raw = String(name ?? '');
  for (const { usage, prefix } of FABRIC_USAGE_PREFIXES) {
    if (raw.startsWith(prefix)) {
      return { productName: raw.slice(prefix.length).trim() || raw, usage };
    }
  }
  return { productName: raw };
}

export function isBespokeGenericSku(sku: string | null | undefined): boolean {
  if (!sku) return false;
  return sku.trim().toUpperCase().startsWith(BESPOKE_GENERIC_SKU_PREFIX);
}

export function isInjectedBespokeLine(item: BespokeCartLineBase): boolean {
  return !!item.isBespokeInjected || item.bespokeRole === 'fabric' || item.bespokeParentCartId != null;
}

/** Fabric stock lines bill at 0 — retail is display-only via bespokeRefUnitPrice. */
export function resolveFabricMaterialRetailPrice(_fabric: BespokeFabricMaterial): number {
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

function pickRawFabricMeta(
  rawList: BespokeFabricMaterial[],
  normalized: BespokeFabricMaterial,
  index: number,
): { usage?: BespokeFabricUsage; refUnitPrice?: number } {
  const byIndex = rawList[index];
  const raw =
    byIndex && String(byIndex.product_id) === normalized.product_id
      ? byIndex
      : rawList.find((r) => String(r.product_id) === normalized.product_id);
  const usage = parseFabricUsage(raw?.usage ?? normalized.usage);
  const ref = Number(raw?.retail_price);
  return {
    usage,
    refUnitPrice: Number.isFinite(ref) && ref > 0 ? ref : undefined,
  };
}

export function buildFabricCartLine<T extends BespokeCartLineBase>(
  fabric: BespokeFabricMaterial,
  parentCartId: BespokeParentCartRef,
  retailPrice: number,
  createId: () => number | string,
  opts?: { usage?: BespokeFabricUsage; refUnitPrice?: number },
): T {
  const opt = fabricMaterialToOption(fabric);
  const usage = opts?.usage ?? parseFabricUsage(fabric.usage);
  const baseName = fabric.product_name || opt.name || 'Fabric';
  return {
    id: createId(),
    productId: fabric.product_id,
    name: formatFabricLineName(baseName, usage),
    sku: fabric.sku || opt.sku || '—',
    price: retailPrice,
    qty: fabric.quantity,
    variationId: fabric.variation_id,
    unit: fabric.unit_code || 'm',
    bespokeParentCartId: parentCartId,
    bespokeRole: 'fabric',
    isBespokeInjected: true,
    customizationDetails: null,
    ...(usage ? { bespokeUsage: usage } : {}),
    ...(opts?.refUnitPrice != null && opts.refUnitPrice > 0
      ? { bespokeRefUnitPrice: opts.refUnitPrice }
      : {}),
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

  const rawList = Array.isArray(fabrics) ? fabrics : [];
  const validFabrics = normalizeFabricMaterials(fabrics).filter((m) => m.product_id && m.quantity > 0);
  const newFabricLines = validFabrics.map((f, index) => {
    const meta = pickRawFabricMeta(rawList, f, index);
    const withUsage = meta.usage ? { ...f, usage: meta.usage } : f;
    return buildFabricCartLine<T>(
      withUsage,
      parentCartId,
      resolveFabricPrice(f),
      createId,
      { usage: meta.usage, refUnitPrice: meta.refUnitPrice },
    );
  });

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
    .map((i) => {
      const fromName = stripFabricUsagePrefix(i.name);
      const usage = parseFabricUsage(i.bespokeUsage) ?? fromName.usage;
      const ref = Number(i.bespokeRefUnitPrice);
      return {
        product_id: String(i.productId),
        variation_id: i.variationId,
        product_name: fromName.productName,
        sku: i.sku,
        unit_code: i.unit || 'm',
        quantity: i.qty,
        ...(usage ? { usage } : {}),
        ...(Number.isFinite(ref) && ref > 0 ? { retail_price: ref } : {}),
      };
    });
}
