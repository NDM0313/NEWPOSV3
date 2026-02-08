/**
 * Combo Service
 * Handles product combos/bundles operations
 * Model: Virtual Bundle - Combo product does NOT hold stock
 */

import { supabase } from '@/lib/supabase';

export interface ProductCombo {
  id: string;
  company_id: string;
  combo_product_id: string;
  combo_name: string;
  combo_price: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductComboItem {
  id: string;
  company_id: string;
  combo_id: string;
  product_id: string;
  variation_id?: string | null;
  qty: number;
  unit_price?: number | null;
  created_at?: string;
}

export interface ComboWithItems extends ProductCombo {
  items: ProductComboItem[];
}

export interface CreateComboParams {
  company_id: string;
  combo_product_id: string;
  combo_name: string;
  combo_price: number;
  items: Array<{
    product_id: string;
    variation_id?: string | null;
    qty: number;
    unit_price?: number | null;
  }>;
}

export const comboService = {
  /**
   * Get all combos for a company
   */
  async getCombos(companyId: string, includeInactive = false): Promise<ProductCombo[]> {
    let query = supabase
      .from('product_combos')
      .select('*')
      .eq('company_id', companyId)
      .order('combo_name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[COMBO SERVICE] Error fetching combos:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get combo by ID with items
   */
  async getComboById(comboId: string, companyId: string): Promise<ComboWithItems | null> {
    // Get combo
    const { data: combo, error: comboError } = await supabase
      .from('product_combos')
      .select('*')
      .eq('id', comboId)
      .eq('company_id', companyId)
      .single();

    if (comboError) {
      if (comboError.code === 'PGRST116') return null; // Not found
      console.error('[COMBO SERVICE] Error fetching combo:', comboError);
      throw comboError;
    }

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('product_combo_items')
      .select('*')
      .eq('combo_id', comboId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('[COMBO SERVICE] Error fetching combo items:', itemsError);
      throw itemsError;
    }

    return {
      ...combo,
      items: items || [],
    };
  },

  /**
   * Get combo by product ID (if product is a combo)
   */
  async getComboByProductId(productId: string, companyId: string): Promise<ComboWithItems | null> {
    // Get combo
    const { data: combo, error: comboError } = await supabase
      .from('product_combos')
      .select('*')
      .eq('combo_product_id', productId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle();

    if (comboError) {
      console.error('[COMBO SERVICE] Error fetching combo by product:', comboError);
      throw comboError;
    }

    if (!combo) return null;

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('product_combo_items')
      .select('*')
      .eq('combo_id', combo.id)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('[COMBO SERVICE] Error fetching combo items:', itemsError);
      throw itemsError;
    }

    return {
      ...combo,
      items: items || [],
    };
  },

  /**
   * Create a new combo with items
   */
  async createCombo(params: CreateComboParams): Promise<ComboWithItems> {
    // Validate items
    if (!params.items || params.items.length === 0) {
      throw new Error('Combo must have at least one item');
    }

    // Create combo
    const { data: combo, error: comboError } = await supabase
      .from('product_combos')
      .insert({
        company_id: params.company_id,
        combo_product_id: params.combo_product_id,
        combo_name: params.combo_name,
        combo_price: params.combo_price,
        is_active: true,
      })
      .select()
      .single();

    if (comboError) {
      console.error('[COMBO SERVICE] Error creating combo:', comboError);
      throw comboError;
    }

    // Create items
    const itemsToInsert = params.items.map(item => ({
      company_id: params.company_id,
      combo_id: combo.id,
      product_id: item.product_id,
      variation_id: item.variation_id || null,
      qty: item.qty,
      unit_price: item.unit_price || null,
    }));

    const { data: items, error: itemsError } = await supabase
      .from('product_combo_items')
      .insert(itemsToInsert)
      .select();

    if (itemsError) {
      // Rollback: delete combo if items insert fails
      await supabase.from('product_combos').delete().eq('id', combo.id);
      console.error('[COMBO SERVICE] Error creating combo items:', itemsError);
      throw new Error(`Failed to create combo items: ${itemsError.message}`);
    }

    return {
      ...combo,
      items: items || [],
    };
  },

  /**
   * Update combo
   */
  async updateCombo(
    comboId: string,
    companyId: string,
    updates: {
      combo_name?: string;
      combo_price?: number;
      is_active?: boolean;
    }
  ): Promise<ProductCombo> {
    const { data, error } = await supabase
      .from('product_combos')
      .update(updates)
      .eq('id', comboId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('[COMBO SERVICE] Error updating combo:', error);
      throw error;
    }

    return data;
  },

  /**
   * Update combo items (replace all items)
   */
  async updateComboItems(
    comboId: string,
    companyId: string,
    items: Array<{
      product_id: string;
      variation_id?: string | null;
      qty: number;
      unit_price?: number | null;
    }>
  ): Promise<ProductComboItem[]> {
    // Delete existing items
    const { error: deleteError } = await supabase
      .from('product_combo_items')
      .delete()
      .eq('combo_id', comboId)
      .eq('company_id', companyId);

    if (deleteError) {
      console.error('[COMBO SERVICE] Error deleting combo items:', deleteError);
      throw deleteError;
    }

    // Insert new items
    if (items.length === 0) {
      return [];
    }

    const itemsToInsert = items.map(item => ({
      company_id: companyId,
      combo_id: comboId,
      product_id: item.product_id,
      variation_id: item.variation_id || null,
      qty: item.qty,
      unit_price: item.unit_price || null,
    }));

    const { data, error } = await supabase
      .from('product_combo_items')
      .insert(itemsToInsert)
      .select();

    if (error) {
      console.error('[COMBO SERVICE] Error creating combo items:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Delete combo (and its items via CASCADE)
   */
  async deleteCombo(comboId: string, companyId: string): Promise<void> {
    const { error } = await supabase
      .from('product_combos')
      .delete()
      .eq('id', comboId)
      .eq('company_id', companyId);

    if (error) {
      console.error('[COMBO SERVICE] Error deleting combo:', error);
      throw error;
    }
  },

  /**
   * Check if product is a combo
   * First checks is_combo_product flag (faster), then falls back to product_combos table
   */
  async isComboProduct(productId: string, companyId: string): Promise<boolean> {
    // First check is_combo_product flag (faster lookup)
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('is_combo_product')
      .eq('id', productId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (productError && productError.code !== 'PGRST116') {
      console.error('[COMBO SERVICE] Error checking product is_combo_product flag:', productError);
      throw productError;
    }

    // If flag is set, return true immediately
    if (product?.is_combo_product) {
      return true;
    }

    // Fallback: Check product_combos table (for backward compatibility)
    const { data, error } = await supabase
      .from('product_combos')
      .select('id')
      .eq('combo_product_id', productId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[COMBO SERVICE] Error checking combo product:', error);
      throw error;
    }

    return !!data;
  },

  /**
   * Get combo items with product details (for display)
   */
  async getComboItemsWithDetails(comboId: string, companyId: string): Promise<Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_sku: string;
    variation_id?: string | null;
    variation_sku?: string | null;
    qty: number;
    unit_price?: number | null;
  }>> {
    const { data, error } = await supabase
      .from('product_combo_items')
      .select(`
        id,
        product_id,
        variation_id,
        qty,
        unit_price,
        products!inner (
          name,
          sku
        ),
        product_variations (
          sku
        )
      `)
      .eq('combo_id', comboId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[COMBO SERVICE] Error fetching combo items with details:', error);
      throw error;
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.products?.name || '',
      product_sku: item.products?.sku || '',
      variation_id: item.variation_id,
      variation_sku: item.product_variations?.sku || null,
      qty: item.qty,
      unit_price: item.unit_price,
    }));
  },
};
