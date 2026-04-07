/**
 * Single mapping layer for product_variations across ERP (cost_price + retail_price) and
 * minimal schemas (price + attributes only). Purchase can be embedded in JSONB when no cost column exists.
 */

export const VARIATION_INTERNAL_PURCHASE_KEYS = ['__erp_purchase_price', '__purchase_price', '_erp_purchase_price'] as const;

export function isInternalVariationAttributeKey(key: string): boolean {
  return (VARIATION_INTERNAL_PURCHASE_KEYS as readonly string[]).includes(key) || key.startsWith('__erp_');
}

/** Parse JSONB attributes from API (object or string). */
export function parseVariationAttributesRaw(raw: unknown): Record<string, string> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        return Object.fromEntries(
          Object.entries(p as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
        );
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
    );
  }
  return {};
}

/** User-facing attribute map (strips internal ERP keys). */
export function publicVariationAttributes(attrs: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(attrs).filter(([k]) => !isInternalVariationAttributeKey(k)));
}

export function embeddedPurchaseFromAttributes(attrs: Record<string, string>): number | null {
  for (const k of VARIATION_INTERNAL_PURCHASE_KEYS) {
    const raw = attrs[k];
    if (raw == null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Merge purchase into attributes for minimal-schema DB rows (only `price` column for selling). */
export function variationAttributesForMinimalSchemaSave(
  userAttrs: Record<string, string>,
  purchasePrice: number | null | undefined
): Record<string, string> {
  const out = { ...userAttrs };
  if (purchasePrice != null && Number.isFinite(Number(purchasePrice))) {
    out.__erp_purchase_price = String(Number(purchasePrice));
  } else {
    delete out.__erp_purchase_price;
  }
  return out;
}

function numField(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Purchase / cost: DB columns first, then embedded JSON (minimal schema). */
export function variationPurchaseFromApiRow(v: Record<string, unknown>): number | null {
  const fromCol = numField(v.cost_price) ?? numField((v as { purchase_price?: unknown }).purchase_price);
  if (fromCol != null) return fromCol;
  const attrs = parseVariationAttributesRaw(v.attributes);
  return embeddedPurchaseFromAttributes(attrs);
}

/**
 * Selling: prefer explicit `retail_price` column when present on the row, then `price`.
 * Using `in` avoids treating missing column as null vs undefined quirks in some clients.
 */
export function variationRetailFromApiRow(v: Record<string, unknown>): number | null {
  if (Object.prototype.hasOwnProperty.call(v, 'retail_price')) {
    const r = numField(v.retail_price);
    if (r != null) return r;
  }
  if (Object.prototype.hasOwnProperty.call(v, 'selling_price')) {
    const s = numField((v as { selling_price?: unknown }).selling_price);
    if (s != null) return s;
  }
  return numField(v.price);
}
