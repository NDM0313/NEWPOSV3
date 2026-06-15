import { supabase } from '../lib/supabase';
import { normalizeFiscalYearConfig, type FiscalYearConfig } from '../utils/financialYear';

export async function resolveFiscalYearConfig(
  companyId: string,
  branchId?: string | null,
): Promise<FiscalYearConfig | null> {
  if (!companyId) return null;

  let fyStart: string | null = null;
  let fyEnd: string | null = null;

  if (branchId) {
    const { data: branch } = await supabase
      .from('branches')
      .select('fiscal_year_start, fiscal_year_end')
      .eq('id', branchId)
      .maybeSingle();
    if (branch?.fiscal_year_start) {
      fyStart = String(branch.fiscal_year_start).split('T')[0];
      fyEnd = branch.fiscal_year_end ? String(branch.fiscal_year_end).split('T')[0] : null;
    }
  }

  if (!fyStart) {
    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('company_id', companyId)
      .eq('key', 'accounting_settings')
      .maybeSingle();
    const value = setting?.value as { fiscalYearStart?: string; fiscalYearEnd?: string } | undefined;
    if (value?.fiscalYearStart) fyStart = String(value.fiscalYearStart).split('T')[0];
    if (value?.fiscalYearEnd) fyEnd = String(value.fiscalYearEnd).split('T')[0];
  }

  if (!fyStart) {
    const { data: company } = await supabase
      .from('companies')
      .select('financial_year_start')
      .eq('id', companyId)
      .maybeSingle();
    if (company?.financial_year_start) {
      fyStart = String(company.financial_year_start).split('T')[0];
    }
  }

  return normalizeFiscalYearConfig(fyStart, fyEnd);
}
