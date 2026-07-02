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
