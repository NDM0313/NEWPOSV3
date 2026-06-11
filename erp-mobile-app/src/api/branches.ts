import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isBrowserOffline, listCacheGet, listCacheKeys, listCacheRemove, listCacheSet } from '../lib/listCache';

export interface GetBranchesOptions {
  skipCache?: boolean;
}

export interface BranchRow {
  id: string;
  company_id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  is_active: boolean;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export async function getBranches(
  companyId: string,
  options?: GetBranchesOptions,
): Promise<{ data: Branch[]; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: 'App not configured.' };
  }
  const cacheKey = listCacheKeys.branches(companyId);
  if (options?.skipCache) {
    await listCacheRemove(cacheKey);
  }
  if (isBrowserOffline()) {
    const cached = await listCacheGet<Branch[]>(cacheKey);
    return {
      data: cached ?? [],
      error: cached?.length ? null : 'Offline: branches not cached. Connect once while logged in.',
    };
  }
  const { data, error } = await supabase
    .from('branches')
    .select('id, company_id, name, code, address, city, is_active')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name');

  if (error) return { data: [], error: error.message };
  const list: Branch[] = (data || []).map((row: BranchRow) => ({
    id: row.id,
    name: row.name,
    location: [row.address, row.city].filter(Boolean).join(', ') || row.code || '—',
  }));
  void listCacheSet(cacheKey, list);
  return { data: list, error: null };
}

/** Branch-level cash/bank account overrides for payment default resolution. */
export async function getBranchPaymentDefaults(
  branchId: string,
): Promise<{ cashId: string | null; bankId: string | null }> {
  if (!isSupabaseConfigured || !branchId?.trim()) {
    return { cashId: null, bankId: null };
  }
  const { data, error } = await supabase
    .from('branches')
    .select('default_cash_account_id, default_bank_account_id')
    .eq('id', branchId)
    .maybeSingle();
  if (error || !data) return { cashId: null, bankId: null };
  const row = data as {
    default_cash_account_id?: string | null;
    default_bank_account_id?: string | null;
  };
  return {
    cashId: row.default_cash_account_id ?? null,
    bankId: row.default_bank_account_id ?? null,
  };
}

/** Branch fiscal year start (YYYY-MM-DD) for date-range presets. */
export async function getBranchFiscalYearStart(branchId: string): Promise<string | null> {
  if (!isSupabaseConfigured || !branchId?.trim()) return null;
  const { data, error } = await supabase
    .from('branches')
    .select('fiscal_year_start')
    .eq('id', branchId)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as { fiscal_year_start?: string | null }).fiscal_year_start;
  return raw ? String(raw).split('T')[0] : null;
}

/** Create a branch (e.g. when company has none, to allow first sale). Requires company_id. */
export async function createBranch(companyId: string, name: string = 'Main', code?: string): Promise<{ data: Branch | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data, error } = await supabase
    .from('branches')
    .insert({
      company_id: companyId,
      name: name.trim() || 'Main',
      code: code?.trim() || 'BR-001',
      is_active: true,
    })
    .select('id, name, code, address, city')
    .single();

  if (error) return { data: null, error: error.message };
  const row = data as BranchRow;
  return {
    data: {
      id: row.id,
      name: row.name,
      location: [row.address, row.city].filter(Boolean).join(', ') || row.code || '—',
    },
    error: null,
  };
}
