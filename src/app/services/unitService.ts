import { supabase } from '@/lib/supabase';

export interface Unit {
  id: string;
  company_id: string;
  name: string;
  symbol?: string;
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export const unitService = {
  async getAll(companyId: string, options?: { includeInactive?: boolean }) {
    let query = supabase
      .from('units')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })
      .order('name');
    if (!options?.includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as Unit[];
  },

  async getById(id: string) {
    const { data, error } = await supabase.from('units').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Unit;
  },

  async create(payload: { company_id: string; name: string; symbol?: string; sort_order?: number }) {
    const { data, error } = await supabase
      .from('units')
      .insert({
        company_id: payload.company_id,
        name: payload.name.trim(),
        symbol: payload.symbol?.trim() || null,
        sort_order: payload.sort_order ?? 0,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data as Unit;
  },

  async update(id: string, updates: Partial<Pick<Unit, 'name' | 'symbol' | 'sort_order' | 'is_active'>>) {
    const { data, error } = await supabase
      .from('units')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Unit;
  },

  async setActive(id: string, isActive: boolean) {
    return this.update(id, { is_active: isActive });
  },
};
