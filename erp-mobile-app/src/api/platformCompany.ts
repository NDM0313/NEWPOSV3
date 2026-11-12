import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { resetLocalDataPlaneForNewCompany } from '../lib/sessionIsolation';

export interface PlatformCompany {
  id: string;
  name: string;
  isActive: boolean;
}

export interface PlatformActiveCompany {
  activeCompanyId: string | null;
  companyName: string | null;
  homeCompanyId: string | null;
}

function rpcErrorMessage(error: { message?: string } | null | undefined, fallback: string): string {
  return error?.message?.trim() || fallback;
}

/** Active companies for developer/super_admin only. */
export async function listPlatformCompanies(): Promise<{ data: PlatformCompany[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App is not configured.' };
  const { data, error } = await supabase.rpc('list_platform_companies');
  if (error) return { data: [], error: rpcErrorMessage(error, 'Could not load companies.') };
  const rows = Array.isArray(data) ? data : [];
  return {
    data: rows.map((r: { id?: string; name?: string; is_active?: boolean }) => ({
      id: String(r.id),
      name: String(r.name ?? 'Company'),
      isActive: r.is_active !== false,
    })),
    error: null,
  };
}

export async function getPlatformActiveCompany(): Promise<{ data: PlatformActiveCompany | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App is not configured.' };
  const { data, error } = await supabase.rpc('get_platform_active_company');
  if (error) return { data: null, error: rpcErrorMessage(error, 'Could not load company session.') };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return {
      data: { activeCompanyId: null, companyName: null, homeCompanyId: null },
      error: null,
    };
  }
  const r = row as {
    active_company_id?: string | null;
    company_name?: string | null;
    home_company_id?: string | null;
  };
  return {
    data: {
      activeCompanyId: r.active_company_id ?? null,
      companyName: r.company_name ?? null,
      homeCompanyId: r.home_company_id ?? null,
    },
    error: null,
  };
}

export async function getEffectiveCompanyId(): Promise<{ data: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App is not configured.' };
  const { data, error } = await supabase.rpc('get_effective_company_id');
  if (error) return { data: null, error: rpcErrorMessage(error, 'Could not resolve company.') };
  return { data: (data as string | null) ?? null, error: null };
}

/**
 * Sets platform active company, clears local caches that must not leak across tenants.
 */
export async function setPlatformActiveCompany(
  companyId: string,
): Promise<{ data: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App is not configured.' };
  if (!companyId?.trim()) return { data: null, error: 'Company is required.' };
  const { data, error } = await supabase.rpc('set_platform_active_company', {
    p_company_id: companyId,
  });
  if (error) return { data: null, error: rpcErrorMessage(error, 'Could not switch company.') };
  await resetLocalDataPlaneForNewCompany();
  return { data: (data as string | null) ?? companyId, error: null };
}

export async function clearPlatformActiveCompany(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App is not configured.' };
  const { error } = await supabase.rpc('clear_platform_active_company');
  if (error) return { error: rpcErrorMessage(error, 'Could not clear company session.') };
  await resetLocalDataPlaneForNewCompany();
  return { error: null };
}
