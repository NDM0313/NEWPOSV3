import { createClient } from '@supabase/supabase-js';

// Service role client (bypasses RLS)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials for business creation');
}

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export interface CreateBusinessRequest {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
}

export interface CreateBusinessResponse {
  success: boolean;
  userId?: string;
  companyId?: string;
  branchId?: string;
  error?: string;
}

export const businessService = {
  /**
   * Create a new business with company, branch, and admin user
   * This uses service_role key to bypass RLS
   */
  async createBusiness(data: CreateBusinessRequest): Promise<CreateBusinessResponse> {
    if (!supabaseAdmin) {
      return {
        success: false,
        error: 'Service role key not configured',
      };
    }

    try {
      // Step 1: Create auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: data.ownerName,
        },
      });

      if (authError || !authUser.user) {
        return {
          success: false,
          error: authError?.message || 'Failed to create user',
        };
      }

      const userId = authUser.user.id;

      // Step 2: Use database transaction function to create company, branch, and user
      // This ensures all-or-nothing: if any step fails, everything rolls back
      const { data: transactionResult, error: transactionError } = await supabaseAdmin
        .rpc('create_business_transaction', {
          p_business_name: data.businessName,
          p_owner_name: data.ownerName,
          p_email: data.email,
          p_user_id: userId,
        });

      if (transactionError) {
        // Rollback: Delete auth user
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return {
          success: false,
          error: transactionError.message || 'Failed to create business in database',
        };
      }

      // Parse transaction result
      const result = transactionResult as any;
      
      if (!result || !result.success) {
        // Rollback: Delete auth user
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return {
          success: false,
          error: result?.error || 'Failed to create business in database',
        };
      }

      // Verify data was actually created in database
      const { data: verifyCompany, error: verifyError } = await supabaseAdmin
        .from('companies')
        .select('id, name, email')
        .eq('id', result.companyId)
        .single();

      if (verifyError || !verifyCompany) {
        // Data not found - transaction may have failed silently
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return {
          success: false,
          error: 'Business created but verification failed. Please try again.',
        };
      }

      return {
        success: true,
        userId: result.userId,
        companyId: result.companyId,
        branchId: result.branchId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  },
};
