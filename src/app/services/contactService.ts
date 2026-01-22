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
  async getAllContacts(companyId: string, type?: 'customer' | 'supplier' | 'both') {
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
  async createContact(contact: Partial<Contact>) {
    const { data, error } = await supabase
      .from('contacts')
      .insert(contact)
      .select()
      .single();

    // If error is about missing columns (PGRST204), retry without them
    if (error && (error.code === 'PGRST204' || error.code === 'PGRST116' || error.status === 400)) {
      const errorMessage = error.message || '';
      const missingColumns: string[] = [];
      
      // Check which columns are missing
      if (errorMessage.includes('country') || errorMessage.includes("'country'")) {
        missingColumns.push('country');
      }
      if (errorMessage.includes('contact_person') || errorMessage.includes("'contact_person'")) {
        missingColumns.push('contact_person');
      }
      if (errorMessage.includes('group_id') || errorMessage.includes("'group_id'")) {
        missingColumns.push('group_id');
      }
      
      if (missingColumns.length > 0) {
        // Silently retry without missing columns (expected behavior when migration not run)
        // Remove missing columns from contact data
        const contactWithoutMissing = { ...contact };
        missingColumns.forEach(col => {
          delete (contactWithoutMissing as any)[col];
        });
        
        const { data: retryData, error: retryError } = await supabase
          .from('contacts')
          .insert(contactWithoutMissing)
          .select()
          .single();

        if (retryError && retryError.code === 'PGRST204') {
          // If still failing, try removing all optional fields that might not exist
          const { 
            country, 
            contact_person, 
            group_id, 
            business_name,
            payable_account_id,
            supplier_opening_balance,
            worker_role,
            ...contactMinimal 
          } = contactWithoutMissing;
          
          const { data: minimalData, error: minimalError } = await supabase
            .from('contacts')
            .insert(contactMinimal)
            .select()
            .single();
          
          if (minimalError) throw minimalError;
          return minimalData;
        }
        
        if (retryError) throw retryError;
        return retryData;
      }
    }

    if (error) throw error;
    return data;
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
