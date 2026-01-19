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
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:product_categories(id, name),
        variations:product_variations(*)
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');

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

    if (error) throw error;
    return data;
  },
};
