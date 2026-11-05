import type { ProductVariationRow } from '../../api/products';
import * as productsApi from '../../api/products';
import { unitAllowsDecimal } from '../../lib/unitDecimal';

export type FabricPickerProduct = {
  id: string;
  name: string;
  price: number;
  wholesalePrice: number;
  sku?: string;
  barcode?: string;
  unit: string;
  hasVariations?: boolean;
  variations?: ProductVariationRow[];
  unitAllowDecimal?: boolean;
  isDyeable?: boolean;
  imageUrl?: string;
  stock?: number;
  totalStock?: number;
  trackStock?: boolean;
};

export function mapApiProductToFabricPicker(p: productsApi.Product): FabricPickerProduct {
  const variationFallback =
    p.variations?.reduce((best, v) => {
      const vp = Number(v.price) || 0;
      return vp > best ? vp : best;
    }, 0) ?? 0;
  const retail = Number(p.retailPrice) || variationFallback || 0;
  return {
    id: p.id,
    name: p.name,
    price: retail,
    wholesalePrice: p.wholesalePrice ?? p.costPrice ?? retail * 0.8,
    sku: p.sku,
    barcode: p.barcode,
    unit: p.unit ?? 'Piece',
    hasVariations: p.hasVariations ?? false,
    variations: p.variations,
    unitAllowDecimal: unitAllowsDecimal(p.unitAllowDecimal),
    isDyeable: Boolean(p.isDyeable),
    imageUrl: p.imageUrls?.[0],
    stock: p.stock ?? 0,
    // Must pass through — DIN CHINA qty often sits on inactive variation keys.
    totalStock: p.totalStock ?? p.stock ?? 0,
    trackStock: true,
  };
}
