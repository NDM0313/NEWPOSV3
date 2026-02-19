import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface BranchRow {
  id: string;
  company_id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  is_active: boolean;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export async function getBranches(companyId: string): Promise<{ data: Branch[]; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: 'App not configured.' };
  }
  const { data, error } = await supabase
    .from('branches')
    .select('id, company_id, name, code, address, city, is_active')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name');

  if (error) return { data: [], error: error.message };
  const list: Branch[] = (data || []).map((row: BranchRow) => ({
    id: row.id,
    name: row.name,
    location: [row.address, row.city].filter(Boolean).join(', ') || row.code || '—',
  }));
  return { data: list, error: null };
}
