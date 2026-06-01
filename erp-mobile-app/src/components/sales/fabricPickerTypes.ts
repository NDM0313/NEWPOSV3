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
  imageUrl?: string;
  stock?: number;
};

export function mapApiProductToFabricPicker(p: productsApi.Product): FabricPickerProduct {
  return {
    id: p.id,
    name: p.name,
    price: p.retailPrice ?? 0,
    wholesalePrice: p.wholesalePrice ?? p.retailPrice ?? 0,
    sku: p.sku,
    barcode: p.barcode,
    unit: p.unit ?? 'Piece',
    hasVariations: p.hasVariations ?? false,
    variations: p.variations,
    unitAllowDecimal: unitAllowsDecimal(p.unitAllowDecimal),
    imageUrl: p.imageUrls?.[0],
    stock: p.stock ?? 0,
  };
}
