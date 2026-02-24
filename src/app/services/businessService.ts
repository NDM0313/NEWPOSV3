import { supabase } from '@/lib/supabase';

export interface CreateBusinessRequest {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  currency?: string;
  fiscalYearStart?: string;
  branchName?: string;
  branchCode?: string;
  /** Company & branch address - saved to DB, shown in Settings */
  phone?: string;
  address?: string;
  country?: string;
  timezone?: string;
}

export interface CreateBusinessResponse {
  success: boolean;
  userId?: string;
  companyId?: string;
  branchId?: string;
  error?: string;
}

/**
 * Create a new business: sign up the user with Supabase Auth, then run the DB transaction.
 * Uses the anon client only (no service role in the browser) to avoid 401 and Multiple GoTrueClient.
 */
export const businessService = {
  async createBusiness(data: CreateBusinessRequest): Promise<CreateBusinessResponse> {
    try {
      // Step 1: Create auth user with the main Supabase client (no admin API)
      const { data: signUpData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.ownerName },
          emailRedirectTo: undefined,
        },
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      const user = signUpData?.user;
      if (!user?.id) {
        return { success: false, error: 'Failed to create user' };
      }

      // Step 2: Create company, branch, and public.users row via RPC (allowed for authenticated after migration 22)
      const { data: transactionResult, error: transactionError } = await supabase.rpc(
        'create_business_transaction',
        {
          p_business_name: data.businessName,
          p_owner_name: data.ownerName,
          p_email: data.email,
          p_password: data.password,
          p_user_id: user.id,
          p_currency: data.currency || 'PKR',
          p_fiscal_year_start: data.fiscalYearStart || null,
          p_branch_name: data.branchName || 'Main Branch',
          p_branch_code: data.branchCode || 'HQ',
          p_phone: data.phone || null,
          p_address: data.address || null,
          p_country: data.country || null,
          p_timezone: data.timezone || null,
        }
      );

      if (transactionError) {
        return {
          success: false,
          error: transactionError.message || 'Failed to create business in database',
        };
      }

      const result = transactionResult as { success?: boolean; userId?: string; companyId?: string; branchId?: string; error?: string } | null;
      if (!result || result.success !== true) {
        return {
          success: false,
          error: (result as any)?.error || 'Failed to create business in database',
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
        error: error?.message || 'Unknown error occurred',
      };
    }
  },
};
