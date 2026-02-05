import { supabase } from '@/lib/supabase';

export interface ProductCategory {
  id: string;
  company_id: string;
  name: string;
  parent_id: string | null;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Top-level categories (parent_id IS NULL) */
export async function getCategories(companyId: string, options?: { includeInactive?: boolean }) {
  let query = supabase
    .from('product_categories')
    .select('*')
    .eq('company_id', companyId)
    .is('parent_id', null)
    .order('name');
  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as ProductCategory[];
}

/** Sub-categories for a given category (parent_id = categoryId) */
export async function getSubCategories(companyId: string, categoryId: string, options?: { includeInactive?: boolean }) {
  let query = supabase
    .from('product_categories')
    .select('*')
    .eq('company_id', companyId)
    .eq('parent_id', categoryId)
    .order('name');
  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as ProductCategory[];
}

/** All categories and sub-categories (flat list with parent_id set for sub-categories) */
export async function getAllCategoriesFlat(companyId: string, options?: { includeInactive?: boolean }) {
  let query = supabase
    .from('product_categories')
    .select('*')
    .eq('company_id', companyId)
    .order('parent_id', { ascending: true, nullsFirst: true })
    .order('name');
  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as ProductCategory[];
}

export const productCategoryService = {
  getCategories,
  getSubCategories,
  getAllCategoriesFlat,

  async getById(id: string) {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as ProductCategory;
  },

  /** Create top-level category (parent_id = null) or sub-category (parent_id = categoryId) */
  async create(payload: {
    company_id: string;
    name: string;
    parent_id?: string | null;
    description?: string;
  }) {
    const { data, error } = await supabase
      .from('product_categories')
      .insert({
        company_id: payload.company_id,
        name: payload.name.trim(),
        parent_id: payload.parent_id ?? null,
        description: payload.description?.trim() || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data as ProductCategory;
  },

  async update(
    id: string,
    updates: Partial<Pick<ProductCategory, 'name' | 'parent_id' | 'description' | 'is_active'>>
  ) {
    const { data, error } = await supabase
      .from('product_categories')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ProductCategory;
  },

  async setActive(id: string, isActive: boolean) {
    return this.update(id, { is_active: isActive });
  },
};
