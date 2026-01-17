/**
 * Global Date Formatting Utilities
 * 
 * Standard formats:
 * - Single date: "15 Jan 2024"
 * - Date range: "01 Jan 2024 – 31 Jan 2024"
 * 
 * Presets:
 * - Today
 * - Yesterday
 * - This Month
 * - Last Month
 */

import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, subDays } from 'date-fns';

/**
 * Format a single date as "15 Jan 2024"
 */
export const formatDate = (date: Date | null | undefined): string => {
  if (!date) return '';
  return format(date, 'dd MMM yyyy');
};

/**
 * Format a date range as "01 Jan 2024 – 31 Jan 2024"
 */
export const formatDateRange = (from: Date | null | undefined, to: Date | null | undefined): string => {
  if (!from || !to) return '';
  return `${format(from, 'dd MMM yyyy')} – ${format(to, 'dd MMM yyyy')}`;
};

/**
 * Date Presets
 */
export const datePresets = {
  today: () => {
    const today = new Date();
    return {
      from: startOfDay(today),
      to: endOfDay(today),
      label: 'Today',
    };
  },
  
  yesterday: () => {
    const yesterday = subDays(new Date(), 1);
    return {
      from: startOfDay(yesterday),
      to: endOfDay(yesterday),
      label: 'Yesterday',
    };
  },
  
  thisMonth: () => {
    const today = new Date();
    return {
      from: startOfMonth(today),
      to: endOfMonth(today),
      label: 'This Month',
    };
  },
  
  lastMonth: () => {
    const lastMonth = subMonths(new Date(), 1);
    return {
      from: startOfMonth(lastMonth),
      to: endOfMonth(lastMonth),
      label: 'Last Month',
    };
  },
};

/**
 * Get all presets as an array
 */
export const getDatePresets = () => [
  datePresets.today(),
  datePresets.yesterday(),
  datePresets.thisMonth(),
  datePresets.lastMonth(),
];

/**
 * Check if a date is today
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
};

/**
 * Check if a date is yesterday
 */
export const isYesterday = (date: Date): boolean => {
  const yesterday = subDays(new Date(), 1);
  return format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd');
};
