import { supabase } from '@/lib/supabase';

export interface Unit {
  id: string;
  company_id: string;
  name: string;
  short_code?: string;
  symbol?: string;
  allow_decimal: boolean;
  is_default: boolean;
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

  async create(payload: { 
    company_id: string; 
    name: string; 
    short_code?: string;
    symbol?: string; 
    allow_decimal?: boolean;
    sort_order?: number;
  }) {
    // If this is being set as default, unset other defaults first
    if (payload.allow_decimal === undefined) {
      payload.allow_decimal = false; // Default to false
    }

    const { data, error } = await supabase
      .from('units')
      .insert({
        company_id: payload.company_id,
        name: payload.name.trim(),
        short_code: payload.short_code?.trim() || null,
        symbol: payload.symbol?.trim() || payload.short_code?.trim() || null,
        allow_decimal: payload.allow_decimal ?? false,
        is_default: false, // Only Piece can be default (set via migration)
        is_active: true,
        sort_order: payload.sort_order ?? 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data as Unit;
  },

  async update(id: string, updates: Partial<Pick<Unit, 'name' | 'short_code' | 'symbol' | 'allow_decimal' | 'sort_order' | 'is_active'>>) {
    // Prevent updating default unit's critical properties
    const unit = await this.getById(id);
    if (unit.is_default) {
      // Default unit (Piece) cannot be:
      // - Deleted (handled in delete method)
      // - Disabled
      // - Changed to allow decimals
      if (updates.is_active === false) {
        throw new Error('Cannot disable the default unit (Piece)');
      }
      if (updates.allow_decimal === true) {
        throw new Error('Default unit (Piece) cannot allow decimals');
      }
      if (updates.name && updates.name.toLowerCase() !== 'piece') {
        throw new Error('Cannot change the name of the default unit');
      }
    }

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
    // Prevent disabling default unit
    const unit = await this.getById(id);
    if (unit.is_default && !isActive) {
      throw new Error('Cannot disable the default unit (Piece)');
    }
    return this.update(id, { is_active: isActive });
  },

  async delete(id: string) {
    // Prevent deleting default unit
    const unit = await this.getById(id);
    if (unit.is_default) {
      throw new Error('Cannot delete the default unit (Piece). It is required for the system.');
    }
    const { error } = await supabase
      .from('units')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getDefaultUnit(companyId: string): Promise<Unit | null> {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data as Unit;
  },
};
