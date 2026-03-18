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
  /** Business type template (retail, wholesale, manufacturing, rental, mixed) */
  businessType?: string;
  /** Module ids to enable (sales, purchases, pos, studio, etc.); applied to modules_config */
  modules?: string[];
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
      // Step 1: Create auth user (or use existing if email already registered)
      const { data: signUpData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.ownerName },
          emailRedirectTo: undefined,
        },
      });

      let user = signUpData?.user;

      // If signUp fails with 422 / "already registered", try sign in and use existing user to add this business
      const isAlreadyRegistered =
        authError?.message?.toLowerCase().includes('already registered') ||
        authError?.message?.toLowerCase().includes('already exists') ||
        authError?.message?.toLowerCase().includes('user already exists') ||
        (authError as any)?.status === 422;

      if (authError && isAlreadyRegistered) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (signInError) {
          return {
            success: false,
            error: 'This email is already registered. Sign in with your password above, or use a different email to create a new business.',
          };
        }
        user = signInData?.user ?? null;
      } else if (authError) {
        return { success: false, error: authError.message };
      }

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
          p_business_type: data.businessType || null,
          p_modules: data.modules && data.modules.length > 0 ? data.modules : null,
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

  /**
   * Link current auth user to existing business by email (for "Create your business" fix).
   * Call when user is signed in but has no companyId — finds company by auth user email and creates/updates public.users row.
   */
  async linkAuthUserToBusiness(): Promise<{ success: boolean; error?: string; email_looked_up?: string }> {
    try {
      const { data, error } = await supabase.rpc('link_auth_user_to_business');
      if (error) return { success: false, error: error.message };
      const result = data as { success?: boolean; error?: string; email_looked_up?: string } | null;
      if (!result || result.success !== true) {
        let msg = (result as any)?.error || 'Could not link account.';
        if ((result as any)?.email_looked_up) {
          msg += ` (Logged in as: ${(result as any).email_looked_up})`;
        }
        return { success: false, error: msg, email_looked_up: (result as any)?.email_looked_up };
      }
      return { success: true };
    } catch (err: any) {
      const msg = err?.message ?? '';
      const isSecurity = err?.name === 'SecurityError' || /request was denied|access is denied/i.test(msg);
      return {
        success: false,
        error: isSecurity
          ? 'Network or security restriction. Please check your connection and try again, or use Retry above.'
          : msg || 'Unknown error',
      };
    }
  },
};
