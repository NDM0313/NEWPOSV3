import { supabase } from '@/lib/supabase';

export interface Branch {
  id: string;
  company_id: string;
  name: string;
  code?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const branchService = {
  // Get all branches for a company
  async getAllBranches(companyId: string) {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data;
  },

  // Get single branch
  async getBranch(id: string) {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create branch
  async createBranch(branch: Partial<Branch>) {
    const { data, error } = await supabase
      .from('branches')
      .insert(branch)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update branch
  async updateBranch(id: string, updates: Partial<Branch>) {
    const { data, error } = await supabase
      .from('branches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete branch (soft delete)
  async deleteBranch(id: string) {
    const { error } = await supabase
      .from('branches')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },
};
