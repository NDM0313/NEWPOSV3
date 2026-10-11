import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ProductCategory {
  id: string;
  name: string;
}

/** Top-level categories (parent_id IS NULL) */
export async function getCategories(companyId: string): Promise<{ data: ProductCategory[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('company_id', companyId)
    .is('parent_id', null)
    .eq('is_active', true)
    .order('name');
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })),
    error: null,
  };
}

/** Create category */
export async function createCategory(
  companyId: string,
  name: string
): Promise<{ data: ProductCategory | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data, error } = await supabase
    .from('product_categories')
    .insert({
      company_id: companyId,
      name: name.trim(),
      parent_id: null,
      is_active: true,
    })
    .select('id, name')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as ProductCategory, error: null };
}
