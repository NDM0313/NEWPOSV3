import { isBespokeGenericSku } from '../lib/bespokeCartInjection';

export interface StockableProduct {
  stock?: number;
  /** Web-parity SUM of all movements for product_id (incl. inactive variation keys). */
  totalStock?: number | null;
  hasVariations?: boolean;
  variations?: { stock?: number }[];
  sku?: string | null;
  /** CamelCase from mobile Product API */
  trackStock?: boolean | null;
  /** Snake_case when raw DB shape is passed through */
  track_stock?: boolean | null;
}

/** CUSTOM-* / track_stock=false — stock deferred (web saleStockLineEligibility parity). */
export function isPickerStockGateExempt(product: {
  sku?: string | null;
  trackStock?: boolean | null;
  track_stock?: boolean | null;
}): boolean {
  if (isBespokeGenericSku(product.sku)) return true;
  if (product.trackStock === false || product.track_stock === false) return true;
  return false;
}

export function getTotalProductStock(product: StockableProduct): number {
  // Prefer web-parity rollup when present (includes inactive variation movement keys).
  if (product.totalStock != null && Number.isFinite(Number(product.totalStock))) {
    return Number(product.totalStock);
  }
  if (product.hasVariations) {
    const variationSum = (product.variations ?? []).reduce((sum, v) => sum + (v.stock ?? 0), 0);
    // product.stock holds orphan parent movements (variation_id IS NULL), not forced to 0.
    return variationSum + (product.stock ?? 0);
  }
  return product.stock ?? 0;
}

/** Block sale when company disallows negative stock and on-hand is zero or below. */
export function isSaleBlockedByStock(totalStock: number, allowNegativeStock: boolean): boolean {
  return !allowNegativeStock && totalStock <= 0;
}

/** Picker gate: exempt bespoke / non-tracked, else physical stock check. */
export function isProductSaleBlockedByStock(
  product: StockableProduct,
  allowNegativeStock: boolean
): boolean {
  if (isPickerStockGateExempt(product)) return false;
  return isSaleBlockedByStock(getTotalProductStock(product), allowNegativeStock);
}

export function isVariationSaleBlocked(stock: number | undefined, allowNegativeStock: boolean): boolean {
  return isSaleBlockedByStock(stock ?? 0, allowNegativeStock);
}

export function formatStockLabel(
  stock: number,
  allowNegativeStock: boolean,
  opts?: { exempt?: boolean }
): string {
  if (opts?.exempt) return 'Made to order';
  if (!allowNegativeStock && stock <= 0) return 'Out of stock';
  return `Stock: ${stock}`;
}

export function stockLabelClassName(
  stock: number,
  allowNegativeStock: boolean,
  opts?: { exempt?: boolean }
): string {
  if (opts?.exempt) return 'text-[#C4B5FD]';
  if (!allowNegativeStock && stock <= 0) return 'text-[#EF4444]';
  if (stock < 10) return 'text-[#F59E0B]';
  return 'text-[#9CA3AF]';
}
