import { supabase } from '@/lib/supabase';

export interface Contact {
  id?: string;
  company_id: string;
  branch_id?: string;
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
  is_system_generated?: boolean;
  system_type?: string;
  is_default?: boolean;
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

    if (type) {
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
      'branch_id', 'current_balance', 'is_default', 'is_system_generated', 'system_type'
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
      'opening_balance', 'credit_limit', 'payment_terms', 'notes', 'is_active', 'created_by', 'branch_id', 'is_default'
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
  // PROTECTION: Cannot change name or type for system-generated contacts
  async updateContact(id: string, updates: Partial<Contact>) {
    // Check if contact is system-generated
    const { data: contact, error: fetchError } = await supabase
      .from('contacts')
      .select('is_system_generated, system_type')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Block name and type changes for default / system-generated Walk-in Customer
    if (contact?.is_default === true || (contact?.is_system_generated && contact?.system_type === 'walking_customer')) {
      if (updates.name !== undefined && updates.name !== 'Walking Customer') {
        throw new Error('Cannot rename default Walking Customer. This is a system-generated contact.');
      }
      if (updates.type !== undefined && updates.type !== 'customer') {
        throw new Error('Cannot change type of default Walking Customer. This is a system-generated contact.');
      }
    }

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
  // PROTECTION: Cannot delete system-generated contacts
  async deleteContact(id: string) {
    // Check if contact is default/system-generated
    const { data: contact, error: fetchError } = await supabase
      .from('contacts')
      .select('is_default, is_system_generated, system_type')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Block deletion of default or system-generated Walk-in Customer
    if (contact?.is_default || (contact?.is_system_generated && contact?.system_type === 'walking_customer')) {
      throw new Error('Default Walk-in Customer cannot be deleted. This is a system-generated contact.');
    }

    const { error } = await supabase
      .from('contacts')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  // ============================================================================
  // SYSTEM-GENERATED CONTACTS
  // ============================================================================

  /**
   * Create default "Walking Customer" for a branch
   * This is auto-created when a new branch is created
   */
  async createDefaultWalkingCustomer(companyId: string, branchId: string): Promise<Contact> {
    console.log('[CONTACT SERVICE] Creating default walking customer:', { companyId, branchId });

    // Check if walking customer already exists for this branch
    const { data: existing } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .eq('branch_id', branchId)
      .eq('system_type', 'walking_customer')
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      console.log('[CONTACT SERVICE] Walking customer already exists:', existing.id);
      return existing as Contact;
    }

    // Create walking customer (display name matches UI "Walk-in Customer")
    const walkingCustomer: Partial<Contact> = {
      company_id: companyId,
      branch_id: branchId,
      type: 'customer',
      name: 'Walk-in Customer',
      is_active: true,
      is_system_generated: true,
      system_type: 'walking_customer',
      is_default: true,
      opening_balance: 0,
      credit_limit: 0,
      payment_terms: 0,
    };

    try {
      const created = await this.createContact(walkingCustomer);
      console.log('[CONTACT SERVICE] ✅ Default walking customer created:', created.id);
      return created as Contact;
    } catch (error: any) {
      console.error('[CONTACT SERVICE] ❌ Failed to create walking customer:', error);
      throw new Error(`Failed to create default walking customer: ${error.message}`);
    }
  },

  /**
   * Get the mandatory default (Walk-in) customer for the company.
   * Exactly one per company; used for new sale auto-selection.
   */
  async getDefaultCustomer(companyId: string): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_default', true)
      .in('type', ['customer', 'both'])
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[CONTACT SERVICE] Error fetching default customer:', error);
      return null;
    }
    return (data as Contact) || null;
  },

  /**
   * Get walking customer for a branch (legacy; prefer getDefaultCustomer for new sales)
   * Used in SaleForm to auto-select customer
   */
  async getWalkingCustomer(companyId: string, branchId?: string): Promise<Contact | null> {
    let query = supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .eq('system_type', 'walking_customer')
      .eq('is_active', true)
      .eq('is_system_generated', true);

    // If branchId provided, filter by branch
    if (branchId) {
      query = query.eq('branch_id', branchId);
    } else {
      // If no branchId, get first available (for backward compatibility)
      query = query.is('branch_id', null);
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (acceptable)
      console.error('[CONTACT SERVICE] Error fetching walking customer:', error);
      return null;
    }

    return (data as Contact) || null;
  },

  /**
   * Ensure default Walk-in Customer exists for the company (e.g. when business is created or first opening Contacts).
   * Uses current branch or first branch if branchId is 'all' / null.
   */
  async ensureDefaultWalkingCustomerForCompany(companyId: string, branchId?: string | null): Promise<void> {
    let targetBranchId: string | null = null;
    if (branchId && branchId !== 'all') {
      targetBranchId = branchId;
    } else {
      const { data: branches } = await supabase
        .from('branches')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name')
        .limit(1);
      if (branches?.[0]?.id) targetBranchId = branches[0].id;
    }
    if (!targetBranchId) return;
    try {
      await this.createDefaultWalkingCustomer(companyId, targetBranchId);
    } catch (_) {
      // Already exists or other error – ignore so load can continue
    }
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
