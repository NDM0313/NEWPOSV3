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

      // Step 2: Create company
      const { data: company, error: companyError } = await supabaseAdmin
        .from('companies')
        .insert({
          name: data.businessName,
          email: data.email,
          is_active: true,
        })
        .select()
        .single();

      if (companyError || !company) {
        // Rollback: Delete auth user
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return {
          success: false,
          error: companyError?.message || 'Failed to create company',
        };
      }

      const companyId = company.id;

      // Step 3: Create default branch
      const { data: branch, error: branchError } = await supabaseAdmin
        .from('branches')
        .insert({
          company_id: companyId,
          name: 'Main Branch',
          code: 'HQ',
          is_active: true,
        })
        .select()
        .single();

      if (branchError || !branch) {
        // Rollback: Delete company and auth user
        await supabaseAdmin.from('companies').delete().eq('id', companyId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return {
          success: false,
          error: branchError?.message || 'Failed to create branch',
        };
      }

      const branchId = branch.id;

      // Step 4: Create user entry in public.users
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          company_id: companyId,
          email: data.email,
          full_name: data.ownerName,
          role: 'admin',
          is_active: true,
        });

      if (userError) {
        // Rollback: Delete branch, company, and auth user
        await supabaseAdmin.from('branches').delete().eq('id', branchId);
        await supabaseAdmin.from('companies').delete().eq('id', companyId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return {
          success: false,
          error: userError.message || 'Failed to create user entry',
        };
      }

      // Step 5: Link user to branch
      const { error: userBranchError } = await supabaseAdmin
        .from('user_branches')
        .insert({
          user_id: userId,
          branch_id: branchId,
          is_default: true,
        });

      if (userBranchError) {
        // Non-critical - log but don't fail
        console.warn('Failed to link user to branch:', userBranchError);
      }

      return {
        success: true,
        userId,
        companyId,
        branchId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  },
};
