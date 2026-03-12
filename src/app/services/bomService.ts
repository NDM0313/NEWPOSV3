/**
 * Manufacturing: Bill of Materials. Product → materials with quantity.
 */
import { supabase } from '@/lib/supabase';

export interface BomRow {
  id: string;
  company_id: string;
  product_id: string;
  material_id: string;
  quantity_required: number;
  unit_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BomWithNames extends BomRow {
  product_name?: string | null;
  material_name?: string | null;
  unit_name?: string | null;
}

export const bomService = {
  async listByCompany(companyId: string): Promise<BomRow[]> {
    const { data, error } = await supabase
      .from('bill_of_materials')
      .select('*')
      .eq('company_id', companyId)
      .order('product_id')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as BomRow[];
  },

  async listByProduct(productId: string): Promise<BomRow[]> {
    const { data, error } = await supabase
      .from('bill_of_materials')
      .select('*')
      .eq('product_id', productId)
      .order('created_at');
    if (error) throw error;
    return (data || []) as BomRow[];
  },

  async getById(id: string): Promise<BomRow | null> {
    const { data, error } = await supabase
      .from('bill_of_materials')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as BomRow | null;
  },

  async create(payload: {
    company_id: string;
    product_id: string;
    material_id: string;
    quantity_required: number;
    unit_id?: string | null;
  }): Promise<BomRow> {
    const { data, error } = await supabase
      .from('bill_of_materials')
      .insert({
        company_id: payload.company_id,
        product_id: payload.product_id,
        material_id: payload.material_id,
        quantity_required: payload.quantity_required ?? 1,
        unit_id: payload.unit_id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as BomRow;
  },

  async update(
    id: string,
    updates: { quantity_required?: number; unit_id?: string | null }
  ): Promise<BomRow> {
    const { data, error } = await supabase
      .from('bill_of_materials')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as BomRow;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('bill_of_materials').delete().eq('id', id);
    if (error) throw error;
  },
};
