import { supabase } from '@/lib/supabase';
import { documentNumberService } from '@/app/services/documentNumberService';
import { calculateStockFromMovements } from '@/app/utils/stockCalculation';
import type { StockMovement } from '@/app/utils/stockCalculation';
import { inventoryService } from '@/app/services/inventoryService';
import {
  parseVariationAttributesRaw,
  publicVariationAttributes,
  variationAttributesForMinimalSchemaSave,
  variationPurchaseFromApiRow,
  variationRetailFromApiRow,
} from '@/app/utils/variationFieldMap';

/** normal = catalog product; production = manufactured from studio (STD-PROD, inventory + cost). */
export type ProductType = 'normal' | 'production';

/** Which module created this product. */
export type ProductSourceType = 'studio' | 'manual' | 'purchase' | 'pos';

export interface Product {
  id: string;
  company_id: string;
  category_id: string;
  brand_id?: string;
  unit_id?: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  cost_price: number;
  retail_price: number;
  wholesale_price: number;
  rental_price_daily?: number;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  has_variations: boolean;
  is_rentable: boolean;
  is_sellable: boolean;
  track_stock: boolean;
  is_active: boolean;
  image_urls?: string[];
  /** normal = catalog; production = studio manufactured (STD-PROD). */
  product_type?: ProductType;
  /** Which module created this product (studio | manual | purchase | pos). */
  source_type?: ProductSourceType;
  created_at: string;
  updated_at: string;
}

function ensureProductIds(payload: Record<string, unknown>): Record<string, unknown> {
  const out = { ...payload };
  if (!('unit_id' in out)) out.unit_id = null;
  if (!('category_id' in out)) out.category_id = null;
  if (!('brand_id' in out)) out.brand_id = null;
  return out;
}

// Explicit select lists: never request current_stock (column may not exist). Stock from stock_movements/inventory overview.
const PRODUCT_SELECT_SAFE =
  'id, company_id, category_id, brand_id, unit_id, name, sku, barcode, description, cost_price, retail_price, wholesale_price, min_stock, max_stock, has_variations, is_rentable, is_sellable, track_stock, is_active, image_urls, product_type, source_type, created_at, updated_at';

/** Variation select layers — actual minimal schema first, richer schemas as fallback for future column additions. */
const VARIATION_SELECT_LAYERS = [
  'id, product_id, sku, barcode, attributes, price, stock, is_active',
  'id, product_id, sku, barcode, attributes, cost_price, purchase_price, retail_price, selling_price, wholesale_price, current_stock, price, stock, name, is_active',
  'id, product_id, sku, barcode, attributes, cost_price, retail_price, wholesale_price, current_stock, name, is_active',
  'id, product_id, sku, barcode, attributes',
  'id, product_id, sku, attributes',
] as const;

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  const m = (error.message || '').toLowerCase();
  return (m.includes('column') && m.includes('does not exist')) || m.includes('pgrst');
}

/** Human-readable variation name for DB `name` column when present. */
export function formatVariationName(attributes: Record<string, string>): string {
  return Object.entries(publicVariationAttributes(attributes))
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

/** Normalize API variation (any supported column set) to form row; stock is optional until movements are merged. */
export function mapProductVariationApiToFormRow(v: Record<string, unknown>): {
  id?: string;
  combination: Record<string, string>;
  sku: string;
  price: number;
  purchasePrice: number;
  stock: number;
  barcode: string;
} {
  const attrsFull = parseVariationAttributesRaw(v.attributes);
  const combination = publicVariationAttributes(attrsFull);
  const retail = variationRetailFromApiRow(v);
  const purchase = variationPurchaseFromApiRow(v);
  const stockCol =
    v.current_stock != null && v.current_stock !== ''
      ? Number(v.current_stock)
      : v.stock != null && v.stock !== ''
        ? Number(v.stock)
        : 0;
  return {
    id: typeof v.id === 'string' ? v.id : undefined,
    combination,
    sku: String(v.sku ?? ''),
    price: retail != null && Number.isFinite(retail) ? retail : 0,
    purchasePrice: purchase != null && Number.isFinite(purchase) ? purchase : 0,
    stock: Number.isFinite(stockCol) ? stockCol : 0,
    barcode: String(v.barcode ?? ''),
  };
}

/** In-flight guard: reuse same promise for overlapping getStockMovements(productId) to avoid "Timer 'stockMovements:id' already exists". */
const stockMovementsInFlight = new Map<string, Promise<any[]>>();

export const productService = {
  // Get all products (no current_stock: use inventory overview for stock)
  async getAllProducts(companyId: string) {
    const withVariations = (vSel: string) =>
      supabase
        .from('products')
        .select(
          `${PRODUCT_SELECT_SAFE}, category:product_categories(id, name), variations:product_variations(${vSel})`
        )
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

    let lastErr: { code?: string; message?: string } | null = null;
    for (const vSel of VARIATION_SELECT_LAYERS) {
      const { data, error } = await withVariations(vSel);
      if (!error) return data;
      if (isMissingColumnError(error)) {
        lastErr = error;
        continue;
      }
      lastErr = error;
      break;
    }

    if (lastErr?.code === '42703' && lastErr?.message?.includes('is_active')) {
      for (const vSel of VARIATION_SELECT_LAYERS) {
        const { data, error } = await supabase
          .from('products')
          .select(
            `${PRODUCT_SELECT_SAFE}, category:product_categories(id, name), variations:product_variations(${vSel})`
          )
          .eq('company_id', companyId)
          .order('name');
        if (!error) return data;
        if (!isMissingColumnError(error)) throw error;
      }
    }
    if (lastErr?.code === '42703' && lastErr?.message?.includes('company_id')) {
      for (const vSel of VARIATION_SELECT_LAYERS) {
        const { data, error } = await supabase
          .from('products')
          .select(
            `${PRODUCT_SELECT_SAFE}, category:product_categories(id, name), variations:product_variations(${vSel})`
          )
          .eq('is_active', true)
          .order('name');
        if (!error) return data;
        if (!isMissingColumnError(error)) throw error;
      }
    }

    const { data: simpleData, error: simpleError } = await supabase
      .from('products')
      .select(PRODUCT_SELECT_SAFE)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    if (!simpleError) return simpleData;
    throw lastErr || simpleError;
  },

  // Get single product (no current_stock; stock from stock_movements)
  async getProduct(id: string) {
    for (const vSel of VARIATION_SELECT_LAYERS) {
      const { data, error } = await supabase
        .from('products')
        .select(
          `${PRODUCT_SELECT_SAFE}, category:product_categories(id, name), variations:product_variations(${vSel})`
        )
        .eq('id', id)
        .single();
      if (!error) return data;
      if (isMissingColumnError(error)) continue;
      throw error;
    }
    const { data, error } = await supabase
      .from('products')
      .select(`${PRODUCT_SELECT_SAFE}, category:product_categories(id, name)`)
      .eq('id', id)
      .single();
    if (error) throw error;
    return { ...data, variations: [] as unknown[] };
  },

  // Create product (uses ERP numbering engine for SKU; auto-retry once on duplicate SKU).
  // Never send current_stock to DB (column may not exist; stock is movement-based).
  async createProduct(product: Partial<Product>) {
    const raw = ensureProductIds(product as Record<string, unknown>);
    const { current_stock: _cs, ...payload } = raw as Record<string, unknown>;
    const companyId = (payload.company_id as string) || (product as any).company_id;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase
        .from('products')
        .insert(payload)
        .select()
        .single();

      if (!error) return data;

      const isDuplicate = error.code === '23505' || (error.message && /duplicate key value|unique constraint/i.test(error.message));
      const isSkuConflict = isDuplicate && (error.message && /sku|SKU/i.test(error.message) || (product.sku && error.message?.includes(product.sku as string)));

      if (isSkuConflict && companyId && attempt === 0) {
        try {
          const nextSKU = await documentNumberService.getNextProductSKU(companyId, null);
          (payload as any).sku = nextSKU;
          lastError = error;
          continue;
        } catch (e) {
          lastError = e;
        }
      }

      if (isDuplicate) {
        const hint = product.sku ? `SKU "${product.sku}" is already in use for this company.` : 'A product with this SKU already exists.';
        throw new Error(`${hint} Please use a different SKU or generate a new one.`);
      }
      throw error;
    }

    const hint = (payload as any).sku ? `SKU "${(payload as any).sku}" is already in use.` : 'Duplicate SKU.';
    throw new Error(`${hint} Please use a different SKU or generate a new one.`);
  },

  /** Create a product variation (Size, Color, etc.). product_variations table.
   * Supports two schemas: (name, cost_price, retail_price, current_stock) and (price, stock) only. */
  async createVariation(params: {
    product_id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    attributes?: Record<string, string>;
    cost_price?: number;
    retail_price?: number;
    wholesale_price?: number;
    current_stock?: number;
  }) {
    const payloadFull = {
      product_id: params.product_id,
      name: params.name,
      sku: params.sku,
      barcode: params.barcode ?? null,
      attributes: params.attributes ?? {},
      cost_price: params.cost_price ?? null,
      retail_price: params.retail_price ?? null,
      wholesale_price: params.wholesale_price ?? null,
      current_stock: params.current_stock ?? 0,
      is_active: true,
    };
    const { data, error } = await supabase
      .from('product_variations')
      .insert(payloadFull)
      .select()
      .single();

    if (error) {
      const msg = (error as any).message || '';
      const columnNotFound = /could not find.*column|column.*does not exist|PGRST/i.test(msg);
      if (columnNotFound) {
        const purchaseForEmbed =
          params.cost_price != null && Number.isFinite(Number(params.cost_price))
            ? Number(params.cost_price)
            : null;
        const attrsMinimal = variationAttributesForMinimalSchemaSave(params.attributes ?? {}, purchaseForEmbed);
        const payloadAlt: Record<string, unknown> = {
          product_id: params.product_id,
          name: params.name,
          sku: params.sku,
          barcode: params.barcode ?? null,
          attributes: attrsMinimal,
          // Minimal schema: `price` is selling only; purchase lives in cost columns (if added) or __erp_purchase_price in attributes.
          price: params.retail_price ?? (params as { price?: number }).price ?? null,
          stock: params.current_stock ?? 0,
          is_active: true,
        };
        let res = await supabase.from('product_variations').insert(payloadAlt).select().single();
        if (res.error && /could not find.*column|column.*does not exist|name/i.test((res.error as any).message || '')) {
          const { name: _n, ...payloadNoName } = payloadAlt;
          res = await supabase.from('product_variations').insert(payloadNoName).select().single();
        }
        if (res.error) throw res.error;
        return res.data;
      }
      throw error;
    }
    return data;
  },

  /** Update existing variation row (full ERP schema first, then price-only minimal schema). Stock stays movement-based — do not zero DB stock columns here. */
  async updateVariation(
    variationId: string,
    params: {
      sku: string;
      barcode?: string | null;
      attributes: Record<string, string>;
      name: string;
      cost_price?: number | null;
      retail_price?: number | null;
      wholesale_price?: number | null;
      price?: number | null;
    }
  ) {
    const ts = new Date().toISOString();
    const fullPayload: Record<string, unknown> = {
      sku: params.sku,
      barcode: params.barcode ?? null,
      attributes: params.attributes ?? {},
      name: params.name,
      cost_price: params.cost_price ?? null,
      retail_price: params.retail_price ?? null,
      wholesale_price: params.wholesale_price ?? null,
      updated_at: ts,
    };
    const { error } = await supabase.from('product_variations').update(fullPayload).eq('id', variationId);
    if (!error) return;

    const msg = (error as { message?: string }).message || '';
    const columnNotFound = /could not find.*column|column.*does not exist|PGRST/i.test(msg);
    if (!columnNotFound) throw error;

    const purchaseForEmbed =
      params.cost_price != null && params.cost_price !== '' && Number.isFinite(Number(params.cost_price))
        ? Number(params.cost_price)
        : null;
    const attrsMinimal = variationAttributesForMinimalSchemaSave(params.attributes ?? {}, purchaseForEmbed);
    const alt: Record<string, unknown> = {
      sku: params.sku,
      barcode: params.barcode ?? null,
      attributes: attrsMinimal,
      price: params.retail_price ?? params.price ?? null,
      updated_at: ts,
    };
    let res = await supabase.from('product_variations').update(alt).eq('id', variationId);
    if (res.error && /could not find.*column|column.*does not exist|name/i.test((res.error as { message?: string }).message || '')) {
      const { name: _n, ...noName } = alt;
      res = await supabase.from('product_variations').update(noName).eq('id', variationId);
    }
    if (res.error) throw res.error;
  },

  // Update product (form sends unit_id, category_id, brand_id in updates).
  // Never send current_stock to DB (column may not exist; stock is movement-based).
  async updateProduct(id: string, updates: Partial<Product>) {
    const { current_stock: _cs, ...safe } = updates as Record<string, unknown>;
    const { data, error } = await supabase
      .from('products')
      .update(safe)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete product (soft delete)
  async deleteProduct(id: string) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  // Search products (explicit columns; no current_stock)
  async searchProducts(companyId: string, query: string) {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT_SAFE)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`)
      .limit(20);

    if (error && error.message?.includes('is_active')) {
      const { data: retryData, error: retryError } = await supabase
        .from('products')
        .select(PRODUCT_SELECT_SAFE)
        .eq('company_id', companyId)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`)
        .limit(20);
      if (retryError) throw retryError;
      return retryData;
    }
    if (error) throw error;
    return data;
  },

  /**
   * Search products created from Studio production only (source_type = 'studio').
   * Falls back to product_type = 'production' if source_type column does not exist yet.
   */
  async searchStudioProducts(companyId: string, query: string) {
    const baseQuery = () => {
      let q = supabase
        .from('products')
        .select('id, name, sku, category_id, image_urls, source_type, product_type')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(20);
      if (query.trim()) {
        q = q.ilike('name', `%${query.trim()}%`);
      }
      return q;
    };

    // Primary: filter by source_type = 'studio'
    const { data, error } = await baseQuery().eq('source_type', 'studio');

    if (!error) return data ?? [];

    // Fallback: source_type column may not exist yet – filter by product_type = 'production'
    const isColumnMissing = /could not find.*column|column.*does not exist|source_type/i.test(error.message ?? '');
    if (isColumnMissing) {
      let fallback = supabase
        .from('products')
        .select('id, name, sku, category_id, image_urls, product_type')
        .eq('company_id', companyId)
        .eq('product_type', 'production')
        .order('name', { ascending: true })
        .limit(20);
      if (query.trim()) {
        fallback = fallback.ilike('name', `%${query.trim()}%`);
      }
      const { data: fbData, error: fbError } = await fallback;
      if (fbError) throw fbError;
      return fbData ?? [];
    }

    throw error;
  },

  // Get low stock products. Movement-based only (stock_movements). Never queries current_stock.
  async getLowStockProducts(companyId: string, branchId?: string | null) {
    try {
      const rows = await inventoryService.getInventoryOverview(companyId, branchId ?? undefined);
      const low = (rows || []).filter((r) => r.minStock > 0 && r.stock < r.minStock);
      return low.map((r) => ({
        id: r.id,
        name: r.name,
        sku: r.sku,
        current_stock: r.stock,
        min_stock: r.minStock,
      }));
    } catch {
      return [];
    }
  },

  // Get stock movements for a product (optionally filtered by variation_id and branch_id)
  // Consolidated to a single query with relationships — removed all debug probe queries
  async getStockMovements(productId: string, companyId: string, variationId?: string, branchId?: string) {
    const key = `${productId}:${companyId}:${variationId ?? ''}:${branchId ?? ''}`;
    const existing = stockMovementsInFlight.get(key);
    if (existing) return existing;

    const run = async (): Promise<any[]> => {
      try {
        return await this._getStockMovementsInner(productId, companyId, variationId, branchId);
      } finally {
        stockMovementsInFlight.delete(key);
      }
    };
    const promise = run.call(this);
    stockMovementsInFlight.set(key, promise);
    return promise;
  },

  async _getStockMovementsInner(productId: string, companyId: string, variationId?: string, branchId?: string): Promise<any[]> {
    console.time(`stockMovements:${productId}`);
    try {
      let query = supabase
        .from('stock_movements')
        .select(`
          id, product_id, company_id, branch_id, variation_id,
          quantity, box_change, piece_change, movement_type,
          reference_type, reference_id, notes, created_at,
          product:products(id, name, sku),
          branch:branches!branch_id(id, name)
        `)
        .eq('product_id', productId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (variationId && variationId !== 'all') {
        query = query.eq('variation_id', variationId);
      }

      // Include company-wide rows (branch_id null) when filtering by branch — matches inventory rollups.
      if (branchId && branchId !== 'all') {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }

      const { data, error } = await query;

      if (error) {
        // If columns are missing (schema mismatch), fall back to a minimal query
        if (error.code === '42703') {
          console.warn('[Stock Movements] Column mismatch, retrying with minimal select:', error.message);
          let fb = supabase
            .from('stock_movements')
            .select('*')
            .eq('product_id', productId)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });
          if (branchId && branchId !== 'all') {
            fb = fb.or(`branch_id.eq.${branchId},branch_id.is.null`);
          }
          const { data: fallback, error: fallbackError } = await fb;
          if (fallbackError) {
            console.warn('[Stock Movements] Fallback also failed, returning []');
            return [];
          }
          return fallback || [];
        }
        if (error.code === '42P01') {
          console.warn('[Stock Movements] Table does not exist, returning []');
          return [];
        }
        throw error;
      }

      return data || [];
    } finally {
      console.timeEnd(`stockMovements:${productId}`);
    }
  },

  /**
   * Batched stock check: single query for multiple products. Returns map of available qty per product (and per variation).
   * Key: productId for simple products, or "productId:variationId" for variation-specific.
   */
  async getStockForProducts(
    productIds: string[],
    companyId: string,
    branchId?: string
  ): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();
    const uniq = [...new Set(productIds)];
    let query = supabase
      .from('stock_movements')
      .select('product_id, variation_id, quantity, movement_type')
      .in('product_id', uniq)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });
    if (branchId && branchId !== 'all') {
      // Include both branch-specific AND company-wide (null branch) movements.
      // Opening stock and other company-level movements have branch_id = null and must count.
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
    }
    const { data, error } = await query;
    if (error) {
      if (error.code === '42703' || error.code === '42P01') return new Map();
      throw error;
    }
    const rows = (data || []) as { product_id: string; variation_id?: string | null; quantity: number; movement_type: string }[];
    const byKey = new Map<string, StockMovement[]>();
    for (const r of rows) {
      const key = r.variation_id ? `${r.product_id}:${r.variation_id}` : `${r.product_id}:`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push({
        movement_type: r.movement_type,
        quantity: r.quantity,
        variation_id: r.variation_id ?? undefined,
      });
    }
    const out = new Map<string, number>();
    for (const [key, movements] of byKey.entries()) {
      const { currentBalance } = calculateStockFromMovements(movements);
      out.set(key, currentBalance);
    }
    return out;
  },

  // Create stock movement record (for adjustments, manual entries, etc.)
  async createStockMovement(data: {
    company_id: string;
    branch_id?: string;
    product_id: string;
    variation_id?: string; // CRITICAL: For variation-specific stock tracking
    movement_type: string; // 'purchase', 'sale', 'adjustment', 'transfer', 'return'
    quantity: number; // Positive for IN, Negative for OUT
    unit_cost?: number;
    total_cost?: number;
    reference_type?: string;
    reference_id?: string;
    notes?: string;
    created_by?: string;
    box_change?: number; // Packing: net boxes (positive IN, negative OUT)
    piece_change?: number; // Packing: net pieces (positive IN, negative OUT)
  }) {
    console.log('[CREATE STOCK MOVEMENT] Creating movement:', {
      product_id: data.product_id,
      movement_type: data.movement_type,
      quantity: data.quantity,
      company_id: data.company_id,
      branch_id: data.branch_id,
      timestamp: new Date().toISOString()
    });

    // Try with movement_type first (most common schema)
    let insertData: any = {
      company_id: data.company_id,
      branch_id: data.branch_id || null,
      product_id: data.product_id,
      variation_id: data.variation_id || null,
      quantity: data.quantity,
      unit_cost: data.unit_cost || 0,
      total_cost: data.total_cost || (data.unit_cost || 0) * Math.abs(data.quantity),
      reference_type: data.reference_type || null,
      reference_id: data.reference_id || null,
      notes: data.notes || null,
      created_by: data.created_by || null,
    };

    insertData.movement_type = data.movement_type;
    // Box and pieces are always integers in inventory (no decimals)
    if (data.box_change != null) insertData.box_change = Math.round(Number(data.box_change));
    if (data.piece_change != null) insertData.piece_change = Math.round(Number(data.piece_change));

    let { data: movement, error } = await supabase
      .from('stock_movements')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // CRITICAL: Comprehensive error logging (STEP 1 requirement)
      console.error('[CREATE STOCK MOVEMENT] ❌ ERROR CREATING STOCK MOVEMENT:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        insertData: JSON.stringify(insertData, null, 2)
      });
      
      // Log to database/activity log if possible
      try {
        // Try to log error to activity_logs if table exists
        await supabase.from('activity_logs').insert({
          company_id: data.company_id,
          module: 'inventory',
          entity_id: data.product_id,
          action: 'stock_movement_error',
          description: `Failed to create stock movement: ${error.message}`,
          notes: JSON.stringify({ error, insertData })
        });
      } catch (logError) {
        // Ignore logging errors
      }
      
      // If error is about column not found, try with only one column name
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
        console.log('[CREATE STOCK MOVEMENT] Retrying with single column name...');
        
        // Remove one of the columns and retry
        const retryData = { ...insertData };
        // Note: insertData only has movement_type, not type, so no need to delete
        const { data: retryMovement, error: retryError } = await supabase
          .from('stock_movements')
          .insert(retryData)
          .select()
          .single();
        
        if (retryError) {
          // Try with type only
          const retryData2 = { ...insertData };
          delete retryData2.movement_type;
          const { data: retryMovement2, error: retryError2 } = await supabase
            .from('stock_movements')
            .insert(retryData2)
            .select()
            .single();
          
          if (retryError2) {
            throw retryError2;
          }
          
          console.log('[CREATE STOCK MOVEMENT] Success (using type column):', {
            id: retryMovement2.id,
            type: retryMovement2.type || retryMovement2.movement_type,
            quantity: retryMovement2.quantity
          });
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('inventory-updated'));
          await inventoryService.syncOpeningJournalIfApplicable(retryMovement2);
          return retryMovement2;
        }
        
        console.log('[CREATE STOCK MOVEMENT] Success (using movement_type column):', {
          id: retryMovement.id,
          movement_type: retryMovement.movement_type || retryMovement.type,
          quantity: retryMovement.quantity
        });
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('inventory-updated'));
        await inventoryService.syncOpeningJournalIfApplicable(retryMovement);
        return retryMovement;
      }
      
      throw error;
    }
    
    // CRITICAL: Verify movement was created successfully
    if (!movement || !movement.id) {
      const errorMsg = 'Stock movement creation returned null/undefined';
      console.error('[CREATE STOCK MOVEMENT] ❌ CRITICAL: Movement not created:', errorMsg);
      throw new Error(errorMsg);
    }
    
    // Success logging
    console.log('[CREATE STOCK MOVEMENT] ✅ SUCCESS:', {
      movement_id: movement.id,
      product_id: movement.product_id,
      variation_id: movement.variation_id,
      quantity: movement.quantity,
      movement_type: movement.movement_type || movement.type,
      reference_type: movement.reference_type,
      reference_id: movement.reference_id,
      created_at: movement.created_at
    });
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('inventory-updated'));
    await inventoryService.syncOpeningJournalIfApplicable(movement);
    return movement;
  },
};
