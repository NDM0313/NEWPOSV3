import { supabase } from '@/lib/supabase';

export interface Product {
  id: string;
  company_id: string;
  category_id: string;
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
  created_at: string;
  updated_at: string;
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
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update product
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

  // Get stock movements for a product
  async getStockMovements(productId: string, companyId: string) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select(`
        *,
        product:products(id, name, sku),
        branch:branches!stock_movements_branch_id_fkey(id, name)
      `)
      .eq('product_id', productId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist or column mismatch, return empty array
      if (error.code === '42P01' || error.code === '42703') {
        console.warn('[Stock Movements] Table or column not found, returning empty array');
        return [];
      }
      throw error;
    }
    return data || [];
  },
};
