import type { Product } from '../api/products';

/** Append " (Copy)" unless already present (case-insensitive). */
export function duplicateProductName(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Copy';
  if (/\s*\(copy\)$/i.test(trimmed)) return trimmed;
  return `${trimmed} (Copy)`;
}

/** Build a create-mode seed from a full product (empty id, zero stock, cleared barcode). */
export function prepareMobileProductDuplicateSeed(source: Product, nextSku: string): Product {
  const baseSku = nextSku.trim() || 'PRD-0001';
  const hasVariations = Boolean(source.hasVariations && source.variations?.length);
  const variations = hasVariations
    ? (source.variations || []).map((v, i) => ({
        ...v,
        id: '',
        sku: `${baseSku}-V${i + 1}`,
        stock: 0,
        barcode: '',
      }))
    : undefined;

  return {
    ...source,
    id: '',
    name: duplicateProductName(source.name),
    sku: baseSku,
    barcode: '',
    stock: 0,
    hasVariations,
    variations,
    imageUrls: Array.isArray(source.imageUrls) ? [...source.imageUrls] : [],
  };
}
