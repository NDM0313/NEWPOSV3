import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMobilePrintingSettings, type MobileCompanyCurrency } from '../api/mobilePrintingSettings';
import {
  buildFormatCurrencyFromCompany,
  formatCurrency as formatCurrencyUtil,
  resolveCurrencyDisplaySymbol,
  type FormatCurrencyOptions,
} from '../lib/formatCurrency';

export function useFormatCurrency(companyId: string | null) {
  const [currencyInfo, setCurrencyInfo] = useState<MobileCompanyCurrency>({
    currency: 'PKR',
    currencySymbol: null,
    showCurrencySymbol: true,
    decimalPrecision: 2,
  });

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void getMobilePrintingSettings(companyId).then(({ data }) => {
      if (!cancelled) setCurrencyInfo(data.currency);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const formatOptions: FormatCurrencyOptions = useMemo(
    () => ({
      showSymbol: currencyInfo.showCurrencySymbol,
      symbolOverride: currencyInfo.currencySymbol,
    }),
    [currencyInfo.showCurrencySymbol, currencyInfo.currencySymbol],
  );

  const currencySymbol = useMemo(
    () => resolveCurrencyDisplaySymbol(currencyInfo.currency, formatOptions),
    [currencyInfo.currency, formatOptions],
  );

  const formatCurrency = useCallback(
    (value: number) =>
      formatCurrencyUtil(value, currencyInfo.currency, currencyInfo.decimalPrecision, formatOptions),
    [currencyInfo.currency, currencyInfo.decimalPrecision, formatOptions],
  );

  return {
    formatCurrency,
    currency: currencyInfo.currency,
    currencySymbol,
    decimalPrecision: currencyInfo.decimalPrecision,
    showCurrencySymbol: currencyInfo.showCurrencySymbol,
    currencySymbolOverride: currencyInfo.currencySymbol,
  };
}

export function useFormatCurrencyFromBundle(currencyInfo: MobileCompanyCurrency) {
  return useMemo(
    () => buildFormatCurrencyFromCompany(
      currencyInfo.currency,
      currencyInfo.decimalPrecision,
      currencyInfo.showCurrencySymbol,
      currencyInfo.currencySymbol,
    ),
    [currencyInfo],
  );
}
