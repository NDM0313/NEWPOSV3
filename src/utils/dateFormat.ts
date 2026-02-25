/**
 * Global Date Formatting Utilities
 * App timezone = Pakistan (Asia/Karachi, UTC+5)
 *
 * Standard display format: DD MMM YYYY (e.g. 25 Feb 2026)
 * Store in DB/API as: YYYY-MM-DD (ISO)
 */

import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, subDays } from 'date-fns';
import { getTodayInAppTimezone } from '@/app/components/ui/utils';

/** Use for all date display across Studio, Sales, Purchases, Accounting, Expense, Dashboard */
export const DISPLAY_DATE_FORMAT = 'dd MMM yyyy';

/** Use for API/DB value (ISO date only) */
export const ISO_DATE_FORMAT = 'yyyy-MM-dd';

/**
 * Format a single date as "15 Jan 2024" (DD MMM YYYY)
 */
export const formatDate = (date: Date | null | undefined): string => {
  if (!date) return '';
  return format(date, DISPLAY_DATE_FORMAT);
};

/**
 * Format a date range as "01 Jan 2024 – 31 Jan 2024"
 */
export const formatDateRange = (from: Date | null | undefined, to: Date | null | undefined): string => {
  if (!from || !to) return '';
  return `${format(from, 'dd MMM yyyy')} – ${format(to, 'dd MMM yyyy')}`;
};

/**
 * Date Presets – sab app timezone (Pakistan) ke hisaab se
 */
export const datePresets = {
  today: () => {
    const today = getTodayInAppTimezone();
    return {
      from: startOfDay(today),
      to: endOfDay(today),
      label: 'Today',
    };
  },

  yesterday: () => {
    const today = getTodayInAppTimezone();
    const yesterday = subDays(today, 1);
    return {
      from: startOfDay(yesterday),
      to: endOfDay(yesterday),
      label: 'Yesterday',
    };
  },

  thisMonth: () => {
    const today = getTodayInAppTimezone();
    return {
      from: startOfMonth(today),
      to: endOfMonth(today),
      label: 'This Month',
    };
  },

  lastMonth: () => {
    const today = getTodayInAppTimezone();
    const lastMonth = subMonths(today, 1);
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
 * Check if a date is today (app timezone = Pakistan)
 */
export const isToday = (date: Date): boolean => {
  const today = getTodayInAppTimezone();
  return format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
};

/**
 * Check if a date is yesterday (app timezone = Pakistan)
 */
export const isYesterday = (date: Date): boolean => {
  const today = getTodayInAppTimezone();
  const yesterday = subDays(today, 1);
  return format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd');
};
