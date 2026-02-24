import { supabase } from '@/lib/supabase';

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

export const productService = {
  // Get all products
  async getAllProducts(companyId: string) {
    // Note: company_id and is_active columns may not exist in all databases
    let query = supabase
      .from('products')
      .select(`
        *,
        category:product_categories(id, name),
        variations:product_variations(*)
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    
    const { data, error } = await query;
    
    // If error is about foreign key relationship, try without explicit foreign key name
    if (error && (error.code === '42703' || error.code === '42P01')) {
      const retryQuery = supabase
        .from('products')
        .select(`
          *,
          category:product_categories(id, name),
          variations:product_variations(*)
        `)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      const { data: retryData, error: retryError } = await retryQuery;
      
      // If still error, try without relationships
      if (retryError) {
        const simpleQuery = supabase
          .from('products')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('name');
        
        const { data: simpleData, error: simpleError } = await simpleQuery;
        if (simpleError) throw simpleError;
        return simpleData;
      }
      
      return retryData;
    }
    
    // If error is about is_active column not existing, retry without it
    if (error && error.code === '42703' && error.message?.includes('is_active')) {
      const { data: retryData, error: retryError } = await supabase
        .from('products')
        .select(`
          *,
          category:product_categories(id, name),
          variations:product_variations(*)
        `)
        .eq('company_id', companyId)
        .order('name');
      
      if (retryError) {
        // If company_id also doesn't exist, retry without both
        const { data: finalData, error: finalError } = await supabase
          .from('products')
          .select(`
            *,
            category:product_categories(id, name),
            variations:product_variations(*)
          `)
          .order('name');
        
        if (finalError) throw finalError;
        return finalData;
      }
      return retryData;
    }
    
    // If error is about company_id column not existing, retry without it
    if (error && error.code === '42703' && error.message?.includes('company_id')) {
      const { data: retryData, error: retryError } = await supabase
        .from('products')
        .select(`
          *,
          category:product_categories(id, name),
          variations:product_variations(*)
        `)
        .eq('is_active', true)
        .order('name');
      
      if (retryError) {
        // If is_active also doesn't exist, retry without both
        const { data: finalData, error: finalError } = await supabase
          .from('products')
          .select(`
            *,
            category:product_categories(id, name),
            variations:product_variations(*)
          `)
          .order('name');
        
        if (finalError) throw finalError;
        return finalData;
      }
      return retryData;
    }

    if (error) throw error;
    return data;
  },

  // Get single product
  async getProduct(id: string) {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:product_categories(*),
        variations:product_variations(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create product
  async createProduct(product: Partial<Product>) {
    const payload = ensureProductIds(product as Record<string, unknown>);
    const { data, error } = await supabase
      .from('products')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || (error.message && /duplicate key value|unique constraint/i.test(error.message))) {
        const hint = product.sku ? `SKU "${product.sku}" is already in use for this company.` : 'A product with this SKU already exists.';
        throw new Error(`${hint} Please use a different SKU or generate a new one.`);
      }
      throw error;
    }
    return data;
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
        const payloadAlt: Record<string, unknown> = {
          product_id: params.product_id,
          name: params.name,
          sku: params.sku,
          barcode: params.barcode ?? null,
          attributes: params.attributes ?? {},
          price: params.retail_price ?? params.cost_price ?? null,
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

  // Update product (form sends unit_id, category_id, brand_id in updates)
  async updateProduct(id: string, updates: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
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

  // Search products
  async searchProducts(companyId: string, query: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`)
      .limit(20);

    // If error is about is_active column not existing, retry without it
    if (error && error.message?.includes('is_active')) {
      const { data: retryData, error: retryError } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`)
        .limit(20);
      
      if (retryError) throw retryError;
      return retryData;
    }
    
    if (error) throw error;
    return data;
  },

  // Get low stock products
  async getLowStockProducts(companyId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .lt('current_stock', 'min_stock')
      .order('current_stock');

    // If error is about is_active column not existing, retry without it
    if (error && error.message?.includes('is_active')) {
      const { data: retryData, error: retryError } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .lt('current_stock', 'min_stock')
        .order('current_stock');
      
      if (retryError) throw retryError;
      return retryData;
    }
    
    if (error) throw error;
    return data;
  },

  // Get stock movements for a product (optionally filtered by variation_id and branch_id)
  async getStockMovements(productId: string, companyId: string, variationId?: string, branchId?: string) {
    // Reduced logging - only log errors and warnings
    // Step 1: Try basic query first (no filters to see if ANY data exists)
    const { data: allData, error: allError } = await supabase
      .from('stock_movements')
      .select('id, product_id, company_id, branch_id')
      .limit(5);

    // Step 2: Try query with product_id only (no company_id filter)
    const { data: productData, error: productError } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Step 3: Now try with both filters (include ALL movement types: purchase, sale, adjustment, transfer, return, etc.)
    // Use * to select all fields (handles missing columns gracefully)
    let query = supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .eq('company_id', companyId);
    
    // NO FILTER BY movement_type - we want ALL types (purchase, sale, adjustment, transfer, return, etc.)
    // This ensures adjustments are included
    
    // PART 3 FIX: Filter by variation_id ONLY if explicitly provided AND not 'all'
    // CRITICAL: If variationId is provided, filter by it. If NULL/undefined, show ALL movements (including those with NULL variation_id)
    // This handles products without variations gracefully
    if (variationId && variationId !== 'all') {
      try {
        query = query.eq('variation_id', variationId);
      } catch (err) {
        // Column may not exist - silently skip
      }
    }
    
    // PART 2 FIX: Filter by branch_id ONLY if explicitly provided AND not 'all'
    // If branchId is undefined/null/'all', don't filter - show all movements
    if (branchId && branchId !== 'all') {
      try {
        query = query.eq('branch_id', branchId);
      } catch (err) {
        // Column may not exist - silently skip
      }
    }
    
    // Order by date DESC for initial fetch (will be sorted ASC for balance calculation)
    query = query.order('created_at', { ascending: false });

    const { data: basicData, error: basicError } = await query;

    if (basicError) {
      console.error('[STOCK MOVEMENTS QUERY] Filtered query error:', basicError);
      // If table doesn't exist or column mismatch, return empty array
      // Also handle 400 errors which may indicate column doesn't exist (e.g., variation_id, branch_id)
      if (basicError.code === '42P01' || basicError.code === '42703' || basicError.code === 'PGRST116' || basicError.status === 400) {
        // Check if error is about variation_id column
        const isVariationError = basicError.message?.includes('variation_id');
        const isBranchError = basicError.message?.includes('branch_id');
        
        // Column may not exist - retry intelligently
        if (isVariationError || isBranchError) {
          console.warn('[Stock Movements] Column may not exist, retrying without problematic filter(s)');
          
          // Retry query without the problematic filter(s)
          let retryQuery = supabase
            .from('stock_movements')
            .select('*')
            .eq('product_id', productId)
            .eq('company_id', companyId);
          
          // Only apply branch_id filter if variation_id was the problem
          if (isVariationError && branchId) {
            retryQuery = retryQuery.eq('branch_id', branchId);
            console.log('[Stock Movements] Retrying with branch_id filter only (variation_id column missing)');
          }
          // Only apply variation_id filter if branch_id was the problem (unlikely but handle it)
          else if (isBranchError && variationId) {
            retryQuery = retryQuery.eq('variation_id', variationId);
            console.log('[Stock Movements] Retrying with variation_id filter only (branch_id column missing)');
          }
          // If both or unknown, retry without both
          else {
            console.log('[Stock Movements] Retrying without variation_id and branch_id filters');
          }
          
          retryQuery = retryQuery.order('created_at', { ascending: false });
          
          const { data: retryData, error: retryError } = await retryQuery;
          if (retryError) {
            // If retry also fails, try completely unfiltered (except product_id and company_id)
            console.warn('[Stock Movements] Retry query also failed, trying without all optional filters');
            const { data: finalData, error: finalError } = await supabase
              .from('stock_movements')
              .select('*')
              .eq('product_id', productId)
              .eq('company_id', companyId)
              .order('created_at', { ascending: false });
            
            if (finalError) {
              console.warn('[Stock Movements] Final retry also failed, returning empty array');
              return [];
            }
            return finalData || [];
          }
          return retryData || [];
        }
        console.warn('[Stock Movements] Table or column not found, returning empty array');
        return [];
      }
      throw basicError;
    }

    // Step 4: If we have data, try with relationships (optional - return basic if fails)
    if (basicData && basicData.length > 0) {
      console.log('[STOCK MOVEMENTS QUERY] Step 4: Adding relationships to query...');
      
      try {
        // Try to include variation relationship, but don't fail if column doesn't exist
        // Build query with relationships (variation relationship removed as column may not exist)
        let fullQuery = supabase
          .from('stock_movements')
          .select(`
            *,
            product:products(id, name, sku),
            branch:branches!branch_id(id, name)
          `)
          .eq('product_id', productId)
          .eq('company_id', companyId);
        
        // PART 2 FIX: Apply variation_id filter ONLY if explicitly provided AND not 'all'
        if (variationId && variationId !== 'all') {
          try {
            fullQuery = fullQuery.eq('variation_id', variationId);
            console.log('[STOCK MOVEMENTS QUERY] Full query: Filtering by variation_id:', variationId);
          } catch (err) {
            console.warn('[STOCK MOVEMENTS QUERY] variation_id filter failed, continuing without it:', err);
          }
        } else {
          console.log('[STOCK MOVEMENTS QUERY] Full query: No variation_id filter (showing all variations)');
        }
        
        // PART 2 FIX: Apply branch_id filter ONLY if explicitly provided AND not 'all'
        if (branchId && branchId !== 'all') {
          try {
            fullQuery = fullQuery.eq('branch_id', branchId);
            console.log('[STOCK MOVEMENTS QUERY] Full query: Filtering by branch_id:', branchId);
          } catch (err) {
            console.warn('[STOCK MOVEMENTS QUERY] branch_id filter failed, continuing without it:', err);
          }
        } else {
          console.log('[STOCK MOVEMENTS QUERY] Full query: No branch_id filter (showing all branches)');
        }
        
        const { data: fullData, error: fullError } = await fullQuery.order('created_at', { ascending: false });

        if (fullError) {
          console.warn('[STOCK MOVEMENTS QUERY] Relationship query failed, using basic data:', fullError);
          return basicData;
        }

        console.log('[STOCK MOVEMENTS QUERY] Full query with relationships successful:', {
          dataCount: fullData?.length || 0,
          sampleData: fullData?.[0] || null
        });

        return fullData || [];
      } catch (relError) {
        console.warn('[STOCK MOVEMENTS QUERY] Relationship query exception, using basic data:', relError);
        return basicData;
      }
    }

    // If no data found, check if product_id or company_id mismatch
    if (productData && productData.length > 0 && basicData && basicData.length === 0) {
      // Only warn if we found data by product_id but not by company_id (mismatch)
      const foundCompanyIds = [...new Set(productData.map(d => d.company_id))];
      if (!foundCompanyIds.includes(companyId)) {
        console.warn('[STOCK MOVEMENTS] company_id mismatch detected. Run migration: fix_stock_movements_company_id.sql', {
          productId,
          foundCompanyIds,
          requestedCompanyId: companyId
        });
      }
    }
    return basicData || [];
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
        }).catch(() => {
          // Ignore if activity_logs insert fails
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
          return retryMovement2;
        }
        
        console.log('[CREATE STOCK MOVEMENT] Success (using movement_type column):', {
          id: retryMovement.id,
          movement_type: retryMovement.movement_type || retryMovement.type,
          quantity: retryMovement.quantity
        });
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
    
    return movement;
  },
};
