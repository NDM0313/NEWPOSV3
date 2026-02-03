import { supabase } from '@/lib/supabase';

export interface Contact {
  id?: string;
  company_id: string;
  type: 'customer' | 'supplier' | 'both';
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  cnic?: string;
  ntn?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  opening_balance?: number;
  current_balance?: number;
  credit_limit?: number;
  payment_terms?: number;
  tax_number?: string;
  notes?: string;
  is_active?: boolean;
  created_by?: string;
}

export const contactService = {
  // Get all contacts
  async getAllContacts(companyId: string, type?: 'customer' | 'supplier' | 'worker' | 'both') {
    let query = supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    // Note: is_active column may not exist - removed filter to avoid errors
    // If needed, filter in application code after fetching

    if (type && type !== 'both') {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Get single contact
  async getContact(id: string) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create contact
  async createContact(contact: Partial<Contact> & Record<string, unknown>) {
    // Strip undefined so Supabase doesn't get invalid/missing column values
    const clean = (obj: Record<string, unknown>): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined && v !== null) out[k] = v;
      }
      return out;
    };
    const payload = clean(contact as Record<string, unknown>);
    // Ensure required fields exist
    if (!payload.company_id || !payload.type || !payload.name) {
      throw new Error('company_id, type, and name are required');
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert(payload)
      .select()
      .single();

    if (!error) return data;

    const isBadRequest = error.code === 'PGRST204' || error.code === 'PGRST116' || error.status === 400;
    if (!isBadRequest) throw error;

    const errorMessage = (error.message || '').toLowerCase();
    // Columns that may not exist until migration is run
    const optionalColumns = [
      'country', 'contact_person', 'group_id', 'business_name',
      'payable_account_id', 'supplier_opening_balance', 'worker_role',
      'branch_id', 'current_balance'
    ];
    const toStrip = optionalColumns.filter(
      (col) => errorMessage.includes(col.replace(/_/g, ' ')) || errorMessage.includes("'" + col + "'")
    );
    if (toStrip.length > 0) {
      const reduced = { ...payload };
      toStrip.forEach((col) => delete reduced[col]);
      const { data: retryData, error: retryError } = await supabase
        .from('contacts')
        .insert(reduced)
        .select()
        .single();
      if (!retryError) return retryData;
    }

    // Retry with only base schema columns (no optional/extended columns)
    const baseColumns = [
      'company_id', 'type', 'name', 'email', 'phone', 'mobile', 'cnic', 'ntn',
      'address', 'city', 'state', 'country', 'postal_code', 'tax_number',
      'opening_balance', 'credit_limit', 'payment_terms', 'notes', 'is_active', 'created_by', 'branch_id'
    ];
    const minimal: Record<string, unknown> = {};
    baseColumns.forEach((k) => {
      if (payload[k] !== undefined && payload[k] !== null) minimal[k] = payload[k];
    });
    const { data: minimalData, error: minimalError } = await supabase
      .from('contacts')
      .insert(minimal)
      .select()
      .single();
    if (!minimalError) return minimalData;

    console.error('[CONTACT SERVICE] createContact failed:', error.message, minimalError?.message);
    throw error;
  },

  // Update contact
  async updateContact(id: string, updates: Partial<Contact>) {
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete contact (soft delete)
  async deleteContact(id: string) {
    const { error } = await supabase
      .from('contacts')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  // Search contacts
  async searchContacts(companyId: string, query: string) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(20);

    // Note: is_active column may not exist - removed filter to avoid errors

    if (error) throw error;
    return data;
  },
};
