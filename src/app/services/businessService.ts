import { supabase } from '@/lib/supabase';
import {
  ensureAuthenticatedSession,
  signUpForNewBusiness,
} from '@/app/services/authSignupService';
import {
  ALREADY_HAS_BUSINESS_MESSAGE,
  isReservedSystemEmail,
  RESERVED_SYSTEM_EMAIL_MESSAGE,
} from '@/app/utils/authErrorMessages';

export interface CreateBusinessRequest {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  currency?: string;
  fiscalYearStart?: string;
  fiscalYearEnd?: string;
  branchCity?: string;
  branchState?: string;
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
  /** Financial/inventory bootstrap settings */
  accountingMethod?: 'Accrual' | 'Cash';
  taxMode?: 'Inclusive' | 'Exclusive';
  defaultTaxRate?: number;
  costingMethod?: 'FIFO' | 'Weighted Average';
  allowNegativeStock?: boolean;
  defaultUnit?: string;
  baseUnits?: string[];
}

export interface CreateBusinessResponse {
  success: boolean;
  userId?: string;
  companyId?: string;
  branchId?: string;
  error?: string;
  /** Signup succeeded but email OTP required before create_business_transaction. */
  needsEmailVerification?: boolean;
}

async function assertUserHasNoLinkedBusiness(userId: string): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from('users')
    .select('company_id')
    .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
    .maybeSingle();

  if (error) {
    return error.message || 'Could not verify account status.';
  }
  if (profile?.company_id) {
    return ALREADY_HAS_BUSINESS_MESSAGE;
  }
  return null;
}

async function runCreateBusinessTransaction(
  userId: string,
  data: CreateBusinessRequest
): Promise<CreateBusinessResponse> {
  const linkedBusinessError = await assertUserHasNoLinkedBusiness(userId);
  if (linkedBusinessError) {
    return { success: false, error: linkedBusinessError };
  }

  const { data: transactionResult, error: transactionError } = await supabase.rpc(
    'create_business_transaction',
    {
      p_business_name: data.businessName,
      p_owner_name: data.ownerName,
      p_email: data.email.trim(),
      p_password: data.password,
      p_user_id: userId,
      p_currency: data.currency || 'PKR',
      p_fiscal_year_start: data.fiscalYearStart || null,
      p_branch_name: data.branchName || 'Main Branch',
      p_branch_code: data.branchCode || 'HQ',
      p_branch_city: data.branchCity || null,
      p_branch_state: data.branchState || null,
      p_fiscal_year_end: data.fiscalYearEnd || null,
      p_phone: data.phone || null,
      p_address: data.address || null,
      p_country: data.country || null,
      p_timezone: data.timezone || null,
      p_business_type: data.businessType || null,
      p_modules: data.modules && data.modules.length > 0 ? data.modules : null,
      p_accounting_method: data.accountingMethod || 'Accrual',
      p_tax_mode: data.taxMode || 'Inclusive',
      p_default_tax_rate: Number.isFinite(Number(data.defaultTaxRate)) ? Number(data.defaultTaxRate) : 0,
      p_costing_method: data.costingMethod || 'FIFO',
      p_allow_negative_stock: Boolean(data.allowNegativeStock),
      p_default_unit: data.defaultUnit || 'pcs',
      p_base_units: data.baseUnits && data.baseUnits.length > 0 ? data.baseUnits : ['pcs'],
    }
  );

  if (transactionError) {
    return {
      success: false,
      error: transactionError.message || 'Failed to create business in database',
    };
  }

  const result = transactionResult as {
    success?: boolean;
    userId?: string;
    companyId?: string;
    branchId?: string;
    error?: string;
  } | null;
  if (!result || result.success !== true) {
    return {
      success: false,
      error: result?.error || 'Failed to create business in database',
    };
  }

  return {
    success: true,
    userId: result.userId,
    companyId: result.companyId,
    branchId: result.branchId,
  };
}

/**
 * Create a new business: sign up the user with Supabase Auth, then run the DB transaction.
 * Uses the anon client only (no service role in the browser) to avoid 401 and Multiple GoTrueClient.
 */
export const businessService = {
  async createBusiness(data: CreateBusinessRequest): Promise<CreateBusinessResponse> {
    try {
      const email = data.email.trim();
      if (isReservedSystemEmail(email)) {
        return { success: false, error: RESERVED_SYSTEM_EMAIL_MESSAGE };
      }

      const signup = await signUpForNewBusiness({
        email,
        password: data.password,
        ownerName: data.ownerName.trim(),
        phone: data.phone?.trim(),
        businessName: data.businessName.trim(),
        businessType: data.businessType,
      });

      if (signup.error) {
        return { success: false, error: signup.error };
      }

      if (signup.needsEmailVerification) {
        return { success: false, needsEmailVerification: true };
      }

      if (!signup.userId) {
        return { success: false, error: 'Failed to create user' };
      }

      if (!signup.hasSession) {
        const ensured = await ensureAuthenticatedSession();
        if (!ensured.ok) {
          return { success: false, error: ensured.message || 'Auth session missing after signup.' };
        }
      }

      return runCreateBusinessTransaction(signup.userId, { ...data, email });
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },

  /** Run create_business_transaction after email OTP (session already established). */
  async completeBusinessCreationAfterAuth(data: CreateBusinessRequest): Promise<CreateBusinessResponse> {
    try {
      const email = data.email.trim();
      if (isReservedSystemEmail(email)) {
        return { success: false, error: RESERVED_SYSTEM_EMAIL_MESSAGE };
      }

      const ensured = await ensureAuthenticatedSession();
      if (!ensured.ok) {
        return { success: false, error: ensured.message || 'Not signed in. Verify your email first.' };
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) {
        return { success: false, error: 'Not signed in. Verify your email and try again.' };
      }

      return runCreateBusinessTransaction(authData.user.id, { ...data, email });
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },

  /**
   * Link current auth user to existing business by email (for "Create your business" fix).
   * Call when user is signed in but has no companyId — finds company by auth user email and creates/updates public.users row.
   */
  /**
   * Retry business creation for an already-signed-in user whose initial create_business_transaction failed.
   * Uses the current auth session — no signUp/signIn needed.
   */
  async retryCreateBusiness(data: {
    businessName: string;
    ownerName?: string;
    currency?: string;
    fiscalYearStart?: string;
    fiscalYearEnd?: string;
    branchCity?: string;
    branchState?: string;
    branchName?: string;
    branchCode?: string;
    phone?: string;
    address?: string;
    country?: string;
    timezone?: string;
    businessType?: string;
    modules?: string[];
    accountingMethod?: 'Accrual' | 'Cash';
    taxMode?: 'Inclusive' | 'Exclusive';
    defaultTaxRate?: number;
    costingMethod?: 'FIFO' | 'Weighted Average';
    allowNegativeStock?: boolean;
    defaultUnit?: string;
    baseUnits?: string[];
  }): Promise<CreateBusinessResponse> {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) {
        return { success: false, error: 'Not signed in. Please sign out and create a business from the login page.' };
      }
      const user = authData.user;
      const email = user.email || '';
      const ownerName = data.ownerName || user.user_metadata?.full_name || email;

      const { data: txResult, error: txError } = await supabase.rpc('create_business_transaction', {
        p_business_name: data.businessName,
        p_owner_name: ownerName,
        p_email: email,
        p_password: '',
        p_user_id: user.id,
        p_currency: data.currency || 'PKR',
        p_fiscal_year_start: data.fiscalYearStart || null,
        p_branch_name: data.branchName || 'Main Branch',
        p_branch_code: data.branchCode || 'HQ',
        p_branch_city: data.branchCity || null,
        p_branch_state: data.branchState || null,
        p_fiscal_year_end: data.fiscalYearEnd || null,
        p_phone: data.phone || null,
        p_address: data.address || null,
        p_country: data.country || null,
        p_timezone: data.timezone || null,
        p_business_type: data.businessType || null,
        p_modules: data.modules && data.modules.length > 0 ? data.modules : null,
        p_accounting_method: data.accountingMethod || 'Accrual',
        p_tax_mode: data.taxMode || 'Inclusive',
        p_default_tax_rate: Number.isFinite(Number(data.defaultTaxRate)) ? Number(data.defaultTaxRate) : 0,
        p_costing_method: data.costingMethod || 'FIFO',
        p_allow_negative_stock: Boolean(data.allowNegativeStock),
        p_default_unit: data.defaultUnit || 'pcs',
        p_base_units: data.baseUnits && data.baseUnits.length > 0 ? data.baseUnits : ['pcs'],
      });

      if (txError) {
        return { success: false, error: txError.message || 'Failed to create business' };
      }

      const result = txResult as { success?: boolean; userId?: string; companyId?: string; branchId?: string; error?: string } | null;
      if (!result || result.success !== true) {
        return { success: false, error: (result as any)?.error || 'Failed to create business' };
      }

      return { success: true, userId: result.userId, companyId: result.companyId, branchId: result.branchId };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unknown error' };
    }
  },

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
