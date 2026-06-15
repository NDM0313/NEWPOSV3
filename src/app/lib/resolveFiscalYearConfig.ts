/**
 * Resolve fiscal year start/end from branch → accounting settings → company row.
 */

import { supabase } from '@/lib/supabase';
import { branchService } from '@/app/services/branchService';
import { settingsService } from '@/app/services/settingsService';
import { normalizeFiscalYearConfig, type FiscalYearConfig } from '@/app/utils/financialYear';

export async function resolveFiscalYearConfig(
  companyId: string,
  branchId?: string | null,
): Promise<FiscalYearConfig | null> {
  if (!companyId) return null;

  let fyStart: string | null = null;
  let fyEnd: string | null = null;

  if (branchId) {
    const branches = await branchService.getBranchesCached(companyId);
    const branch = branches.find((b) => b.id === branchId);
    if (branch?.fiscal_year_start) {
      fyStart = String(branch.fiscal_year_start).split('T')[0];
      fyEnd = branch.fiscal_year_end ? String(branch.fiscal_year_end).split('T')[0] : null;
    }
  }

  if (!fyStart) {
    const accounting = await settingsService.getSetting(companyId, 'accounting_settings');
    const value = accounting?.value as { fiscalYearStart?: string; fiscalYearEnd?: string } | undefined;
    if (value?.fiscalYearStart) fyStart = String(value.fiscalYearStart).split('T')[0];
    if (value?.fiscalYearEnd) fyEnd = String(value.fiscalYearEnd).split('T')[0];
  }

  if (!fyStart) {
    const { data, error } = await supabase
      .from('companies')
      .select('financial_year_start')
      .eq('id', companyId)
      .maybeSingle();
    if (!error && data?.financial_year_start) {
      fyStart = String(data.financial_year_start).split('T')[0];
    }
  }

  return normalizeFiscalYearConfig(fyStart, fyEnd);
}
