import { supabase } from '@/lib/supabase';

export interface User {
  id: string;
  company_id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  user_code?: string; // Human-readable code: USR-001, USR-002, etc.
  is_active: boolean;
  can_be_assigned_as_salesman?: boolean;
  permissions?: {
    canCreateSale?: boolean;
    canBeAssignedAsSalesman?: boolean;
    [key: string]: boolean | undefined;
  };
  created_at?: string;
  updated_at?: string;
}

export const userService = {
  // Get all users for a company
  async getAllUsers(companyId: string, options?: {
    includeInactive?: boolean;
    role?: string;
    canBeSalesman?: boolean;
  }) {
    let query = supabase
      .from('users')
      .select('*')
      .eq('company_id', companyId)
      .order('full_name');

    // Filter by active status
    if (!options?.includeInactive) {
      query = query.eq('is_active', true);
    }

    // Filter by role if specified
    if (options?.role) {
      query = query.eq('role', options.role);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Filter by salesman permission if specified
    if (options?.canBeSalesman) {
      return (data || []).filter(user => {
        // Check if user has salesman permission
        const permissions = user.permissions || {};
        return (
          permissions.canBeAssignedAsSalesman === true ||
          user.can_be_assigned_as_salesman === true ||
          user.role === 'salesman' ||
          user.role === 'admin' ||
          permissions.canCreateSale === true
        );
      });
    }

    return data || [];
  },

  // Get single user
  async getUser(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Generate next user code
  async generateUserCode(companyId: string): Promise<string> {
    try {
      // Get max code and increment
      const { data: users } = await supabase
        .from('users')
        .select('user_code')
        .eq('company_id', companyId)
        .not('user_code', 'is', null)
        .order('user_code', { ascending: false })
        .limit(1);

      if (users && users.length > 0 && users[0].user_code) {
        const lastCode = users[0].user_code;
        const match = lastCode.match(/USR-(\d+)/);
        if (match) {
          const nextNum = parseInt(match[1]) + 1;
          return `USR-${String(nextNum).padStart(3, '0')}`;
        }
      }
      
      // Default: start from USR-001
      return 'USR-001';
    } catch (error) {
      console.error('[USER SERVICE] Error generating user code:', error);
      // Fallback
      return 'USR-001';
    }
  },

  // Create user
  async createUser(user: Partial<User>) {
    console.log('[USER SERVICE] Creating user with payload:', JSON.stringify(user, null, 2));
    
    try {
      // Prepare insert payload - ensure permissions is properly formatted for JSONB
      const insertPayload: any = { ...user };
      
      // Remove id from payload - let database generate it via default
      delete insertPayload.id;
      
      // Auto-generate user_code if not provided
      if (!insertPayload.user_code && insertPayload.company_id) {
        insertPayload.user_code = await this.generateUserCode(insertPayload.company_id);
        console.log('[USER SERVICE] Auto-generated user code:', insertPayload.user_code);
      }
      
      // If permissions is an object, ensure it's properly formatted
      if (insertPayload.permissions && typeof insertPayload.permissions === 'object') {
        // Supabase handles JSONB automatically, but we ensure it's a plain object
        insertPayload.permissions = insertPayload.permissions;
      }
      
      const { data, error } = await supabase
        .from('users')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('[USER SERVICE] Error creating user:', error);
        console.error('[USER SERVICE] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('[USER SERVICE] User created successfully:', data);
      return data;
    } catch (error: any) {
      console.error('[USER SERVICE] Exception creating user:', error);
      throw error;
    }
  },

  // Update user
  async updateUser(id: string, updates: Partial<User>) {
    console.log('[USER SERVICE] Updating user:', id, 'with payload:', JSON.stringify(updates, null, 2));
    
    try {
      // Prepare update payload - ensure permissions is properly formatted for JSONB
      const updatePayload: any = { ...updates };
      
      // If permissions is an object, ensure it's properly formatted
      if (updatePayload.permissions && typeof updatePayload.permissions === 'object') {
        // Supabase handles JSONB automatically, but we ensure it's a plain object
        updatePayload.permissions = updatePayload.permissions;
      }
      
      const { data, error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[USER SERVICE] Error updating user:', error);
        console.error('[USER SERVICE] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('[USER SERVICE] User updated successfully:', data);
      return data;
    } catch (error: any) {
      console.error('[USER SERVICE] Exception updating user:', error);
      throw error;
    }
  },

  // Delete user (soft delete by setting is_active to false)
  async deleteUser(id: string) {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get users who can be assigned as salesman
  async getSalesmen(companyId: string) {
    return this.getAllUsers(companyId, {
      includeInactive: false,
      canBeSalesman: true
    });
  },

  /**
   * Get active users eligible for salary (Staff, Salesman, Operator, Admin, Manager).
   * Used in Expenses → Salary: "Pay to (User)" dropdown. Workers (Dyer, Stitcher, etc.) are NOT included.
   */
  async getUsersForSalary(companyId: string): Promise<User[]> {
    const all = await this.getAllUsers(companyId, { includeInactive: false });
    const salaryRoles = ['admin', 'manager', 'staff', 'salesman', 'operator', 'cashier', 'inventory'];
    return (all || []).filter((u) => salaryRoles.includes((u.role || '').toLowerCase()));
  }
};
