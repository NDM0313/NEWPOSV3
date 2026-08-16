/**
 * Client helpers for Import FX Wave A server gates.
 * Server/database remains authoritative; these improve UX and error surfacing only.
 */

import { supabase } from '@/lib/supabase';
import {
  resolveActiveImportCurrencies,
  type ActiveImportCurrency,
} from '@/app/lib/importFxHelpers';
import {
  formatImportFxServerError,
  IMPORT_FX_ERROR,
  isImportFxCurrencyAllowedClient,
} from '@/app/lib/importFxGateCodes';

export {
  formatImportFxServerError,
  IMPORT_FX_ERROR,
  isImportFxCurrencyAllowedClient,
} from '@/app/lib/importFxGateCodes';

/** Load company accounting_settings.multiCurrencyEnabled from DB (not caller boolean). */
export async function fetchCompanyImportFxEnabled(companyId: string): Promise<boolean> {
  if (!companyId) return false;
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', 'accounting_settings')
    .maybeSingle();
  if (error) throw error;
  const value = (data as { value?: unknown } | null)?.value as
    | { multiCurrencyEnabled?: unknown }
    | null
    | undefined;
  return value?.multiCurrencyEnabled === true;
}

export async function fetchCompanyActiveImportCurrencies(
  companyId: string
): Promise<ActiveImportCurrency[]> {
  if (!companyId) return resolveActiveImportCurrencies(null);
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', 'accounting_settings')
    .maybeSingle();
  if (error) throw error;
  const value = (data as { value?: unknown } | null)?.value as
    | { activeCurrencies?: ActiveImportCurrency[] | null }
    | null
    | undefined;
  return resolveActiveImportCurrencies(value ?? null);
}

export type AssertCanDisableImportFxResult = {
  ok: boolean;
  code?: string;
  error?: string;
  open_fx_currency_purchases?: number;
};

export async function assertCanDisableImportFx(
  companyId: string
): Promise<AssertCanDisableImportFxResult> {
  const { data, error } = await supabase.rpc('assert_can_disable_import_fx', {
    p_company_id: companyId,
  });
  if (error) {
    return {
      ok: false,
      code: IMPORT_FX_ERROR.MULTI_CURRENCY_DISABLE_BLOCKED,
      error: formatImportFxServerError(error),
    };
  }
  const row =
    typeof data === 'string'
      ? (JSON.parse(data) as AssertCanDisableImportFxResult)
      : ((data || {}) as AssertCanDisableImportFxResult);
  if (row.ok === true) return { ok: true, open_fx_currency_purchases: row.open_fx_currency_purchases ?? 0 };
  return {
    ok: false,
    code: row.code || IMPORT_FX_ERROR.MULTI_CURRENCY_DISABLE_BLOCKED,
    error: formatImportFxServerError(row.error || row),
    open_fx_currency_purchases: row.open_fx_currency_purchases,
  };
}
