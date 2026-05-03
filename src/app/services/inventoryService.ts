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
import { isDebugErpEnabled } from '@/app/lib/debugErp';
import { openingBalanceJournalService } from '@/app/services/openingBalanceJournalService';
import {
  parseVariationAttributesRaw,
  publicVariationAttributes,
  variationPurchaseFromApiRow,
  variationRetailFromApiRow,
} from '@/app/utils/variationFieldMap';

// Dedupe negative-stock warnings per product so console isn't flooded when multiple forms call getInventoryOverview
const negativeStockWarnedIds = new Set<string>();

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  const m = (error.message || '').toLowerCase();
  return (m.includes('column') && m.includes('does not exist')) || m.includes('pgrst');
}

/** Variation select layers ordered by likelihood — actual minimal schema first, richer schemas as fallback. */
const PRODUCT_VARIATIONS_OVERVIEW_SELECT_LAYERS = [
  'id, product_id, sku, barcode, attributes, price, stock, is_active',
  'id, product_id, sku, barcode, attributes, cost_price, purchase_price, retail_price, selling_price, wholesale_price, price',
  'id, product_id, sku, barcode, attributes, cost_price, retail_price, wholesale_price, price',
  'id, product_id, sku, barcode, attributes',
  'id, product_id, sku, attributes',
  'id, product_id, sku',
] as const;

/** In-flight guard: reuse same promise for overlapping getInventoryOverview(companyId, branchId) to avoid duplicate timers. */
const inventoryOverviewInFlight = new Map<string, Promise<InventoryOverviewRow[]>>();

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
    attributes: Record<string, string>;
    stock: number;
    boxes?: number;
    pieces?: number;
    /** Purchase / cost for this variation (DB or parent fallback). */
    purchasePrice: number;
    /** Selling / retail unit price for this variation (DB or parent fallback). */
    sellingPrice: number;
    /** stock × purchasePrice (cost basis). */
    stockValueAtCost: number;
    /** stock × sellingPrice (retail extension). */
    retailStockValue: number;
  }>;
  /** Combo/bundle: product is a virtual bundle; stock from components */
  isComboProduct?: boolean;
  comboItemCount?: number;
  brandId?: string | null;
}

export interface MovementAggregate {
  productId: string;
  variationId: string | null;
  totalSold: number;
  totalTransferred: number;
  totalAdjusted: number;
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
    const key = `${companyId}:${branchId ?? 'all'}`;
    const existing = inventoryOverviewInFlight.get(key);
    if (existing) return existing;

    const run = async (): Promise<InventoryOverviewRow[]> => {
      try {
        return await this._getInventoryOverviewInner(companyId, branchId);
      } finally {
        inventoryOverviewInFlight.delete(key);
      }
    };
    const promise = run.call(this);
    inventoryOverviewInFlight.set(key, promise);
    return promise;
  },

  async _getInventoryOverviewInner(
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
        brand_id,
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
    const comboProductIds = products.filter((p: any) => p.is_combo_product).map((p: any) => p.id);
    const unitIds = [...new Set((products || []).map((p: any) => p.unit_id).filter(Boolean))] as string[];

    // Build stock movements query
    let stockQuery = supabase
      .from('stock_movements')
      .select('product_id, variation_id, quantity, box_change, piece_change, unit_cost, movement_type')
      .eq('company_id', companyId)
      .in('product_id', productIds);
    if (branchId && branchId !== 'all') {
      stockQuery = stockQuery.eq('branch_id', branchId);
    }

    // Run movements, variations, and units queries in parallel (they only need productIds from Step 1)
    const fetchVariationsForOverview = async () => {
      for (const sel of PRODUCT_VARIATIONS_OVERVIEW_SELECT_LAYERS) {
        const { data, error } = await supabase
          .from('product_variations')
          .select(sel)
          .in('product_id', productIds)
          .eq('is_active', true);
        if (!error) return { data: data || [], error: null as Error | null };
        if (!isMissingColumnError(error)) {
          console.warn('[INVENTORY SERVICE] product_variations fetch failed:', error.message);
          return { data: [], error };
        }
      }
      return { data: [], error: null };
    };

    console.time('inventoryOverview:parallel');
    const [
      { data: movements, error: movementsError },
      variationsPack,
      { data: units },
      combosResult,
    ] = await Promise.all([
      stockQuery,
      fetchVariationsForOverview(),
      unitIds.length > 0
        ? supabase.from('units').select('id, short_code').in('id', unitIds)
        : Promise.resolve({ data: [] }),
      comboProductIds.length > 0
        ? supabase.from('product_combos').select('id, combo_product_id').in('combo_product_id', comboProductIds).eq('company_id', companyId).eq('is_active', true)
        : Promise.resolve({ data: [] }),
    ]);
    console.timeEnd('inventoryOverview:parallel');

    let movRows = movements;
    if (movementsError && isMissingColumnError(movementsError)) {
      let qFallback = supabase
        .from('stock_movements')
        .select('product_id, variation_id, quantity, box_change, piece_change')
        .eq('company_id', companyId)
        .in('product_id', productIds);
      if (branchId && branchId !== 'all') qFallback = qFallback.eq('branch_id', branchId);
      const { data: m2, error: e2 } = await qFallback;
      if (!e2) movRows = m2;
      else console.warn('[INVENTORY SERVICE] stock_movements fallback fetch:', e2.message);
    } else if (movementsError) {
      console.warn('[INVENTORY SERVICE] stock_movements:', movementsError.message);
    }

    const variations = variationsPack.data;
    const variationsError = variationsPack.error;
    if (variationsError) {
      console.warn('[INVENTORY SERVICE] product_variations fetch failed (schema may differ):', variationsError.message);
    }

    // Process combo item counts
    let comboItemCountMap: Record<string, number> = {};
    const combos = combosResult.data;
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

    const variationMap: Record<string, any[]> = {};
    if (variations) {
      variations.forEach((v: any) => {
        if (!variationMap[v.product_id]) variationMap[v.product_id] = [];
        variationMap[v.product_id].push(v);
      });
    }

    let unitMap: Record<string, { short_code: string }> = {};
    if (units) {
      units.forEach((u: any) => {
        unitMap[u.id] = { short_code: u.short_code || 'pcs' };
      });
    }

    // Step 4: Calculate stock + boxes + pieces from stock_movements (SINGLE SOURCE OF TRUTH)
    const productStockMap: Record<string, number> = {};
    const variationStockMap: Record<string, number> = {};
    const productBoxMap: Record<string, number> = {};
    const variationBoxMap: Record<string, number> = {};
    const productPieceMap: Record<string, number> = {};
    const variationPieceMap: Record<string, number> = {};
    /** Quantity-weighted unit_cost from movements (when product_variations row has no cost yet). */
    const variationCostWeighted: Record<string, { sum: number; q: number }> = {};
    /** Quantity-weighted unit_cost from non-variation movements for parent product fallback cost. */
    const productCostWeighted: Record<string, { sum: number; q: number }> = {};

    const canProcessMovements =
      Array.isArray(movRows) && (!movementsError || isMissingColumnError(movementsError));

    if (canProcessMovements) {
      movRows!.forEach((m: any) => {
        const productId = m.product_id;
        const variationId = m.variation_id;
        const qty = Number(m.quantity) || 0;
        const boxCh = Number(m.box_change) || 0;
        const pieceCh = Number(m.piece_change) || 0;
        const uc = Number(m.unit_cost);
        const absQ = Math.abs(qty);

        if (!productId) {
          console.warn('[INVENTORY SERVICE] ⚠️ Movement with null product_id:', m);
          return;
        }

        if (variationId && Number.isFinite(uc) && uc > 0 && absQ > 0) {
          if (!variationCostWeighted[variationId]) variationCostWeighted[variationId] = { sum: 0, q: 0 };
          variationCostWeighted[variationId].sum += uc * absQ;
          variationCostWeighted[variationId].q += absQ;
        } else if (!variationId && Number.isFinite(uc) && uc > 0 && absQ > 0) {
          if (!productCostWeighted[productId]) productCostWeighted[productId] = { sum: 0, q: 0 };
          productCostWeighted[productId].sum += uc * absQ;
          productCostWeighted[productId].q += absQ;
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
    } else if (movementsError && !isMissingColumnError(movementsError)) {
      console.error('[INVENTORY SERVICE] ❌ Error fetching stock movements:', movementsError);
    } else if (!movRows?.length) {
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
        // Variation lines + parent-level movements (variation_id null): sales/production sometimes post without variation_id
        const variationSum = (variationMap[p.id] || []).reduce((sum, v) => sum + (variationStockMap[v.id] || 0), 0);
        const orphanParent = productStockMap[p.id] || 0;
        totalStock = variationSum + orphanParent;
        totalBoxes = (variationMap[p.id] || []).reduce((sum, v) => sum + (variationBoxMap[v.id] || 0), 0) + (productBoxMap[p.id] || 0);
        totalPieces = (variationMap[p.id] || []).reduce((sum, v) => sum + (variationPieceMap[v.id] || 0), 0) + (productPieceMap[p.id] || 0);
      } else {
        totalStock = productStockMap[p.id] || 0;
        totalBoxes = productBoxMap[p.id] || 0;
        totalPieces = productPieceMap[p.id] || 0;
      }
      
      // Negative stock = more out (sales) than in (purchases/production). UI still shows it; log only in dev to avoid console noise.
      if (totalStock < 0) {
        const alreadyWarned = negativeStockWarnedIds.has(p.id);
        if (!alreadyWarned && import.meta.env?.DEV && isDebugErpEnabled()) {
          negativeStockWarnedIds.add(p.id);
          const productMovements = movements?.filter((m: any) =>
            m.product_id === p.id && (!m.variation_id || !hasVariations)
          ) || [];
          const movementSummary = {
            purchases: productMovements.filter((m: any) => m.movement_type === 'purchase').reduce((sum: number, m: any) => sum + (Number(m.quantity) || 0), 0),
            production: productMovements
              .filter(
                (m: any) =>
                  m.movement_type === 'production' ||
                  String(m.movement_type || '') === 'PRODUCTION_IN'
              )
              .reduce((sum: number, m: any) => sum + (Number(m.quantity) || 0), 0),
            sales: productMovements.filter((m: any) => m.movement_type === 'sale').reduce((sum: number, m: any) => sum + (Number(m.quantity) || 0), 0),
            adjustments: productMovements.filter((m: any) => m.movement_type === 'adjustment').reduce((sum: number, m: any) => sum + (Number(m.quantity) || 0), 0),
            totalMovements: productMovements.length
          };
          console.warn('[INVENTORY SERVICE] ⚠️ Negative stock (dev only):', p.sku, totalStock, movementSummary);
        }
      }

      const minStock = Number(p.min_stock) ?? 0;
      const storedCost = Number(p.cost_price) || 0;
      let avgCost = storedCost;
      if (!(avgCost > 0)) {
        const parentWeighted = productCostWeighted[p.id];
        if (parentWeighted && parentWeighted.q > 0) {
          avgCost = Math.round((parentWeighted.sum / parentWeighted.q) * 10000) / 10000;
        } else if (hasVariations && (variationMap[p.id] || []).length > 0) {
          const variationRows = (variationMap[p.id] || [])
            .map((v: any) => {
              const ownPurchase = variationPurchaseFromApiRow(v as Record<string, unknown>);
              const ownCost = Number(v?.cost_price) || 0;
              const wc = variationCostWeighted[v.id];
              const movementCost = wc && wc.q > 0 ? (wc.sum / wc.q) : 0;
              const resolvedCost =
                ownPurchase && ownPurchase > 0
                  ? ownPurchase
                  : ownCost > 0
                    ? ownCost
                    : movementCost > 0
                      ? movementCost
                      : 0;
              return {
                qty: Math.max(0, variationStockMap[v.id] ?? 0),
                cost: resolvedCost,
              };
            })
            .filter((r) => r.cost > 0);
          const weightedQty = variationRows.reduce((sum, r) => sum + r.qty, 0);
          if (weightedQty > 0) {
            avgCost = Math.round((variationRows.reduce((sum, r) => sum + (r.qty * r.cost), 0) / weightedQty) * 10000) / 10000;
          } else if (variationRows.length > 0) {
            avgCost = Math.round((variationRows.reduce((sum, r) => sum + r.cost, 0) / variationRows.length) * 10000) / 10000;
          }
        }
      }
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
        brandId: (p as any).brand_id || null,
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
        variations: hasVariations
          ? (variationMap[p.id] || []).map((v: any) => {
              const vr = v as Record<string, unknown>;
              const attrs = publicVariationAttributes(parseVariationAttributesRaw(v.attributes));
              const qty = variationStockMap[v.id] ?? 0;
              const ownPurchase = variationPurchaseFromApiRow(vr);
              const ownRetail = variationRetailFromApiRow(vr);
              const wc = variationCostWeighted[v.id];
              const fromMovements =
                wc && wc.q > 0 ? Math.round((wc.sum / wc.q) * 10000) / 10000 : null;
              const purchasePrice =
                ownPurchase != null && ownPurchase > 0
                  ? ownPurchase
                  : fromMovements != null && fromMovements > 0
                    ? fromMovements
                    : avgCost;
              const variationSellingPrice = ownRetail != null ? ownRetail : sellingPrice;
              return {
                id: v.id,
                sku: v.sku,
                attributes: attrs,
                stock: qty,
                boxes: Math.round((variationBoxMap[v.id] ?? 0) * 100) / 100,
                pieces: Math.round((variationPieceMap[v.id] ?? 0) * 100) / 100,
                purchasePrice,
                sellingPrice: variationSellingPrice,
                stockValueAtCost: qty * purchasePrice,
                retailStockValue: qty * variationSellingPrice,
              };
            })
          : [],
        isComboProduct: !!p.is_combo_product,
        comboItemCount: comboItemCountMap[p.id] ?? 0,
      } as InventoryOverviewRow & { hasVariations?: boolean; variations?: any[] };
    });

    return rows;
  },

  /**
   * Get variations with current stock for a single product (e.g. Adjust Stock dialog for variable products).
   * Stock is from stock_movements (single source of truth).
   */
  async getVariationsWithStock(
    companyId: string,
    productId: string,
    branchId?: string | null
  ): Promise<Array<{ id: string; sku: string; name?: string; attributes: Record<string, unknown>; stock: number }>> {
    const { data: variations, error: varError } = await supabase
      .from('product_variations')
      .select('id, product_id, sku, attributes')
      .eq('product_id', productId)
      .eq('is_active', true);
    if (varError || !variations?.length) return [];

    let movementQuery = supabase
      .from('stock_movements')
      .select('variation_id, quantity')
      .eq('company_id', companyId)
      .eq('product_id', productId)
      .not('variation_id', 'is', null);
    if (branchId && branchId !== 'all') {
      movementQuery = movementQuery.eq('branch_id', branchId);
    }
    const { data: movements } = await movementQuery;
    const stockByVariation: Record<string, number> = {};
    (movements || []).forEach((m: any) => {
      const vid = m.variation_id;
      if (vid) stockByVariation[vid] = (stockByVariation[vid] || 0) + (Number(m.quantity) || 0);
    });

    return variations.map((v: any) => ({
      id: v.id,
      sku: v.sku || '',
      name: v.name, // optional column in some schemas
      attributes: publicVariationAttributes(parseVariationAttributesRaw(v.attributes)) as Record<string, unknown>,
      stock: stockByVariation[v.id] ?? 0,
    }));
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
   * Single stock API — Phase 3 Implementation Log.
   * Returns SUM(quantity) FROM stock_movements for the given product/variation/branch.
   * Use this instead of products.current_stock or product_variations.stock.
   */
  async getStock(
    companyId: string,
    productId: string,
    variationId?: string | null,
    branchId?: string | null
  ): Promise<number> {
    let q = supabase
      .from('stock_movements')
      .select('quantity')
      .eq('company_id', companyId)
      .eq('product_id', productId);
    if (variationId != null) {
      q = q.eq('variation_id', variationId);
    } else {
      q = q.is('variation_id', null);
    }
    if (branchId && branchId !== 'all') {
      q = q.eq('branch_id', branchId);
    }
    const { data, error } = await q;
    if (error) throw error;
    const total = (data || []).reduce((sum: number, row: any) => sum + (Number(row.quantity) || 0), 0);
    return total;
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
   * Product edit may adjust parent-level opening only when there is no movement history beyond a single opening row.
   * Otherwise reconcile would treat on-hand total as "opening" and corrupt history (e.g. after sales).
   */
  async allowsParentOpeningReconcileFromProductForm(
    companyId: string,
    productId: string,
    branchId: string | null
  ): Promise<boolean> {
    let q = supabase
      .from('stock_movements')
      .select('id, reference_type, movement_type')
      .eq('company_id', companyId)
      .eq('product_id', productId)
      .is('variation_id', null);
    const b = branchId && branchId !== 'all' ? branchId : null;
    if (b) q = q.eq('branch_id', b);
    else q = q.is('branch_id', null);
    const { data, error } = await q;
    if (error) {
      console.warn('[INVENTORY] allowsParentOpeningReconcileFromProductForm:', error);
      return false;
    }
    const rows = data || [];
    if (rows.length === 0) return true;
    if (rows.length === 1) {
      const r = rows[0] as { reference_type?: string | null; movement_type?: string | null };
      return String(r.reference_type || '').toLowerCase() === 'opening_balance';
    }
    return false;
  },

  /** Same as parent-level rule, scoped to one variation_id (for product form opening stock edits). */
  async allowsVariationOpeningReconcileFromProductForm(
    companyId: string,
    productId: string,
    variationId: string,
    branchId: string | null
  ): Promise<boolean> {
    let q = supabase
      .from('stock_movements')
      .select('id, reference_type, movement_type')
      .eq('company_id', companyId)
      .eq('product_id', productId)
      .eq('variation_id', variationId);
    const b = branchId && branchId !== 'all' ? branchId : null;
    if (b) q = q.eq('branch_id', b);
    else q = q.is('branch_id', null);
    const { data, error } = await q;
    if (error) {
      console.warn('[INVENTORY] allowsVariationOpeningReconcileFromProductForm:', error);
      return false;
    }
    const rows = data || [];
    if (rows.length === 0) return true;
    if (rows.length === 1) {
      const r = rows[0] as { reference_type?: string | null; movement_type?: string | null };
      return String(r.reference_type || '').toLowerCase() === 'opening_balance';
    }
    return false;
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
  /**
   * Parent-level opening stock: insert when there are no movements yet; if exactly one opening row exists, update qty/cost and resync GL.
   */
  async reconcileParentLevelOpeningStock(
    companyId: string,
    branchId: string | null,
    productId: string,
    quantity: number,
    unitCost: number,
    totalMovementCount: number
  ): Promise<{ error: any }> {
    const b = branchId && branchId !== 'all' ? branchId : null;
    let q = supabase
      .from('stock_movements')
      .select('id')
      .eq('company_id', companyId)
      .eq('product_id', productId)
      .is('variation_id', null)
      .eq('movement_type', 'adjustment')
      .eq('reference_type', 'opening_balance');
    if (b) q = q.eq('branch_id', b);
    else q = q.is('branch_id', null);

    const { data: openings, error: qerr } = await q;
    if (qerr) return { error: qerr };

    const qty = Number(quantity) || 0;
    const uc = Number(unitCost) || 0;
    const totalCost = qty * uc;

    if (!openings?.length) {
      if (totalMovementCount === 0 && qty > 0) {
        return this.insertOpeningBalanceMovement(companyId, b, productId, qty, uc);
      }
      return { error: null };
    }
    if (openings.length > 1) {
      console.warn(
        '[INVENTORY] Multiple parent-level opening_balance movements; edit skipped for GL reconciliation',
        productId
      );
      return { error: null };
    }
    const id = openings[0].id as string;
    const { error: uerr } = await supabase
      .from('stock_movements')
      .update({
        quantity: qty,
        unit_cost: uc,
        total_cost: totalCost,
      })
      .eq('id', id);
    if (uerr) return { error: uerr };
    try {
      await openingBalanceJournalService.syncInventoryOpeningFromStockMovementId(id);
    } catch (jeErr) {
      console.warn('[INVENTORY] Opening stock updated but GL sync failed:', jeErr);
    }
    return { error: null };
  },

  /**
   * Variation-level opening: same rules as parent — only touches a single opening_balance row per variation+branch.
   */
  async reconcileVariationOpeningStock(
    companyId: string,
    branchId: string | null,
    productId: string,
    variationId: string,
    quantity: number,
    unitCost: number
  ): Promise<{ error: any }> {
    const b = branchId && branchId !== 'all' ? branchId : null;
    let q = supabase
      .from('stock_movements')
      .select('id')
      .eq('company_id', companyId)
      .eq('product_id', productId)
      .eq('variation_id', variationId)
      .eq('movement_type', 'adjustment')
      .eq('reference_type', 'opening_balance');
    if (b) q = q.eq('branch_id', b);
    else q = q.is('branch_id', null);

    const { data: openings, error: qerr } = await q;
    if (qerr) return { error: qerr };

    const qty = Number(quantity) || 0;
    const uc = Number(unitCost) || 0;
    const totalCost = qty * uc;

    if (!openings?.length) {
      if (qty > 0) {
        return this.insertOpeningBalanceMovement(companyId, b, productId, qty, uc, variationId);
      }
      return { error: null };
    }
    if (openings.length > 1) {
      console.warn(
        '[INVENTORY] Multiple variation opening_balance movements; edit skipped for GL reconciliation',
        variationId
      );
      return { error: null };
    }
    const id = openings[0].id as string;
    const { error: uerr } = await supabase
      .from('stock_movements')
      .update({
        quantity: qty,
        unit_cost: uc,
        total_cost: totalCost,
      })
      .eq('id', id);
    if (uerr) return { error: uerr };
    try {
      await openingBalanceJournalService.syncInventoryOpeningFromStockMovementId(id);
    } catch (jeErr) {
      console.warn('[INVENTORY] Variation opening stock updated but GL sync failed:', jeErr);
    }
    return { error: null };
  },

  async insertOpeningBalanceMovement(
    companyId: string,
    branchId: string | null,
    productId: string,
    quantity: number,
    unitCost: number = 0,
    variationId?: string | null
  ): Promise<{ error: any }> {
    const totalCost = quantity * unitCost;
    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
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
      })
      .select('id')
      .single();
    if (!error && data?.id) {
      try {
        await openingBalanceJournalService.syncInventoryOpeningFromStockMovementId(data.id as string);
      } catch (jeErr) {
        console.warn('[INVENTORY] Opening stock saved but GL sync failed:', jeErr);
      }
    }
    return { error };
  },

  /**
   * After insert via generic paths: sync GL only for opening_balance + adjustment (avoids extra DB read for normal movements).
   */
  async syncOpeningJournalIfApplicable(movement: {
    id: string;
    reference_type?: string | null;
    movement_type?: string | null;
    type?: string | null;
  }): Promise<void> {
    const ref = String(movement.reference_type || '').toLowerCase().trim();
    const mt = String(movement.movement_type || movement.type || '').toLowerCase().trim();
    if (ref !== 'opening_balance' || mt !== 'adjustment') return;
    await openingBalanceJournalService.syncInventoryOpeningFromStockMovementId(movement.id);
  },

  /**
   * Movement Aggregates – per product/variation totals for Stock Report.
   * Returns total sold, transferred, and adjusted quantities grouped by product_id + variation_id.
   */
  async getMovementAggregates(
    companyId: string,
    branchId?: string | null
  ): Promise<MovementAggregate[]> {
    let query = supabase
      .from('stock_movements')
      .select('product_id, variation_id, quantity, movement_type')
      .eq('company_id', companyId);
    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }
    const { data: movements, error } = await query;
    if (error) {
      console.warn('[INVENTORY SERVICE] getMovementAggregates error:', error.message);
      return [];
    }
    if (!movements?.length) return [];

    const SOLD_TYPES = new Set(['sale']);
    const TRANSFER_TYPES = new Set(['transfer', 'transfer_in', 'transfer_out']);
    const ADJUST_TYPES = new Set(['adjustment']);

    const map = new Map<string, { productId: string; variationId: string | null; totalSold: number; totalTransferred: number; totalAdjusted: number }>();

    for (const m of movements) {
      const key = `${m.product_id}:${m.variation_id || ''}`;
      if (!map.has(key)) {
        map.set(key, { productId: m.product_id, variationId: m.variation_id || null, totalSold: 0, totalTransferred: 0, totalAdjusted: 0 });
      }
      const agg = map.get(key)!;
      const mt = (m.movement_type || '').toLowerCase().trim();
      const qty = Number(m.quantity) || 0;

      if (SOLD_TYPES.has(mt)) {
        agg.totalSold += Math.abs(qty);
      } else if (TRANSFER_TYPES.has(mt)) {
        agg.totalTransferred += Math.abs(qty);
      } else if (ADJUST_TYPES.has(mt)) {
        agg.totalAdjusted += qty;
      }
    }

    return Array.from(map.values());
  },
};
