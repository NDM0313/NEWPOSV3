import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';

export const CALENDAR_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

export const CALENDAR_MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const CALENDAR_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const DEFAULT_YEAR_PAST = 20;
const DEFAULT_YEAR_FUTURE = 5;

export function getCalendarYearOptions(
  minDate?: Date,
  maxDate?: Date,
  displayedYear?: number,
): number[] {
  const now = new Date().getFullYear();
  let start = now - DEFAULT_YEAR_PAST;
  let end = now + DEFAULT_YEAR_FUTURE;
  if (displayedYear != null && Number.isFinite(displayedYear)) {
    start = Math.min(start, displayedYear);
    end = Math.max(end, displayedYear);
  }
  if (minDate && !isNaN(minDate.getTime())) {
    start = Math.min(start, minDate.getFullYear());
  }
  if (maxDate && !isNaN(maxDate.getTime())) {
    end = Math.max(end, maxDate.getFullYear());
  }
  if (start > end) {
    const t = start;
    start = end;
    end = t;
  }
  const years: number[] = [];
  for (let y = start; y <= end; y += 1) years.push(y);
  return years;
}

const selectClassName =
  'h-8 rounded-md border border-border bg-input-background px-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50';

export interface CalendarMonthYearHeaderProps {
  currentMonth: Date;
  onMonthChange: (next: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  /** Compact labels for dual-panel range picker. */
  monthLabels?: 'full' | 'short';
  className?: string;
  /** When false, hide prev/next (e.g. secondary panel with shared nav). Default true. */
  showChevrons?: boolean;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}

/**
 * Shared calendar header: month + year selects + optional chevrons.
 * Used by CalendarDatePicker and CalendarDateRangePicker for one system style.
 */
export function CalendarMonthYearHeader({
  currentMonth,
  onMonthChange,
  minDate,
  maxDate,
  monthLabels = 'full',
  className,
  showChevrons = true,
  onPrevMonth,
  onNextMonth,
}: CalendarMonthYearHeaderProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const years = useMemo(
    () => getCalendarYearOptions(minDate, maxDate, year),
    [minDate, maxDate, year],
  );
  const labels = monthLabels === 'short' ? CALENDAR_MONTHS_SHORT : CALENDAR_MONTHS_FULL;

  const setMonthIndex = (m: number) => {
    onMonthChange(new Date(year, m, 1));
  };

  const setYearValue = (y: number) => {
    onMonthChange(new Date(y, month, 1));
  };

  const prev = () => {
    if (onPrevMonth) onPrevMonth();
    else onMonthChange(new Date(year, month - 1, 1));
  };

  const next = () => {
    if (onNextMonth) onNextMonth();
    else onMonthChange(new Date(year, month + 1, 1));
  };

  const selects = (
    <div className="flex items-center gap-1.5 min-w-0 justify-center">
      <select
        aria-label="Month"
        value={month}
        onChange={(e) => setMonthIndex(Number(e.target.value))}
        className={cn(selectClassName, 'min-w-0 max-w-[9.5rem]')}
      >
        {labels.map((name, idx) => (
          <option key={name} value={idx}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Year"
        value={year}
        onChange={(e) => setYearValue(Number(e.target.value))}
        className={cn(selectClassName, 'w-[5.25rem]')}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );

  if (!showChevrons) {
    return <div className={cn('flex items-center justify-center mb-4', className)}>{selects}</div>;
  }

  return (
    <div className={cn('flex items-center justify-between gap-2 mb-4', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={prev}
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
        aria-label="Previous month"
      >
        <ChevronLeft size={18} />
      </Button>
      <div className="flex-1 min-w-0 flex justify-center">{selects}</div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={next}
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
        aria-label="Next month"
      >
        <ChevronRight size={18} />
      </Button>
    </div>
  );
}
