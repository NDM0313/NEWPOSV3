import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface Brand {
  id: string;
  name: string;
}

export async function getBrands(companyId: string): Promise<{ data: Brand[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('brands')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name');
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })),
    error: null,
  };
}

/** Create brand */
export async function createBrand(
  companyId: string,
  name: string
): Promise<{ data: Brand | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data, error } = await supabase
    .from('brands')
    .insert({
      company_id: companyId,
      name: name.trim(),
      is_active: true,
    })
    .select('id, name')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as Brand, error: null };
}
