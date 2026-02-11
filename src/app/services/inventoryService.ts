/**
 * Inventory Management – Single Source of Truth
 * Design: docs/INVENTORY_MANAGEMENT_DESIGN.md
 *
 * Rules: (1) Stock = movement-based only (stock_movements); no product.current_stock.
 * (2) Parent product stock = sum of variation stocks (can be negative). (3) Variation
 * stock shown as-is (negative allowed, no clamping). (4) Packing columns (boxes/pieces)
 * only when enablePacking ON; 0 when product has no packing. (5) Unit from product.unit_id → units.short_code.
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
  hasVariations?: boolean;
  variations?: Array<{
    id: string;
    sku?: string;
    attributes: any;
    stock: number;
    boxes?: number;
    pieces?: number;
  }>;
  /** Combo/bundle: product is a virtual bundle; stock from components */
  isComboProduct?: boolean;
  comboItemCount?: number;
}

export interface InventoryMovementRow {
  id: string;
  product_id: string;
  branch_id: string | null;
  movement_type: string;
  reference_type: string | null;
  reference_id: string | null;
  variation_id?: string | null; // CRITICAL: Include variation_id for grouping
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
  variation?: { id: string; attributes: Record<string, string> } | null;
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
   * CRITICAL: Uses stock_movements as SINGLE SOURCE OF TRUTH
   * Formula: SUM(quantity) FROM stock_movements WHERE product_id = X GROUP BY product_id, variation_id
   */
  async getInventoryOverview(
    companyId: string,
    branchId?: string | null
  ): Promise<InventoryOverviewRow[]> {
    // Step 1: Get all active products (has_variations for RULE 3: parent row = SUM of variations)
    const productsQuery = supabase
      .from('products')
      .select(`
        id,
        sku,
        name,
        cost_price,
        retail_price,
        min_stock,
        category_id,
        has_variations,
        is_combo_product,
        unit_id,
        product_categories(id, name)
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');

    const { data: products, error: productsError } = await productsQuery;

    if (productsError) throw productsError;
    if (!products?.length) return [];

    const productIds = products.map((p: any) => p.id);

    // Step 1b: Combo item counts for combo products (for "Bundle (X items)" display)
    const comboProductIds = products.filter((p: any) => p.is_combo_product).map((p: any) => p.id);
    let comboItemCountMap: Record<string, number> = {};
    if (comboProductIds.length > 0) {
      const { data: combos } = await supabase
        .from('product_combos')
        .select('id, combo_product_id')
        .in('combo_product_id', comboProductIds)
        .eq('company_id', companyId)
        .eq('is_active', true);
      if (combos?.length) {
        const comboIds = combos.map((c: any) => c.id);
        const { data: comboItems } = await supabase
          .from('product_combo_items')
          .select('combo_id')
          .in('combo_id', comboIds);
        const countByComboId: Record<string, number> = {};
        comboItems?.forEach((i: any) => { countByComboId[i.combo_id] = (countByComboId[i.combo_id] || 0) + 1; });
        combos.forEach((c: any) => { comboItemCountMap[c.combo_product_id] = countByComboId[c.id] ?? 0; });
      }
    }

    // Step 2: Calculate stock from stock_movements (SINGLE SOURCE OF TRUTH)
    // 🔒 DIAGNOSTIC: Include movement_type, reference_type, reference_id, notes, created_at for negative stock diagnosis
    let stockQuery = supabase
      .from('stock_movements')
      .select('product_id, variation_id, quantity, box_change, piece_change, movement_type, reference_type, reference_id, notes, created_at')
      .eq('company_id', companyId)
      .in('product_id', productIds);

    // 🔒 CRITICAL FIX: When branchId is 'all' or null, include ALL branches (no filter)
    // When branchId is a specific UUID, filter by that branch
    if (branchId && branchId !== 'all') {
      stockQuery = stockQuery.eq('branch_id', branchId);
    }
    // If branchId is 'all' or null, don't filter by branch_id - include all movements

    const { data: movements, error: movementsError } = await stockQuery;

    // Step 3: Get product variations for products that have them
    const { data: variations } = await supabase
      .from('product_variations')
      .select('id, product_id, sku, attributes, stock')
      .in('product_id', productIds)
      .eq('is_active', true);

    const variationMap: Record<string, any[]> = {};
    if (variations) {
      variations.forEach((v: any) => {
        if (!variationMap[v.product_id]) {
          variationMap[v.product_id] = [];
        }
        variationMap[v.product_id].push(v);
      });
    }

    // Step 3b: Get units for product unit display (unit_id -> short_code)
    const unitIds = [...new Set((products || []).map((p: any) => p.unit_id).filter(Boolean))] as string[];
    let unitMap: Record<string, { short_code: string }> = {};
    if (unitIds.length > 0) {
      const { data: units } = await supabase
        .from('units')
        .select('id, short_code')
        .in('id', unitIds);
      if (units) {
        units.forEach((u: any) => {
          unitMap[u.id] = { short_code: u.short_code || 'pcs' };
        });
      }
    }

    // Step 4: Calculate stock + boxes + pieces from stock_movements (SINGLE SOURCE OF TRUTH)
    const productStockMap: Record<string, number> = {};
    const variationStockMap: Record<string, number> = {};
    const productBoxMap: Record<string, number> = {};
    const variationBoxMap: Record<string, number> = {};
    const productPieceMap: Record<string, number> = {};
    const variationPieceMap: Record<string, number> = {};
    
    if (movements && !movementsError) {
      movements.forEach((m: any) => {
        const productId = m.product_id;
        const variationId = m.variation_id;
        const qty = Number(m.quantity) || 0;
        const boxCh = Number(m.box_change) || 0;
        const pieceCh = Number(m.piece_change) || 0;
        
        if (!productId) {
          console.warn('[INVENTORY SERVICE] ⚠️ Movement with null product_id:', m);
          return;
        }
        
        if (variationId) {
          variationStockMap[variationId] = (variationStockMap[variationId] || 0) + qty;
          variationBoxMap[variationId] = (variationBoxMap[variationId] || 0) + boxCh;
          variationPieceMap[variationId] = (variationPieceMap[variationId] || 0) + pieceCh;
        } else {
          productStockMap[productId] = (productStockMap[productId] || 0) + qty;
          productBoxMap[productId] = (productBoxMap[productId] || 0) + boxCh;
          productPieceMap[productId] = (productPieceMap[productId] || 0) + pieceCh;
        }
      });
    } else if (movementsError) {
      console.error('[INVENTORY SERVICE] ❌ Error fetching stock movements:', movementsError);
    } else {
      console.warn('[INVENTORY SERVICE] ⚠️ No movements found or movements is null');
    }

    // Step 5: Build rows with calculated stock (RULE 3: variation-level tracking, parent = SUM of variations)
    const rows: InventoryOverviewRow[] = products.map((p: any) => {
      // RULE 1 & 3: Use DB has_variations when set; else derive from variationMap
      const hasVariations = p.has_variations === true || (variationMap[p.id]?.length || 0) > 0;

      let totalStock = 0;
      let totalBoxes = 0;
      let totalPieces = 0;
      if (hasVariations) {
        totalStock = (variationMap[p.id] || []).reduce((sum, v) => sum + (variationStockMap[v.id] || 0), 0);
        totalBoxes = (variationMap[p.id] || []).reduce((sum, v) => sum + (variationBoxMap[v.id] || 0), 0);
        totalPieces = (variationMap[p.id] || []).reduce((sum, v) => sum + (variationPieceMap[v.id] || 0), 0);
      } else {
        totalStock = productStockMap[p.id] || 0;
        totalBoxes = productBoxMap[p.id] || 0;
        totalPieces = productPieceMap[p.id] || 0;
      }
      
      // 🔒 SAFETY: Check for negative stock and log warning with diagnostic info
      // Negative stock indicates data issue (e.g., more sales than purchases)
      // Allow negative to show in UI for visibility (helps identify data issues)
      if (totalStock < 0) {
        // 🔒 DIAGNOSTIC: Fetch detailed movements for this product to help diagnose
        const productMovements = movements?.filter((m: any) => 
          m.product_id === p.id && (!m.variation_id || !hasVariations)
        ) || [];
        
        const movementSummary = {
          purchases: productMovements.filter((m: any) => m.movement_type === 'purchase').reduce((sum: number, m: any) => sum + (Number(m.quantity) || 0), 0),
          sales: productMovements.filter((m: any) => m.movement_type === 'sale').reduce((sum: number, m: any) => sum + (Number(m.quantity) || 0), 0),
          adjustments: productMovements.filter((m: any) => m.movement_type === 'adjustment').reduce((sum: number, m: any) => sum + (Number(m.quantity) || 0), 0),
          totalMovements: productMovements.length
        };
        
        console.warn('[INVENTORY SERVICE] ⚠️ Negative stock calculated:', {
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          calculatedStock: totalStock,
          hasVariations,
          productLevelStock: productStockMap[p.id],
          variationStocks: hasVariations ? variationMap[p.id].map((v: any) => ({
            variationId: v.id,
            stock: variationStockMap[v.id] || 0
          })) : [],
          movementSummary,
          recentMovements: productMovements.slice(-5).map((m: any) => ({
            type: m.movement_type,
            quantity: m.quantity,
            reference: m.reference_type,
            referenceId: m.reference_id,
            notes: m.notes,
            createdAt: m.created_at
          }))
        });
      }

      const minStock = Number(p.min_stock) ?? 0;
      const avgCost = Number(p.cost_price) ?? 0;
      const sellingPrice = Number(p.retail_price) ?? 0;
      const stockValue = totalStock * avgCost;

      let status: 'Low' | 'OK' | 'Out' = 'OK';
      if (totalStock <= 0) status = 'Out';
      else if (minStock > 0 && totalStock <= minStock) status = 'Low';

      return {
        id: p.id,
        productId: p.id,
        sku: p.sku || '',
        name: p.name || '',
        category: p.product_categories?.name || 'Uncategorized',
        categoryId: p.category_id,
        stock: totalStock,
        boxes: Math.round(totalBoxes * 100) / 100,
        pieces: Math.round(totalPieces * 100) / 100,
        unit: p.unit_id && unitMap[p.unit_id] ? unitMap[p.unit_id].short_code : 'pcs',
        avgCost,
        sellingPrice,
        stockValue,
        status,
        movement: 'Medium',
        minStock,
        reorderLevel: minStock,
        // Add variation data for UI (STEP 2: Show variations with individual stock)
        hasVariations: hasVariations,
        variations: hasVariations ? variationMap[p.id].map(v => ({
          id: v.id,
          sku: v.sku,
          attributes: v.attributes,
          stock: variationStockMap[v.id] ?? 0,
          boxes: Math.round((variationBoxMap[v.id] ?? 0) * 100) / 100,
          pieces: Math.round((variationPieceMap[v.id] ?? 0) * 100) / 100,
        })) : [],
        isComboProduct: !!p.is_combo_product,
        comboItemCount: comboItemCountMap[p.id] ?? 0,
      } as InventoryOverviewRow & { hasVariations?: boolean; variations?: any[] };
    });

    return rows;
  },

  /**
   * Stock Analytics / Movements API – for Tab 2
   * Filters: product, branch, date range, movement_type
   * Fetches variation details in a separate query to avoid schema relationship requirement.
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
        variation_id,
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
    const rows = (data || []) as InventoryMovementRow[];

    // Fetch variation details separately (avoids stock_movements->product_variations FK in schema cache)
    const variationIds = [...new Set(rows.map((r: any) => r.variation_id).filter(Boolean))] as string[];
    let variationMap: Record<string, { id: string; attributes: Record<string, string> }> = {};
    if (variationIds.length > 0) {
      const { data: variations } = await supabase
        .from('product_variations')
        .select('id, attributes')
        .in('id', variationIds);
      if (variations) {
        variations.forEach((v: any) => {
          variationMap[v.id] = { id: v.id, attributes: v.attributes || {} };
        });
      }
    }
    return rows.map((r: any) => ({
      ...r,
      variation: r.variation_id && variationMap[r.variation_id] ? variationMap[r.variation_id] : null,
    })) as InventoryMovementRow[];
  },

  /**
   * Returns the number of stock_movements rows for a product (used to decide if we need opening balance).
   */
  async getMovementCountForProduct(productId: string): Promise<number> {
    const { count, error } = await supabase
      .from('stock_movements')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId);
    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Returns the number of parent-level stock_movements (variation_id IS NULL) for a product.
   * Used to block enabling variations when product has parent-level stock (RULE 5).
   */
  async getParentLevelMovementCount(productId: string): Promise<number> {
    const { count, error } = await supabase
      .from('stock_movements')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .is('variation_id', null);
    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Returns the number of variation-level stock_movements (variation_id IS NOT NULL) for a product.
   * Used to block disabling variations when product has variation-level stock.
   */
  async getVariationLevelMovementCount(productId: string): Promise<number> {
    const { count, error } = await supabase
      .from('stock_movements')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .not('variation_id', 'is', null);
    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Insert a single opening-balance stock movement (accounting standard: stock comes from movements).
   * When variationId is provided, stock is at variation level (RULE 1: parent cannot hold stock when has_variations).
   */
  async insertOpeningBalanceMovement(
    companyId: string,
    branchId: string | null,
    productId: string,
    quantity: number,
    unitCost: number = 0,
    variationId?: string | null
  ): Promise<{ error: any }> {
    const totalCost = quantity * unitCost;
    const { error } = await supabase.from('stock_movements').insert({
      company_id: companyId,
      branch_id: branchId && branchId !== 'all' ? branchId : null,
      product_id: productId,
      variation_id: variationId ?? null,
      movement_type: 'adjustment',
      quantity: Number(quantity),
      unit_cost: unitCost,
      total_cost: totalCost,
      reference_type: 'opening_balance',
      reference_id: null,
      notes: variationId ? 'Opening stock (variation)' : 'Opening stock',
    });
    return { error };
  },
};
