import {
  mapProductVariationApiToFormRow,
} from '@/app/services/productService';
import { parseVariationAttributesRaw, publicVariationAttributes } from '@/app/utils/variationFieldMap';

/** Append " (Copy)" unless already present (case-insensitive). */
export function duplicateProductName(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Copy';
  if (/\s*\(copy\)$/i.test(trimmed)) return trimmed;
  return `${trimmed} (Copy)`;
}

export type DuplicateVariationRow = {
  combination: Record<string, string>;
  sku: string;
  price: number;
  purchasePrice: number;
  stock: number;
  barcode: string;
};

/** Build variation rows for duplicate create — no ids, zero stock, fresh SKUs. */
export function duplicateVariationRows(
  sourceVariations: unknown[],
  baseSku: string,
): DuplicateVariationRow[] {
  const base = (baseSku || 'PRD-0001').trim();
  return (sourceVariations as Record<string, unknown>[]).map((v, i) => {
    const row = mapProductVariationApiToFormRow(v);
    return {
      combination: row.combination,
      sku: `${base}-V${i + 1}`,
      price: row.price,
      purchasePrice: row.purchasePrice,
      stock: 0,
      barcode: '',
    };
  });
}

/** Derive attribute columns from source variations (same logic as edit hydrate). */
export function duplicateVariantAttributes(sourceVariations: unknown[]): Array<{ name: string; values: string[] }> {
  if (!Array.isArray(sourceVariations) || sourceVariations.length === 0) return [];
  const firstParsed = publicVariationAttributes(
    parseVariationAttributesRaw((sourceVariations[0] as { attributes?: unknown })?.attributes),
  );
  const attrNames = Object.keys(firstParsed).sort((a, b) => a.localeCompare(b));
  if (attrNames.length === 0) return [];
  const valuesByAttr: Record<string, Set<string>> = {};
  attrNames.forEach((k) => {
    valuesByAttr[k] = new Set();
  });
  sourceVariations.forEach((v) => {
    const a = publicVariationAttributes(
      parseVariationAttributesRaw((v as { attributes?: unknown })?.attributes),
    );
    attrNames.forEach((k) => {
      if (a[k] != null && a[k] !== '') valuesByAttr[k].add(String(a[k]));
    });
  });
  return attrNames.map((name) => ({
    name,
    values: Array.from(valuesByAttr[name] || []).sort((a, b) => a.localeCompare(b)),
  }));
}

/** Image URLs to carry over on duplicate (storage paths remain valid). */
export function duplicateImageUrls(source: { image_urls?: unknown; imageUrls?: unknown }): string[] {
  const urls = source.image_urls ?? source.imageUrls;
  return Array.isArray(urls) ? [...(urls as string[])] : [];
}
