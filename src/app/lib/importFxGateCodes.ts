/**
 * Pure Import FX Wave A gate helpers (no supabase / import.meta).
 * Server remains authoritative; these mirror codes for UX + unit tests.
 */

import {
  normalizeCurrencyCode,
  resolveActiveImportCurrencies,
  type ActiveImportCurrency,
} from '@/app/lib/importFxHelpers';

export const IMPORT_FX_ERROR = {
  MULTI_CURRENCY_DISABLED: 'MULTI_CURRENCY_DISABLED',
  IMPORT_FX_CURRENCY_NOT_ACTIVE: 'IMPORT_FX_CURRENCY_NOT_ACTIVE',
  MULTI_CURRENCY_DISABLE_BLOCKED: 'MULTI_CURRENCY_DISABLE_BLOCKED',
  IMPORT_FX_OPERATION_IN_PROGRESS: 'IMPORT_FX_OPERATION_IN_PROGRESS',
  IMPORT_FX_CASE_STAGE_W2_ARRANGEMENT_ONLY: 'IMPORT_FX_CASE_STAGE_W2_ARRANGEMENT_ONLY',
  IMPORT_FX_CASE_STAGE_W1_PLANNING_ONLY: 'IMPORT_FX_CASE_STAGE_W1_PLANNING_ONLY',
} as const;

export function formatImportFxServerError(raw: unknown, fallback = 'Import FX request failed'): string {
  const msg = String(
    (raw as { message?: string })?.message ||
      (typeof raw === 'string' ? raw : '') ||
      fallback
  );
  if (msg.includes(IMPORT_FX_ERROR.MULTI_CURRENCY_DISABLED)) {
    return 'Multi Currency is OFF in Settings. Turn it on to use Import FX.';
  }
  if (msg.includes(IMPORT_FX_ERROR.IMPORT_FX_CURRENCY_NOT_ACTIVE)) {
    return 'That currency is not in Active foreign currencies. Add it in Settings or pick an allowed currency.';
  }
  if (msg.includes(IMPORT_FX_ERROR.MULTI_CURRENCY_DISABLE_BLOCKED)) {
    const openMatch = msg.match(/(\d+)\s+open\/partial/i);
    if (openMatch) {
      return `Cannot disable Multi Currency: ${openMatch[1]} open/partial agent FX credit purchase(s) must be paid or voided first.`;
    }
    return 'Cannot disable Multi Currency while Import FX agent credit workflows are still open.';
  }
  if (msg.includes(IMPORT_FX_ERROR.IMPORT_FX_OPERATION_IN_PROGRESS)) {
    return 'This Import FX settlement is already in progress in another tab or request. Wait for it to finish, then retry if needed.';
  }
  if (
    msg.includes(IMPORT_FX_ERROR.IMPORT_FX_CASE_STAGE_W2_ARRANGEMENT_ONLY) ||
    msg.includes(IMPORT_FX_ERROR.IMPORT_FX_CASE_STAGE_W1_PLANNING_ONLY)
  ) {
    return 'Only Arrangement can be confirmed in W2. Advance and USD acquisition money steps start in W3+.';
  }
  return msg || fallback;
}

/** Client-side mirror of server active-currency rule (UX); server still enforces. */
export function isImportFxCurrencyAllowedClient(
  currency: string | null | undefined,
  active: ActiveImportCurrency[]
): boolean {
  const code = normalizeCurrencyCode(currency);
  if (!code) return false;
  if (code === 'PKR') return true;
  return active.some((c) => normalizeCurrencyCode(c.code) === code);
}

export function resolveActiveImportCurrenciesOrDefault(
  settings?: { activeCurrencies?: ActiveImportCurrency[] | null } | null
): ActiveImportCurrency[] {
  return resolveActiveImportCurrencies(settings);
}
