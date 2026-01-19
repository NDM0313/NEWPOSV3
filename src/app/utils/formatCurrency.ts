/**
 * Format currency value
 * @param value - Number to format
 * @param currency - Currency symbol (default: 'Rs')
 * @returns Formatted currency string
 */
export const formatCurrency = (value: number, currency: string = 'Rs'): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return `${currency} 0`;
  }
  
  return `${currency} ${value.toLocaleString('en-US', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 2 
  })}`;
};
