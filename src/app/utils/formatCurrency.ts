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

/** Numeric amount only (no currency symbol) — for table cells where headers carry context. */
export const formatAmount = (value: number, decimalPrecision: number = 2): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  const prec = Math.max(0, Math.min(6, decimalPrecision));
  return value.toLocaleString('en-US', {
    minimumFractionDigits: prec,
    maximumFractionDigits: prec,
  });
};

function compactMaxFractionDigits(abs: number): number {
  if (abs < 10_000) return 1;
  if (abs < 1_000_000) return 0;
  return 1;
}

/**
 * Compact currency for KPI cards — K / M / B notation (1000 → 1K).
 * Values under 1,000 use full formatCurrency for precision.
 */
export const formatCurrencyCompact = (
  value: number,
  currency: string = 'PKR',
  decimalPrecision: number = 2
): string => {
  const symbol = getCurrencySymbol(currency);
  if (value === null || value === undefined || isNaN(value)) {
    return `${symbol} 0`;
  }
  const abs = Math.abs(value);
  if (abs < 1000) {
    return formatCurrency(value, currency, decimalPrecision);
  }
  const compactNum = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: compactMaxFractionDigits(abs),
  }).format(value);
  return `${symbol} ${compactNum}`;
};

/** Compact numeric amount (no symbol) — for count-style KPIs. */
export const formatAmountCompact = (value: number, decimalPrecision: number = 2): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  const abs = Math.abs(value);
  if (abs < 1000) {
    return formatAmount(value, decimalPrecision);
  }
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: compactMaxFractionDigits(abs),
  }).format(value);
};
