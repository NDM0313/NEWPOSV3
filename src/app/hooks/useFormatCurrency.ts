/**
 * Hook to format currency using company settings.
 * Use everywhere for money display - no hardcoded Rs, $, PKR.
 * currencySymbol = display symbol (e.g. Rs. for PKR, $ for USD).
 */
import { useCallback, useMemo } from 'react';
import { useSettings } from '@/app/context/SettingsContext';
import {
  formatCurrency as formatCurrencyUtil,
  resolveCurrencyDisplaySymbol,
  type FormatCurrencyOptions,
} from '@/app/utils/formatCurrency';

export function useFormatCurrency() {
  const { company } = useSettings();
  const currency = company?.currency || 'PKR';
  const decimalPrecision = company?.decimalPrecision ?? 2;
  const showCurrencySymbol = company?.showCurrencySymbol !== false;
  const currencySymbolOverride = company?.currencySymbol ?? null;

  const formatOptions: FormatCurrencyOptions = useMemo(
    () => ({
      showSymbol: showCurrencySymbol,
      symbolOverride: currencySymbolOverride,
    }),
    [showCurrencySymbol, currencySymbolOverride],
  );

  const currencySymbol = useMemo(
    () => resolveCurrencyDisplaySymbol(currency, formatOptions),
    [currency, formatOptions],
  );

  const formatCurrency = useCallback(
    (value: number) => formatCurrencyUtil(value, currency, decimalPrecision, formatOptions),
    [currency, decimalPrecision, formatOptions],
  );

  return {
    formatCurrency,
    currency,
    currencySymbol,
    decimalPrecision,
    showCurrencySymbol,
    currencySymbolOverride,
  };
}

/** Build formatter from draft company fields (Settings preview before save). */
export function buildFormatCurrencyFromDraft(
  currency: string,
  decimalPrecision: number,
  showCurrencySymbol: boolean,
  currencySymbol: string | null | undefined,
) {
  const options: FormatCurrencyOptions = {
    showSymbol: showCurrencySymbol,
    symbolOverride: currencySymbol,
  };
  return {
    formatCurrency: (value: number) => formatCurrencyUtil(value, currency, decimalPrecision, options),
    currencySymbol: resolveCurrencyDisplaySymbol(currency, options),
    options,
  };
}
