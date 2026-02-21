import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface Unit {
  id: string;
  name: string;
  symbol?: string;
}

export async function getUnits(companyId: string): Promise<{ data: Unit[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('units')
    .select('id, name, symbol')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name');
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: { id: string; name: string; symbol?: string }) => ({
      id: r.id,
      name: r.name,
      symbol: r.symbol,
    })),
    error: null,
  };
}

/** Create unit */
export async function createUnit(
  companyId: string,
  name: string,
  shortCode?: string
): Promise<{ data: Unit | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data, error } = await supabase
    .from('units')
    .insert({
      company_id: companyId,
      name: name.trim(),
      short_code: shortCode?.trim() || null,
      symbol: shortCode?.trim() || name.trim().slice(0, 3).toUpperCase(),
      allow_decimal: false,
      is_default: false,
      is_active: true,
      sort_order: 0,
    })
    .select('id, name, symbol')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as Unit, error: null };
}
