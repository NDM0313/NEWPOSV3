/**
 * Display symbol for currency code (global: show Rs. for PKR).
 * Currency code in settings stays PKR; only the displayed symbol is mapped here.
 */
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

/** Get display symbol for currency code (e.g. PKR → Rs., USD → $). Use for placeholders/labels. */
export const getCurrencySymbol = (currencyCode: string = 'PKR'): string =>
  CURRENCY_DISPLAY_SYMBOL[currencyCode] ?? currencyCode;

export interface FormatCurrencyOptions {
  /** When false, amounts are formatted without a symbol prefix. */
  showSymbol?: boolean;
  /** Custom symbol override; empty/null uses mapped default for currency code. */
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

function resolveDisplaySymbol(
  currency: string,
  options?: FormatCurrencyOptions,
): string | null {
  if (options?.showSymbol === false) return null;
  const override = options?.symbolOverride?.trim();
  if (override) return override;
  const mapped = getCurrencySymbol(currency)?.trim();
  return mapped || null;
}

/**
 * Format currency value - CENTRALIZED. Use everywhere for money display.
 * @param value - Number to format
 * @param currency - Currency code (default: 'PKR'). Use company.currency from useSettings.
 * @param decimalPrecision - Decimal places (default: 2). Use company.decimalPrecision from useSettings.
 * @param options - Optional show/hide symbol and custom symbol override from company settings.
 * @returns Formatted currency string e.g. "Rs. 1,234.56" or "1,234.56" when symbol hidden
 */
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

/** Resolve the symbol shown in UI labels/placeholders given company display settings. */
export function resolveCurrencyDisplaySymbol(
  currency: string,
  options?: FormatCurrencyOptions,
): string {
  return resolveDisplaySymbol(currency, { showSymbol: true, ...options }) ?? getCurrencySymbol(currency);
}
