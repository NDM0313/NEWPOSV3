/**
 * Flatten inventory overview rows for backup CSV (matches Stock Report shape).
 */

import type { InventoryOverviewRow } from '@/app/services/inventoryService';

export const INVENTORY_STOCK_HEADERS = [
  'product_id',
  'variation_id',
  'sku',
  'product_name',
  'variation_label',
  'branch_id',
  'current_stock',
  'unit',
  'cost_price',
  'retail_price',
  'stock_value_at_cost',
  'stock_value_at_retail',
] as const;

export function flattenInventoryOverviewToRows(
  overview: InventoryOverviewRow[],
  branchId: string | null
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const branch = branchId && branchId !== 'all' ? branchId : '';

  overview.forEach((product) => {
    if (product.hasVariations && product.variations?.length) {
      product.variations.forEach((v) => {
        const attrEntries =
          typeof v.attributes === 'object' && v.attributes !== null
            ? Object.entries(v.attributes).filter(([, val]) => String(val).trim() !== '')
            : [];
        const attrLabel = attrEntries.map(([, val]) => val).join(' / ') || '';
        rows.push({
          product_id: product.productId,
          variation_id: v.id,
          sku: v.sku || product.sku,
          product_name: product.name,
          variation_label: attrLabel,
          branch_id: branch,
          current_stock: v.stock,
          unit: product.unit,
          cost_price: v.purchasePrice,
          retail_price: v.sellingPrice,
          stock_value_at_cost: v.stockValueAtCost,
          stock_value_at_retail: v.retailStockValue,
        });
      });
    } else {
      rows.push({
        product_id: product.productId,
        variation_id: '',
        sku: product.sku,
        product_name: product.name,
        variation_label: '',
        branch_id: branch,
        current_stock: product.stock,
        unit: product.unit,
        cost_price: product.avgCost,
        retail_price: product.sellingPrice,
        stock_value_at_cost: product.stockValue,
        stock_value_at_retail: product.stock * product.sellingPrice,
      });
    }
  });

  return rows;
}
