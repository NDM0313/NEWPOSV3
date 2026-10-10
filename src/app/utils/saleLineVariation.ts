import { parseVariationAttributesRaw, publicVariationAttributes } from '@/app/utils/variationFieldMap';
import { coerceUuidOrNull } from '@/app/utils/uuidCoerce';

export type SaleLineVariationRow = {
  id?: string;
  size?: string;
  color?: string;
  attributes?: Record<string, unknown>;
};

function variationRowIsUserSelectable(v: SaleLineVariationRow | undefined): boolean {
  if (!v) return false;
  const size = String(v.size || '').trim();
  const color = String(v.color || '').trim();
  if (size || color) return true;
  const attrs = parseVariationAttributesRaw(v.attributes);
  return Object.keys(publicVariationAttributes(attrs)).length > 0;
}

/** True when the product has real user-facing variations (e.g. TR, WOOL), not legacy sentinel rows. */
export function shouldShowSaleLineVariations(
  product: { has_variations?: boolean; variations?: SaleLineVariationRow[] } | null | undefined,
  variationsOverride?: SaleLineVariationRow[],
): boolean {
  const list = variationsOverride ?? product?.variations ?? [];
  if (list.length > 1) return true;
  if (list.length === 1) return variationRowIsUserSelectable(list[0]);
  return false;
}

/** Strip variation_id on persist when variation metadata proves a legacy sentinel row. */
export function normalizeVariationIdForPersist(
  variationId: unknown,
  product?: { has_variations?: boolean; variations?: SaleLineVariationRow[] } | null,
  variationsOverride?: SaleLineVariationRow[],
): string | undefined {
  const coerced = variationId != null && variationId !== '' ? coerceUuidOrNull(variationId) : null;
  if (!coerced) return undefined;
  const list = variationsOverride ?? product?.variations ?? [];
  if (list.length > 0 && !shouldShowSaleLineVariations(product, list)) {
    return undefined;
  }
  return coerced;
}

/** User-facing variation label for sale line tables (no internal ERP keys). */
export function formatSaleLineVariationText(
  variation: SaleLineVariationRow | null | undefined,
  itemSize?: string,
  itemColor?: string,
): string | null {
  if (variation) {
    const size = String(variation.size || '').trim();
    const color = String(variation.color || '').trim();
    if (size || color) return [size, color].filter(Boolean).join(' / ');
    const publicAttrs = publicVariationAttributes(parseVariationAttributesRaw(variation.attributes));
    const entries = Object.entries(publicAttrs).filter(([, v]) => v != null && String(v).trim() !== '');
    if (entries.length > 0) {
      return entries.map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`).join(', ');
    }
  }
  const fallbackSize = String(itemSize || '').trim();
  const fallbackColor = String(itemColor || '').trim();
  if (fallbackSize || fallbackColor) return [fallbackSize, fallbackColor].filter(Boolean).join(' / ');
  return null;
}
