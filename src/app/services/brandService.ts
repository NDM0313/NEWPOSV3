import { supabase } from '@/lib/supabase';

export interface Brand {
  id: string;
  company_id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const brandService = {
  async getAll(companyId: string, options?: { includeInactive?: boolean }) {
    let query = supabase
      .from('brands')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (!options?.includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as Brand[];
  },

  async getById(id: string) {
    const { data, error } = await supabase.from('brands').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Brand;
  },

  async create(payload: { company_id: string; name: string }) {
    const { data, error } = await supabase
      .from('brands')
      .insert({
        company_id: payload.company_id,
        name: payload.name.trim(),
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data as Brand;
  },

  async update(id: string, updates: Partial<Pick<Brand, 'name' | 'is_active'>>) {
    const { data, error } = await supabase
      .from('brands')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Brand;
  },

  async setActive(id: string, isActive: boolean) {
    return this.update(id, { is_active: isActive });
  },
};
