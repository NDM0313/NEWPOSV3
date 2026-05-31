/**
 * Boutique matrix SKU builders for CSV product import.
 * Deterministic, human-readable codes when parent/variant SKU cells are blank.
 */

export type ProductSkuRowInput = {
  name: string;
  category?: string;
  sku?: string;
  variation_name?: string;
  variation_sku?: string;
};

/** Uppercase alphanumeric + hyphen slug for SKU segments. */
export function slugSkuPart(text: string, maxLen = 24): string {
  const slug = (text ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  if (!slug) return 'X';
  return slug.length > maxLen ? slug.slice(0, maxLen).replace(/-+$/, '') : slug;
}

const CATEGORY_PREFIX_MAP: Record<string, string> = {
  bridal: 'BRD',
  fabric: 'FAB',
  fabrics: 'FAB',
  casual: 'CSL',
  formal: 'FRM',
  rental: 'RNT',
  studio: 'STD',
  production: 'PRD',
  accessories: 'ACC',
  unstitched: 'UNS',
};

/** 3-letter category prefix (e.g. Bridal → BRD). */
export function categoryPrefix(category?: string): string {
  const raw = (category ?? '').trim().toLowerCase();
  if (!raw) return 'GEN';
  if (CATEGORY_PREFIX_MAP[raw]) return CATEGORY_PREFIX_MAP[raw];
  const first = raw.split(/[\s/,-]+/)[0] ?? '';
  if (first.length >= 3) return first.slice(0, 3).toUpperCase();
  return slugSkuPart(first, 3);
}

/**
 * Extract design id from product name.
 * Priority: trailing boutique code (… /596), design/dsn tags, first 3–6 digit token, slug.
 */
export function designIdFromName(name: string): string {
  const trimmed = (name ?? '').trim();
  const slashSuffix = trimmed.match(/\/\s*(\d{3,6})\s*$/);
  if (slashSuffix?.[1]) return slashSuffix[1];
  const numMatch = trimmed.match(/(?:design|dsn|style|#)\s*[-#]?\s*(\d{3,6})/i);
  if (numMatch?.[1]) return numMatch[1];
  const bareNum = trimmed.match(/\b(\d{3,6})\b/);
  if (bareNum?.[1]) return bareNum[1];
  return slugSkuPart(trimmed, 12);
}

/** Short suffix from variation label (e.g. Raw Silk - Heavy Embroidery → RSHE). */
export function variantSuffix(variationName: string, index = 0): string {
  const name = (variationName ?? '').trim();
  if (!name) return index > 0 ? `V${index + 1}` : 'VAR';

  const parts = name.split(/[\s/,-]+/).filter(Boolean);
  if (parts.length === 0) return index > 0 ? `V${index + 1}` : 'VAR';

  if (parts.length === 1) {
    const one = slugSkuPart(parts[0]!, 8);
    return index > 0 ? `${one}${index + 1}` : one;
  }

  const initials = parts
    .map((p) => p.replace(/[^a-zA-Z0-9]/g, '').charAt(0))
    .join('')
    .toUpperCase();
  let suffix = initials.length >= 2 ? initials.slice(0, 6) : slugSkuPart(parts[0]!, 6);

  if (suffix.length < 3) {
    suffix = slugSkuPart(name, 8);
  }

  return index > 0 ? `${suffix}${index + 1}` : suffix;
}

/** Parent SKU: {CAT}-{designId} e.g. BRD-2000 */
export function buildMatrixParentSku(row: ProductSkuRowInput): string {
  const prefix = categoryPrefix(row.category);
  const designId = designIdFromName(row.name);
  return `${prefix}-${designId}`;
}

/** Variant SKU: {parentSku}-{suffix} e.g. BRD-2000-RSHE */
export function buildMatrixVariantSku(
  parentSku: string,
  variationName: string,
  index = 0
): string {
  const base = parentSku.trim();
  const suffix = variantSuffix(variationName, index);
  return `${base}-${suffix}`;
}

export type FindProductBySkuFn = (
  companyId: string,
  sku: string
) => Promise<{ id: string } | null | Record<string, unknown>>;

/** Lowercased SKUs reserved during one import batch (DB prefetch + rows committed so far). */
export type ImportSkuIndex = Set<string>;

export function skuIndexHas(index: ImportSkuIndex | undefined, sku: string): boolean {
  const k = sku.trim().toLowerCase();
  return k.length > 0 && (index?.has(k) ?? false);
}

export function skuIndexAdd(index: ImportSkuIndex | undefined, sku: string): void {
  const k = sku.trim().toLowerCase();
  if (k && index) index.add(k);
}

/** findBySku that checks in-memory index first to avoid redundant DB round-trips. */
export function createSkuLookupWithIndex(
  index: ImportSkuIndex | undefined,
  findBySku: FindProductBySkuFn
): FindProductBySkuFn {
  return async (companyId, sku) => {
    const trimmed = sku.trim();
    if (!trimmed) return null;
    if (skuIndexHas(index, trimmed)) {
      return { id: '__import_reserved__' };
    }
    const existing = await findBySku(companyId, trimmed);
    if (existing && typeof existing === 'object' && 'id' in existing) {
      skuIndexAdd(index, trimmed);
    }
    return existing;
  };
}

/**
 * If candidate SKU exists on another product, append -2, -3, … up to maxAttempts.
 */
export async function ensureUniqueProductSku(
  companyId: string,
  candidate: string,
  findBySku: FindProductBySkuFn,
  existingProductId?: string | null,
  maxAttempts = 20,
  skuIndex?: ImportSkuIndex
): Promise<string> {
  let sku = candidate.trim();
  if (!sku) return sku;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const reserved = skuIndexHas(skuIndex, sku);
    const existing = reserved ? { id: '__import_reserved__' } : await findBySku(companyId, sku);
    if (!existing) {
      skuIndexAdd(skuIndex, sku);
      return sku;
    }
    const existingId =
      typeof existing === 'object' && existing !== null && 'id' in existing
        ? String((existing as { id: string }).id)
        : null;
    if (existingProductId && existingId === existingProductId) {
      skuIndexAdd(skuIndex, sku);
      return sku;
    }
    if (existingId === '__import_reserved__' || (existingId && existingId !== existingProductId)) {
      const suffix = attempt === 0 ? '-2' : `-${attempt + 2}`;
      sku = `${candidate.trim()}${suffix}`;
      continue;
    }
    if (!existingProductId && !existingId) {
      skuIndexAdd(skuIndex, sku);
      return sku;
    }
    const suffix = attempt === 0 ? '-2' : `-${attempt + 2}`;
    sku = `${candidate.trim()}${suffix}`;
  }

  const fallback = `${candidate.trim()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  skuIndexAdd(skuIndex, fallback);
  return fallback;
}

/** Preview/display SKU for a row (blank → generated boutique code). */
export function previewSkuForRow(
  row: ProductSkuRowInput,
  parentSku?: string,
  variantIndex = 0
): string {
  if (row.variation_name?.trim()) {
    const provided = row.variation_sku?.trim();
    if (provided) return provided;
    const parent = parentSku?.trim() || buildMatrixParentSku(row);
    return buildMatrixVariantSku(parent, row.variation_name, variantIndex);
  }
  const provided = row.sku?.trim();
  if (provided) return provided;
  return buildMatrixParentSku(row);
}
