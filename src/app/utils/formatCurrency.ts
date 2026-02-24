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

/**
 * Format currency value - CENTRALIZED. Use everywhere for money display.
 * PKR is displayed as "Rs." globally; other codes use standard symbols.
 * @param value - Number to format
 * @param currency - Currency code (default: 'PKR'). Use company.currency from useSettings.
 * @param decimalPrecision - Decimal places (default: 2). Use company.decimalPrecision from useSettings.
 * @returns Formatted currency string e.g. "Rs. 1,234.56"
 */
export const formatCurrency = (
  value: number,
  currency: string = 'PKR',
  decimalPrecision: number = 2
): string => {
  const symbol = getCurrencySymbol(currency);
  if (value === null || value === undefined || isNaN(value)) {
    return `${symbol} 0`;
  }
  const prec = Math.max(0, Math.min(6, decimalPrecision));
  return `${symbol} ${value.toLocaleString('en-US', {
    minimumFractionDigits: prec,
    maximumFractionDigits: prec,
  })}`;
};
