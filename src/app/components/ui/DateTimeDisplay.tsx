/**
 * Reusable two-line date + time display for reports/lists/statements.
 * Line 1 = date (business format), Line 2 = time (smaller, muted, italic).
 * Uses company timezone and date/time format from useFormatDate.
 */
import React from 'react';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { cn } from './utils';

export interface DateTimeDisplayProps {
  /** Date to display (Date, ISO string, or timestamp) */
  date: Date | string | number;
  /** Optional class for the wrapper */
  className?: string;
  /** Optional: date-only (single line) when true */
  dateOnly?: boolean;
}

export const DateTimeDisplay: React.FC<DateTimeDisplayProps> = ({
  date,
  className,
  dateOnly = false,
}) => {
  const { formatDate, formatTime } = useFormatDate();
  const d = typeof date === 'object' && date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return <span className={cn('text-gray-500', className)}>—</span>;
  }
  const dateStr = formatDate(d);
  const timeStr = formatTime(d);

  if (dateOnly) {
    return <span className={cn('text-gray-300', className)}>{dateStr}</span>;
  }

  return (
    <div className={cn('flex flex-col leading-tight', className)}>
      <span className="text-gray-300 text-sm">{dateStr}</span>
      <span className="text-xs text-gray-500 font-normal italic mt-0.5">{timeStr}</span>
    </div>
  );
};
