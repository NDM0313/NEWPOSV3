/**
 * Dashboard V2 — unified low-stock rules (movement-based inventory overview).
 */
import type { InventoryOverviewRow } from '@/app/services/inventoryService';

export type DashboardStockAlertKind = 'low' | 'out' | 'negative';

export interface DashboardV2StockRow {
  id: string;
  productId: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  status: DashboardStockAlertKind;
  category: string;
}

export function classifyStockRow(row: InventoryOverviewRow): DashboardV2StockRow | null {
  const stock = Number(row.stock) || 0;
  const minStock = Number(row.minStock) || 0;
  let status: DashboardStockAlertKind | null = null;
  if (stock < 0) status = 'negative';
  else if (stock <= 0) status = 'out';
  else if (minStock > 0 && stock <= minStock) status = 'low';
  if (!status) return null;
  return {
    id: row.id,
    productId: row.productId,
    name: row.name,
    sku: row.sku,
    stock,
    minStock,
    status,
    category: row.category,
  };
}

export function mapOverviewToStockAlerts(rows: InventoryOverviewRow[]): DashboardV2StockRow[] {
  return rows.map(classifyStockRow).filter((r): r is DashboardV2StockRow => r !== null);
}

/** Map get_dashboard_metrics / V2 RPC low_stock_items rows (inventory_balance based). */
export function mapRpcLowStockToAlerts(
  rows: Array<{
    id?: string;
    name?: string;
    sku?: string;
    current_stock?: number;
    min_stock?: number;
  }> | null | undefined,
): DashboardV2StockRow[] {
  if (!Array.isArray(rows)) return [];
  const out: DashboardV2StockRow[] = [];
  for (const r of rows) {
    const stock = Number(r.current_stock) || 0;
    const minStock = Number(r.min_stock) || 0;
    let status: DashboardStockAlertKind | null = null;
    if (stock < 0) status = 'negative';
    else if (stock <= 0) status = 'out';
    else if (minStock > 0 && stock < minStock) status = 'low';
    if (!status) continue;
    const id = String(r.id ?? '');
    if (!id) continue;
    out.push({
      id,
      productId: id,
      name: String(r.name ?? 'Product'),
      sku: String(r.sku ?? ''),
      stock,
      minStock,
      status,
      category: '',
    });
  }
  return out;
}
