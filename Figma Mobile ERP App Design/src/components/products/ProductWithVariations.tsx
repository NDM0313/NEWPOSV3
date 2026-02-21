// Product Variation Types
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
  // If no variations, use these
  stock?: number;
  costPrice?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  description?: string;
  images?: string[];
  status: 'active' | 'inactive';
  createdAt: Date;
}

// Sample Products with Variations
export const sampleProductsWithVariations: ProductWithVariations[] = [
  {
    id: '1',
    name: 'Bridal Lehenga - Premium Collection',
    category: 'Bridal',
    basesku: 'BRD-PREM',
    unit: 'Piece',
    hasVariations: true,
    status: 'active',
    createdAt: new Date('2026-01-10'),
    variations: [
      {
        id: '1-1',
        sku: 'BRD-PREM-RED-M',
        color: 'Red & Gold',
        size: 'Medium',
        stock: 3,
        costPrice: 12000,
        retailPrice: 15000,
        wholesalePrice: 13500,
        barcode: '8901234567890',
      },
      {
        id: '1-2',
        sku: 'BRD-PREM-RED-L',
        color: 'Red & Gold',
        size: 'Large',
        stock: 2,
        costPrice: 12000,
        retailPrice: 15000,
        wholesalePrice: 13500,
        barcode: '8901234567891',
      },
      {
        id: '1-3',
        sku: 'BRD-PREM-PINK-M',
        color: 'Pink & Silver',
        size: 'Medium',
        stock: 4,
        costPrice: 13000,
        retailPrice: 16000,
        wholesalePrice: 14500,
        barcode: '8901234567892',
      },
      {
        id: '1-4',
        sku: 'BRD-PREM-PINK-L',
        color: 'Pink & Silver',
        size: 'Large',
        stock: 1,
        costPrice: 13000,
        retailPrice: 16000,
        wholesalePrice: 14500,
        barcode: '8901234567893',
      },
    ],
  },
  {
    id: '2',
    name: 'Dupatta - Embroidered',
    category: 'Accessories',
    basesku: 'DUP-EMB',
    unit: 'Piece',
    hasVariations: true,
    status: 'active',
    createdAt: new Date('2026-01-12'),
    variations: [
      {
        id: '2-1',
        sku: 'DUP-EMB-GOLD',
        color: 'Gold',
        stock: 12,
        costPrice: 4000,
        retailPrice: 5000,
        wholesalePrice: 4500,
      },
      {
        id: '2-2',
        sku: 'DUP-EMB-SILVER',
        color: 'Silver',
        stock: 8,
        costPrice: 4000,
        retailPrice: 5000,
        wholesalePrice: 4500,
      },
      {
        id: '2-3',
        sku: 'DUP-EMB-ROSE',
        color: 'Rose Gold',
        stock: 5,
        costPrice: 4200,
        retailPrice: 5200,
        wholesalePrice: 4700,
      },
    ],
  },
  {
    id: '3',
    name: 'Silk Fabric',
    category: 'Fabric',
    basesku: 'FAB-SILK',
    unit: 'Meter',
    hasVariations: true,
    status: 'active',
    createdAt: new Date('2026-01-08'),
    variations: [
      {
        id: '3-1',
        sku: 'FAB-SILK-BLUE',
        color: 'Royal Blue',
        stock: 25,
        costPrice: 1000,
        retailPrice: 1200,
        wholesalePrice: 1100,
      },
      {
        id: '3-2',
        sku: 'FAB-SILK-RED',
        color: 'Deep Red',
        stock: 18,
        costPrice: 1000,
        retailPrice: 1200,
        wholesalePrice: 1100,
      },
      {
        id: '3-3',
        sku: 'FAB-SILK-GREEN',
        color: 'Emerald Green',
        stock: 30,
        costPrice: 1000,
        retailPrice: 1200,
        wholesalePrice: 1100,
      },
      {
        id: '3-4',
        sku: 'FAB-SILK-BLACK',
        color: 'Jet Black',
        stock: 22,
        costPrice: 1000,
        retailPrice: 1200,
        wholesalePrice: 1100,
      },
    ],
  },
  {
    id: '4',
    name: 'Jewelry Set - Pearl Collection',
    category: 'Jewelry',
    basesku: 'JWL-PEARL',
    unit: 'Set',
    hasVariations: false,
    stock: 3,
    costPrice: 8000,
    retailPrice: 12000,
    wholesalePrice: 10000,
    status: 'active',
    createdAt: new Date('2026-01-05'),
    variations: [],
  },
  {
    id: '5',
    name: 'Bridal Shoes',
    category: 'Footwear',
    basesku: 'SHO-BRD',
    unit: 'Pair',
    hasVariations: true,
    status: 'active',
    createdAt: new Date('2026-01-15'),
    variations: [
      {
        id: '5-1',
        sku: 'SHO-BRD-GOLD-36',
        color: 'Golden',
        size: '36',
        stock: 2,
        costPrice: 3000,
        retailPrice: 4500,
        wholesalePrice: 3800,
      },
      {
        id: '5-2',
        sku: 'SHO-BRD-GOLD-37',
        color: 'Golden',
        size: '37',
        stock: 3,
        costPrice: 3000,
        retailPrice: 4500,
        wholesalePrice: 3800,
      },
      {
        id: '5-3',
        sku: 'SHO-BRD-GOLD-38',
        color: 'Golden',
        size: '38',
        stock: 1,
        costPrice: 3000,
        retailPrice: 4500,
        wholesalePrice: 3800,
      },
      {
        id: '5-4',
        sku: 'SHO-BRD-SILVER-36',
        color: 'Silver',
        size: '36',
        stock: 2,
        costPrice: 3200,
        retailPrice: 4700,
        wholesalePrice: 4000,
      },
      {
        id: '5-5',
        sku: 'SHO-BRD-SILVER-37',
        color: 'Silver',
        size: '37',
        stock: 0,
        costPrice: 3200,
        retailPrice: 4700,
        wholesalePrice: 4000,
      },
    ],
  },
];

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
  const prices = product.variations.map(v => v.retailPrice);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

// Format variation label
export function formatVariationLabel(variation: ProductVariation): string {
  const parts = [];
  if (variation.color) parts.push(variation.color);
  if (variation.size) parts.push(`Size ${variation.size}`);
  if (variation.design) parts.push(variation.design);
  if (variation.material) parts.push(variation.material);
  return parts.join(' - ') || variation.sku;
}
