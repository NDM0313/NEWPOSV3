// Product Variation Types (for VariationSelector and sales flow)
export interface ProductVariation {
  id: string;
  sku: string;
  size?: string;
  color?: string;
  design?: string;
  material?: string;
  stock: number;
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  barcode?: string;
}

export interface ProductWithVariations {
  id: string;
  name: string;
  category: string;
  basesku: string;
  unit: string;
  hasVariations: boolean;
  variations: ProductVariation[];
  stock?: number;
  costPrice?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  description?: string;
  images?: string[];
  status: 'active' | 'inactive';
  createdAt?: Date;
}

// Helper function to get total stock across all variations
export function getTotalStock(product: ProductWithVariations): number {
  if (!product.hasVariations) {
    return product.stock || 0;
  }
  return product.variations.reduce((sum, v) => sum + v.stock, 0);
}

// Helper function to get price range
export function getPriceRange(product: ProductWithVariations): { min: number; max: number } {
  if (!product.hasVariations) {
    return { min: product.retailPrice || 0, max: product.retailPrice || 0 };
  }
  const prices = product.variations.map((v) => v.retailPrice);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

// Format variation label
export function formatVariationLabel(variation: ProductVariation): string {
  const parts = [];
  if (variation.color) parts.push(variation.color);
  if (variation.size) parts.push(`Size ${variation.size}`);
  if (variation.design) parts.push(variation.design);
  if (variation.material) parts.push(variation.material);
  return parts.length > 0 ? parts.join(' - ') : variation.sku;
}
