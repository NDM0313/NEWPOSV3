export const CURRENCY_DISPLAY_SYMBOL: Record<string, string> = {
  PKR: 'Rs.',
  pkr: 'Rs.',
  USD: '$',
  usd: '$',
  EUR: '€',
  eur: '€',
  GBP: '£',
  gbp: '£',
};

export const getCurrencySymbol = (currencyCode: string = 'PKR'): string =>
  CURRENCY_DISPLAY_SYMBOL[currencyCode] ?? currencyCode;

export interface FormatCurrencyOptions {
  showSymbol?: boolean;
  symbolOverride?: string | null;
}

function formatNumber(value: number, decimalPrecision: number): string {
  const prec = Math.max(0, Math.min(6, decimalPrecision));
  const n = value === null || value === undefined || isNaN(value) ? 0 : value;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: prec,
    maximumFractionDigits: prec,
  });
}

function resolveDisplaySymbol(currency: string, options?: FormatCurrencyOptions): string | null {
  if (options?.showSymbol === false) return null;
  const override = options?.symbolOverride?.trim();
  if (override) return override;
  const mapped = getCurrencySymbol(currency)?.trim();
  return mapped || null;
}

export const formatCurrency = (
  value: number,
  currency: string = 'PKR',
  decimalPrecision: number = 2,
  options?: FormatCurrencyOptions,
): string => {
  const formatted = formatNumber(value, decimalPrecision);
  const symbol = resolveDisplaySymbol(currency, options);
  if (!symbol) return formatted;
  return `${symbol} ${formatted}`;
};

export function resolveCurrencyDisplaySymbol(
  currency: string,
  options?: FormatCurrencyOptions,
): string {
  return resolveDisplaySymbol(currency, { showSymbol: true, ...options }) ?? getCurrencySymbol(currency);
}

export function buildFormatCurrencyFromCompany(
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
    formatCurrency: (value: number) => formatCurrency(value, currency, decimalPrecision, options),
    currencySymbol: resolveCurrencyDisplaySymbol(currency, options),
    options,
  };
}
