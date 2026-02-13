/**
 * Format currency value - CENTRALIZED. Use everywhere for money display.
 * No hardcoded Rs, $, or toFixed(2) for money.
 * @param value - Number to format
 * @param currency - Currency symbol/code (default: 'PKR'). Use company.currency from useSettings.
 * @param decimalPrecision - Decimal places (default: 2). Use company.decimalPrecision from useSettings.
 * @returns Formatted currency string e.g. "PKR 1,234.56"
 */
export const formatCurrency = (
  value: number,
  currency: string = 'PKR',
  decimalPrecision: number = 2
): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return `${currency} 0`;
  }
  const prec = Math.max(0, Math.min(6, decimalPrecision));
  return `${currency} ${value.toLocaleString('en-US', {
    minimumFractionDigits: prec,
    maximumFractionDigits: prec,
  })}`;
};
