import { supabase } from '@/lib/supabase';

export interface ContactGroup {
  id?: string;
  company_id: string;
  name: string;
  type: 'customer' | 'supplier' | 'worker';
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const contactGroupService = {
  // Get all groups for a company, optionally filtered by type
  async getAllGroups(companyId: string, type?: 'customer' | 'supplier' | 'worker') {
    let query = supabase
      .from('contact_groups')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) {
      // If table doesn't exist yet, return empty array (graceful degradation)
      // Check for various error codes that indicate table doesn't exist
      if (
        error.code === 'PGRST116' || 
        error.message?.includes('does not exist') ||
        error.status === 404 ||
        (error as any).statusCode === 404 ||
        error.message?.includes('relation') ||
        error.message?.includes('contact_groups')
      ) {
        // Table doesn't exist yet - this is expected before running migration
        // Silently return empty array, no need to log warning
        console.log('[CONTACT GROUP SERVICE] contact_groups table does not exist yet, returning empty array');
        return [];
      }
      // Log other errors but don't crash
      console.warn('[CONTACT GROUP SERVICE] Error loading groups:', error);
      return [];
    }
    return data || [];
  },

  // Get single group
  async getGroup(id: string) {
    const { data, error } = await supabase
      .from('contact_groups')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create group
  async createGroup(group: Partial<ContactGroup>) {
    const { data, error } = await supabase
      .from('contact_groups')
      .insert(group)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update group
  async updateGroup(id: string, updates: Partial<ContactGroup>) {
    const { data, error } = await supabase
      .from('contact_groups')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete group (soft delete)
  async deleteGroup(id: string) {
    const { error } = await supabase
      .from('contact_groups')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },
};
