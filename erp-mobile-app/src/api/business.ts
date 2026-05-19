import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface MobileCreateBusinessPayload {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  phone?: string | null;
  businessType?: string | null;
  modules?: string[] | null;
}

export interface MobileCreateBusinessResult {
  success: boolean;
  companyId?: string;
  branchId?: string;
  error?: string;
}

/**
 * Run create_business_transaction for the **current** auth session (after signUp / verifyOtp).
 */
export async function runCreateBusinessTransaction(
  payload: MobileCreateBusinessPayload
): Promise<MobileCreateBusinessResult> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase is not configured.' };
  }
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token || !session.user?.id) {
    return { success: false, error: 'Not signed in. Confirm your email code first.' };
  }
  const user = session.user;

  const { data: txResult, error: txError } = await supabase.rpc('create_business_transaction', {
    p_business_name: payload.businessName,
    p_owner_name: payload.ownerName,
    p_email: payload.email,
    p_password: payload.password,
    p_user_id: user.id,
    p_currency: 'PKR',
    p_fiscal_year_start: null,
    p_branch_name: 'Main Branch',
    p_branch_code: 'HQ',
    p_phone: payload.phone || null,
    p_address: null,
    p_country: null,
    p_timezone: 'Asia/Karachi',
    p_business_type: payload.businessType || null,
    p_modules: payload.modules && payload.modules.length > 0 ? payload.modules : null,
    p_accounting_method: 'Accrual',
    p_tax_mode: 'Inclusive',
    p_default_tax_rate: 0,
    p_costing_method: 'FIFO',
    p_allow_negative_stock: false,
    p_default_unit: 'pcs',
    p_base_units: ['pcs'],
  });

  if (txError) {
    return { success: false, error: txError.message || 'Failed to create business' };
  }

  const result = txResult as {
    success?: boolean;
    companyId?: string;
    branchId?: string;
    error?: string;
  } | null;

  if (!result || result.success !== true) {
    return { success: false, error: result?.error || 'Failed to create business' };
  }

  return {
    success: true,
    companyId: result.companyId,
    branchId: result.branchId,
  };
}
