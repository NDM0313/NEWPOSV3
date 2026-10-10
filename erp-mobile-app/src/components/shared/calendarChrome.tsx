import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  if (minDate && !Number.isNaN(minDate.getTime())) {
    start = Math.min(start, minDate.getFullYear());
  }
  if (maxDate && !Number.isNaN(maxDate.getTime())) {
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
  'h-11 min-h-[44px] rounded-lg border border-[#374151] bg-[#111827] px-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 [color-scheme:dark]';

export interface CalendarMonthYearHeaderProps {
  currentMonth: Date;
  onMonthChange: (next: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

/** Mobile calendar header: large month + year selects + chevrons. */
export function CalendarMonthYearHeader({
  currentMonth,
  onMonthChange,
  minDate,
  maxDate,
  className = '',
}: CalendarMonthYearHeaderProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const years = useMemo(
    () => getCalendarYearOptions(minDate, maxDate, year),
    [minDate, maxDate, year],
  );

  return (
    <div className={`flex items-center justify-between gap-2 mb-3 ${className}`}>
      <button
        type="button"
        onClick={() => onMonthChange(new Date(year, month - 1, 1))}
        className="h-11 w-11 shrink-0 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] active:bg-[#374151]"
        aria-label="Previous month"
      >
        <ChevronLeft size={22} />
      </button>
      <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
        <select
          aria-label="Month"
          value={month}
          onChange={(e) => onMonthChange(new Date(year, Number(e.target.value), 1))}
          className={`${selectClassName} min-w-0 max-w-[10rem] flex-1`}
        >
          {CALENDAR_MONTHS_FULL.map((name, idx) => (
            <option key={name} value={idx}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Year"
          value={year}
          onChange={(e) => onMonthChange(new Date(Number(e.target.value), month, 1))}
          className={`${selectClassName} w-[5.5rem] shrink-0`}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => onMonthChange(new Date(year, month + 1, 1))}
        className="h-11 w-11 shrink-0 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] active:bg-[#374151]"
        aria-label="Next month"
      >
        <ChevronRight size={22} />
      </button>
    </div>
  );
}

export function getDaysInMonth(date: Date): (Date | null)[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }
  return days;
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseISODateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseISODateTimeLocal(value: string): Date | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseISODateOnly(trimmed);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(trimmed);
  if (!m) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    0,
    0,
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
