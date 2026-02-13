/**
 * Hook to format currency using company settings.
 * Use everywhere for money display - no hardcoded Rs, $, PKR.
 */
import { useCallback } from 'react';
import { useSettings } from '@/app/context/SettingsContext';
import { formatCurrency as formatCurrencyUtil } from '@/app/utils/formatCurrency';

export function useFormatCurrency() {
  const { company } = useSettings();
  const currency = company?.currency || 'PKR';
  const decimalPrecision = company?.decimalPrecision ?? 2;

  const formatCurrency = useCallback(
    (value: number) => formatCurrencyUtil(value, currency, decimalPrecision),
    [currency, decimalPrecision]
  );

  return { formatCurrency, currency, decimalPrecision };
}
