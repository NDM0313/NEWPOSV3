export interface StockableProduct {
  stock?: number;
  hasVariations?: boolean;
  variations?: { stock?: number }[];
}

export function getTotalProductStock(product: StockableProduct): number {
  if (product.hasVariations && product.variations?.length) {
    return product.variations.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  }
  return product.stock ?? 0;
}

/** Block sale when company disallows negative stock and on-hand is zero or below. */
export function isSaleBlockedByStock(totalStock: number, allowNegativeStock: boolean): boolean {
  return !allowNegativeStock && totalStock <= 0;
}

export function isVariationSaleBlocked(stock: number | undefined, allowNegativeStock: boolean): boolean {
  return isSaleBlockedByStock(stock ?? 0, allowNegativeStock);
}

export function formatStockLabel(stock: number, allowNegativeStock: boolean): string {
  if (!allowNegativeStock && stock <= 0) return 'Out of stock';
  return `Stock: ${stock}`;
}

export function stockLabelClassName(stock: number, allowNegativeStock: boolean): string {
  if (!allowNegativeStock && stock <= 0) return 'text-[#EF4444]';
  if (stock < 10) return 'text-[#F59E0B]';
  return 'text-[#9CA3AF]';
}
