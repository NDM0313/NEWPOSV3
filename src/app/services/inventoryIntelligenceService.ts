/**
 * Phase-2 Intelligence: Inventory reports
 * Fast Moving, Slow Moving, Dead Stock, Low Stock Alerts, Inventory Turnover.
 * Uses stock_movements and inventory overview (movement-based).
 */
import { inventoryService } from './inventoryService';
import { format, subDays } from 'date-fns';

export interface FastMovingProduct {
  productId: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  soldQuantity: number;
  soldValue: number;
  movement: 'Fast';
}

export interface SlowMovingProduct {
  productId: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  soldQuantity: number;
  daysSinceSale: number;
  movement: 'Slow';
}

export interface DeadStockItem {
  productId: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  stockValue: number;
  daysSinceMovement: number;
  movement: 'Dead';
}

export interface LowStockAlertItem {
  productId: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  minStock: number;
  reorderLevel: number;
  status: 'Low' | 'Out';
}

export interface InventoryTurnoverResult {
  productId: string;
  name: string;
  sku: string;
  category: string;
  avgStockValue: number;
  cogsSold: number;
  turnoverRatio: number;
  daysCover: number;
}

const DEFAULT_DAYS = 90;

/**
 * Fast Moving: products with high sales velocity in the period (from stock_movements sale out).
 */
export async function getFastMovingProducts(
  companyId: string,
  branchId?: string | null,
  days: number = DEFAULT_DAYS
): Promise<FastMovingProduct[]> {
  const [overview, movements] = await Promise.all([
    inventoryService.getInventoryOverview(companyId, branchId),
    inventoryService.getInventoryMovements({
      companyId,
      branchId: branchId === 'all' ? undefined : branchId || undefined,
      dateFrom: format(subDays(new Date(), days), 'yyyy-MM-dd'),
      dateTo: format(new Date(), 'yyyy-MM-dd'),
    }),
  ]);
  const outByProduct: Record<string, { qty: number; value: number }> = {};
  movements.forEach((m) => {
    const q = Number(m.quantity) || 0;
    if (q >= 0) return;
    const pid = m.product_id;
    if (!outByProduct[pid]) outByProduct[pid] = { qty: 0, value: 0 };
    outByProduct[pid].qty += Math.abs(q);
    outByProduct[pid].value += Math.abs(Number(m.total_cost) || 0);
  });
  const fast = overview.filter((r) => r.movement === 'Fast');
  return fast.map((r) => ({
    productId: r.productId,
    name: r.name,
    sku: r.sku,
    category: r.category,
    stock: r.stock,
    soldQuantity: outByProduct[r.productId]?.qty ?? 0,
    soldValue: outByProduct[r.productId]?.value ?? 0,
    movement: 'Fast' as const,
  }));
}

/**
 * Slow Moving: movement = Slow from overview.
 */
export async function getSlowMovingProducts(
  companyId: string,
  branchId?: string | null,
  days: number = DEFAULT_DAYS
): Promise<SlowMovingProduct[]> {
  const [overview, movements] = await Promise.all([
    inventoryService.getInventoryOverview(companyId, branchId),
    inventoryService.getInventoryMovements({
      companyId,
      branchId: branchId === 'all' ? undefined : branchId || undefined,
      dateFrom: format(subDays(new Date(), days), 'yyyy-MM-dd'),
      dateTo: format(new Date(), 'yyyy-MM-dd'),
    }),
  ]);
  const lastSaleByProduct: Record<string, string> = {};
  movements.forEach((m) => {
    const q = Number(m.quantity) || 0;
    if (q >= 0) return;
    const pid = m.product_id;
    const d = m.created_at?.slice(0, 10);
    if (!d) return;
    if (!lastSaleByProduct[pid] || lastSaleByProduct[pid] < d) lastSaleByProduct[pid] = d;
  });
  const today = format(new Date(), 'yyyy-MM-dd');
  const outByProduct: Record<string, number> = {};
  movements.forEach((m) => {
    const q = Number(m.quantity) || 0;
    if (q >= 0) return;
    const pid = m.product_id;
    outByProduct[pid] = (outByProduct[pid] || 0) + Math.abs(q);
  });
  const slow = overview.filter((r) => r.movement === 'Slow');
  return slow.map((r) => {
    const lastSale = lastSaleByProduct[r.productId];
    const daysSinceSale = lastSale ? Math.floor((new Date(today).getTime() - new Date(lastSale).getTime()) / 86400000) : 999;
    return {
      productId: r.productId,
      name: r.name,
      sku: r.sku,
      category: r.category,
      stock: r.stock,
      soldQuantity: outByProduct[r.productId] ?? 0,
      daysSinceSale,
      movement: 'Slow' as const,
    };
  });
}

/**
 * Dead Stock: movement = Dead; no recent outbound movement.
 */
export async function getDeadStock(
  companyId: string,
  branchId?: string | null
): Promise<DeadStockItem[]> {
  const [overview, movements] = await Promise.all([
    inventoryService.getInventoryOverview(companyId, branchId),
    inventoryService.getInventoryMovements({
      companyId,
      branchId: branchId === 'all' ? undefined : branchId || undefined,
      dateFrom: format(subDays(new Date(), 365), 'yyyy-MM-dd'),
      dateTo: format(new Date(), 'yyyy-MM-dd'),
    }),
  ]);
  const lastMoveByProduct: Record<string, string> = {};
  movements.forEach((m) => {
    const pid = m.product_id;
    const d = m.created_at?.slice(0, 10);
    if (!d) return;
    if (!lastMoveByProduct[pid] || lastMoveByProduct[pid] < d) lastMoveByProduct[pid] = d;
  });
  const today = format(new Date(), 'yyyy-MM-dd');
  const dead = overview.filter((r) => r.movement === 'Dead' && r.stock > 0);
  return dead.map((r) => {
    const lastMove = lastMoveByProduct[r.productId];
    const daysSinceMovement = lastMove ? Math.floor((new Date(today).getTime() - new Date(lastMove).getTime()) / 86400000) : 365;
    return {
      productId: r.productId,
      name: r.name,
      sku: r.sku,
      category: r.category,
      stock: r.stock,
      stockValue: r.stockValue ?? 0,
      daysSinceMovement,
      movement: 'Dead' as const,
    };
  });
}

/**
 * Low Stock Alerts: status Low or Out from overview.
 */
export async function getLowStockAlerts(
  companyId: string,
  branchId?: string | null
): Promise<LowStockAlertItem[]> {
  const overview = await inventoryService.getInventoryOverview(companyId, branchId);
  const low = overview.filter((r) => r.status === 'Low' || r.status === 'Out');
  return low.map((r) => ({
    productId: r.productId,
    name: r.name,
    sku: r.sku,
    category: r.category,
    currentStock: r.stock,
    minStock: r.minStock,
    reorderLevel: r.reorderLevel,
    status: r.status,
  }));
}

/**
 * Inventory Turnover: COGS sold in period / average stock value. Uses movements for outbound and overview for value.
 */
export async function getInventoryTurnover(
  companyId: string,
  branchId?: string | null,
  days: number = 30
): Promise<InventoryTurnoverResult[]> {
  const [overview, movements] = await Promise.all([
    inventoryService.getInventoryOverview(companyId, branchId),
    inventoryService.getInventoryMovements({
      companyId,
      branchId: branchId === 'all' ? undefined : branchId || undefined,
      dateFrom: format(subDays(new Date(), days), 'yyyy-MM-dd'),
      dateTo: format(new Date(), 'yyyy-MM-dd'),
    }),
  ]);
  const cogsByProduct: Record<string, number> = {};
  movements.forEach((m) => {
    const q = Number(m.quantity) || 0;
    if (q >= 0) return;
    const pid = m.product_id;
    cogsByProduct[pid] = (cogsByProduct[pid] || 0) + Math.abs(Number(m.total_cost) || 0);
  });
  const overviewById = new Map(overview.map((r) => [r.productId, r]));
  const results: InventoryTurnoverResult[] = [];
  overview.forEach((r) => {
    const avgStockValue = r.stockValue ?? 0;
    const cogsSold = cogsByProduct[r.productId] ?? 0;
    const turnoverRatio = avgStockValue > 0 ? cogsSold / avgStockValue : 0;
    const daysCover = cogsSold > 0 && avgStockValue > 0 ? Math.round((avgStockValue / (cogsSold / days)) * 10) / 10 : 0;
    results.push({
      productId: r.productId,
      name: r.name,
      sku: r.sku,
      category: r.category,
      avgStockValue,
      cogsSold,
      turnoverRatio: Math.round(turnoverRatio * 100) / 100,
      daysCover,
    });
  });
  return results.filter((x) => x.cogsSold > 0 || x.avgStockValue > 0).sort((a, b) => b.turnoverRatio - a.turnoverRatio);
}

export const inventoryIntelligenceService = {
  getFastMovingProducts,
  getSlowMovingProducts,
  getDeadStock,
  getLowStockAlerts,
  getInventoryTurnover,
};
