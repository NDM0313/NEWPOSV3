/**
 * Inventory Management – Single Source of Truth
 * Design: docs/INVENTORY_MANAGEMENT_DESIGN.md
 *
 * APIs:
 * - getInventoryOverview: Stock Overview tab (products + balance + categories + prices)
 * - getInventoryMovements: Stock Analytics tab (movements with filters)
 */

import { supabase } from '@/lib/supabase';

export interface InventoryOverviewRow {
  id: string;
  productId: string;
  sku: string;
  name: string;
  category: string;
  categoryId?: string;
  stock: number;
  boxes: number;
  pieces: number;
  unit: string;
  avgCost: number;
  sellingPrice: number;
  stockValue: number;
  status: 'Low' | 'OK' | 'Out';
  movement: 'Fast' | 'Slow' | 'Medium' | 'Dead';
  minStock: number;
  reorderLevel: number;
}

export interface InventoryMovementRow {
  id: string;
  product_id: string;
  branch_id: string | null;
  movement_type: string;
  reference_type: string | null;
  reference_id: string | null;
  quantity: number;
  box_change?: number;
  piece_change?: number;
  unit?: string;
  before_qty?: number;
  after_qty?: number;
  unit_cost?: number;
  total_cost?: number;
  notes: string | null;
  created_at: string;
  product?: { id: string; name: string; sku: string };
  branch?: { id: string; name: string };
}

export interface InventoryMovementsFilters {
  companyId: string;
  productId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  movementType?: string;
}

export const inventoryService = {
  /**
   * Stock Overview API – for Tab 1
   * Joins: products, inventory_balance (if exists), product_categories, prices
   * Fallback: if inventory_balance missing, use products.current_stock and 0 boxes/pieces
   */
  async getInventoryOverview(
    companyId: string,
    branchId?: string | null
  ): Promise<InventoryOverviewRow[]> {
    const productsQuery = supabase
      .from('products')
      .select(`
        id,
        sku,
        name,
        cost_price,
        retail_price,
        current_stock,
        min_stock,
        category_id,
        product_categories(id, name)
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');

    const { data: products, error: productsError } = await productsQuery;

    if (productsError) throw productsError;
    if (!products?.length) return [];

    const productIds = products.map((p: any) => p.id);

    let balanceMap: Record<string, { qty: number; boxes: number; pieces: number; unit?: string }> = {};
    try {
      let balanceQuery = supabase
        .from('inventory_balance')
        .select('product_id, qty, boxes, pieces, unit')
        .eq('company_id', companyId)
        .in('product_id', productIds);

      if (branchId && branchId !== 'all') {
        balanceQuery = balanceQuery.eq('branch_id', branchId);
      } else {
        balanceQuery = balanceQuery.is('branch_id', null);
      }

      const { data: balances } = await balanceQuery;
      if (balances?.length) {
        balances.forEach((b: any) => {
          balanceMap[b.product_id] = {
            qty: Number(b.qty) || 0,
            boxes: Number(b.boxes) || 0,
            pieces: Number(b.pieces) || 0,
            unit: b.unit,
          };
        });
      }
    } catch {
      // inventory_balance table may not exist yet – use products.current_stock
    }

    const rows: InventoryOverviewRow[] = products.map((p: any) => {
      const bal = balanceMap[p.id];
      const stock = bal ? bal.qty : (Number(p.current_stock) ?? 0);
      const boxes = bal?.boxes ?? 0;
      const pieces = bal?.pieces ?? 0;
      const minStock = Number(p.min_stock) ?? 0;
      const avgCost = Number(p.cost_price) ?? 0;
      const sellingPrice = Number(p.retail_price) ?? 0;
      const stockValue = stock * avgCost;

      let status: 'Low' | 'OK' | 'Out' = 'OK';
      if (stock <= 0) status = 'Out';
      else if (minStock > 0 && stock <= minStock) status = 'Low';

      return {
        id: p.id,
        productId: p.id,
        sku: p.sku || '',
        name: p.name || '',
        category: p.product_categories?.name || 'Uncategorized',
        categoryId: p.category_id,
        stock,
        boxes,
        pieces,
        unit: bal?.unit || 'pcs',
        avgCost,
        sellingPrice,
        stockValue,
        status,
        movement: 'Medium',
        minStock,
        reorderLevel: minStock,
      };
    });

    return rows;
  },

  /**
   * Stock Analytics / Movements API – for Tab 2
   * Filters: product, branch, date range, movement_type
   */
  async getInventoryMovements(
    filters: InventoryMovementsFilters
  ): Promise<InventoryMovementRow[]> {
    const { companyId, productId, branchId, dateFrom, dateTo, movementType } = filters;

    let query = supabase
      .from('stock_movements')
      .select(`
        id,
        product_id,
        branch_id,
        movement_type,
        reference_type,
        reference_id,
        quantity,
        box_change,
        piece_change,
        unit,
        before_qty,
        after_qty,
        unit_cost,
        total_cost,
        notes,
        created_at,
        product:products(id, name, sku),
        branch:branches!branch_id(id, name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (productId) query = query.eq('product_id', productId);
    if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
    if (movementType) query = query.eq('movement_type', movementType);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59.999Z');

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as InventoryMovementRow[];
  },
};
