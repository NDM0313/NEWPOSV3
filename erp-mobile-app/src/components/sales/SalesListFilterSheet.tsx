import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { DateInputField } from '../shared/DateTimePicker';
import type { DateRangeValue } from '../shared/DateRangeBar';
import { makeInitialRange } from '../shared/DateRangeBar';
import { buildDateRange } from '../../lib/dateRangePresets';
import { formatLocalDateYYYYMMDD } from '../../utils/localDate';
import { getThisBusinessWeekRange } from '../../utils/businessWeek';

export type SalesDateMode =
  | 'all'
  | 'today'
  | 'week'
  | 'thisMonth'
  | 'lastMonth'
  | 'pickMonth'
  | 'custom';

export type SalesMonthCursor = { year: number; monthIndex: number };

export function currentMonthCursor(anchor: Date = new Date()): SalesMonthCursor {
  return { year: anchor.getFullYear(), monthIndex: anchor.getMonth() };
}

export function monthBounds(year: number, monthIndex: number): { from: string; to: string } {
  const from = new Date(year, monthIndex, 1);
  const to = new Date(year, monthIndex + 1, 0);
  return {
    from: formatLocalDateYYYYMMDD(from),
    to: formatLocalDateYYYYMMDD(to),
  };
}

export function shiftMonthCursor(cursor: SalesMonthCursor, delta: number): SalesMonthCursor {
  const d = new Date(cursor.year, cursor.monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

function formatMonthLabel(cursor: SalesMonthCursor, locale = 'en-PK'): string {
  const d = new Date(cursor.year, cursor.monthIndex, 1);
  try {
    return d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  } catch {
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
}

function formatYmdShort(ymd: string, locale = 'en-PK'): string {
  if (!ymd || ymd.length < 10) return ymd;
  const d = new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
  if (Number.isNaN(d.getTime())) return ymd;
  try {
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return ymd;
  }
}

export function salesDateRangeSummary(
  mode: SalesDateMode,
  range: DateRangeValue,
  monthCursor: SalesMonthCursor,
): string {
  if (mode === 'all' || (!range.from && !range.to && range.preset === 'all')) return 'All time';
  if (mode === 'today') return 'Today';
  if (mode === 'week') return 'This week';
  if (mode === 'thisMonth') return 'This month';
  if (mode === 'lastMonth') return 'Last month';
  if (mode === 'pickMonth') return formatMonthLabel(monthCursor);
  if (range.from && range.to) {
    if (range.from === range.to) return formatYmdShort(range.from);
    return `${formatYmdShort(range.from)} – ${formatYmdShort(range.to)}`;
  }
  if (range.from) return `From ${formatYmdShort(range.from)}`;
  if (range.to) return `Until ${formatYmdShort(range.to)}`;
  return 'Custom range';
}

export function buildSalesDateRangeForMode(
  mode: SalesDateMode,
  monthCursor: SalesMonthCursor,
  prev?: DateRangeValue,
): DateRangeValue {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (mode) {
    case 'all':
      return makeInitialRange('all');
    case 'today':
      return buildDateRange('today');
    case 'week': {
      const { startDate } = getThisBusinessWeekRange(today);
      return {
        from: formatLocalDateYYYYMMDD(startDate),
        to: formatLocalDateYYYYMMDD(today),
        preset: 'week',
      };
    }
    case 'thisMonth':
      return buildDateRange('month');
    case 'lastMonth': {
      const last = shiftMonthCursor(currentMonthCursor(today), -1);
      const bounds = monthBounds(last.year, last.monthIndex);
      return { ...bounds, preset: 'custom' };
    }
    case 'pickMonth': {
      const bounds = monthBounds(monthCursor.year, monthCursor.monthIndex);
      return { ...bounds, preset: 'custom' };
    }
    case 'custom':
    default:
      return {
        from: prev?.from || formatLocalDateYYYYMMDD(today),
        to: prev?.to || formatLocalDateYYYYMMDD(today),
        preset: 'custom',
      };
  }
}

const QUICK_CHIPS: { id: SalesDateMode; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'custom', label: 'Custom' },
];

export interface SalesListFilterSheetProps {
  open: boolean;
  onClose: () => void;
  dateMode: SalesDateMode;
  onDateModeChange: (mode: SalesDateMode) => void;
  dateRange: DateRangeValue;
  onDateRangeChange: (range: DateRangeValue) => void;
  monthCursor: SalesMonthCursor;
  onMonthCursorChange: (cursor: SalesMonthCursor) => void;
  createdByFilter: string;
  onCreatedByFilterChange: (value: string) => void;
  creatorOptions: string[];
  branchFilter: string;
  onBranchFilterChange: (value: string) => void;
  branchOptions: Array<{ id: string; name: string }>;
  showBranchFilter: boolean;
  onClear: () => void;
  activeFilterCount: number;
}

export function SalesListFilterSheet({
  open,
  onClose,
  dateMode,
  onDateModeChange,
  dateRange,
  onDateRangeChange,
  monthCursor,
  onMonthCursorChange,
  createdByFilter,
  onCreatedByFilterChange,
  creatorOptions,
  branchFilter,
  onBranchFilterChange,
  branchOptions,
  showBranchFilter,
  onClear,
  activeFilterCount,
}: SalesListFilterSheetProps) {
  const summary = useMemo(
    () => salesDateRangeSummary(dateMode, dateRange, monthCursor),
    [dateMode, dateRange, monthCursor],
  );

  const monthLabel = formatMonthLabel(monthCursor);
  const monthNavActive = dateMode === 'pickMonth' || dateMode === 'thisMonth' || dateMode === 'lastMonth';

  if (!open) return null;

  const applyMode = (mode: SalesDateMode) => {
    let cursor = monthCursor;
    if (mode === 'thisMonth') {
      cursor = currentMonthCursor();
      onMonthCursorChange(cursor);
    } else if (mode === 'lastMonth') {
      cursor = shiftMonthCursor(currentMonthCursor(), -1);
      onMonthCursorChange(cursor);
    }
    onDateModeChange(mode);
    onDateRangeChange(buildSalesDateRangeForMode(mode, cursor, dateRange));
  };

  const goMonth = (delta: number) => {
    const next = shiftMonthCursor(monthCursor, delta);
    onMonthCursorChange(next);
    onDateModeChange('pickMonth');
    onDateRangeChange(buildSalesDateRangeForMode('pickMonth', next, dateRange));
  };

  const selectThisMonthViaNav = () => {
    onDateModeChange('pickMonth');
    onDateRangeChange(buildSalesDateRangeForMode('pickMonth', monthCursor, dateRange));
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end md:items-center md:justify-center bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full md:w-[28rem] max-h-[85dvh] flex flex-col bg-[#111827] rounded-t-2xl md:rounded-2xl border border-[#374151] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-list-filters-title"
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-[#374151] shrink-0">
          <div>
            <h2 id="sales-list-filters-title" className="text-base font-semibold text-white">
              Filters
              {activeFilterCount > 0 ? (
                <span className="ml-2 inline-flex min-w-[20px] h-5 px-1.5 rounded-full bg-[#2563EB] text-white text-[11px] font-bold items-center justify-center align-middle">
                  {activeFilterCount}
                </span>
              ) : null}
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">Showing: {summary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#1F2937]"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <section>
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Date</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_CHIPS.map((chip) => {
                const active = dateMode === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => applyMode(chip.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-[#1F2937] text-[#D1D5DB] border border-[#374151] hover:border-[#4B5563]'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            <div
              className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${
                monthNavActive
                  ? 'border-[#2563EB]/60 bg-[#2563EB]/10'
                  : 'border-[#374151] bg-[#1F2937]'
              }`}
            >
              <button
                type="button"
                onClick={() => goMonth(-1)}
                className="p-2 rounded-lg text-white hover:bg-white/10"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={selectThisMonthViaNav}
                className="flex-1 text-center text-sm font-semibold text-white py-1"
              >
                {monthLabel}
              </button>
              <button
                type="button"
                onClick={() => goMonth(1)}
                className="p-2 rounded-lg text-white hover:bg-white/10"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[11px] text-[#6B7280] mt-1.5">
              Tap month or use arrows to filter a full calendar month
            </p>

            {dateMode === 'custom' ? (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <DateInputField
                  label="From"
                  value={dateRange.from}
                  onChange={(from) => {
                    onDateModeChange('custom');
                    onDateRangeChange({ ...dateRange, from, preset: 'custom' });
                  }}
                />
                <DateInputField
                  label="To"
                  value={dateRange.to}
                  onChange={(to) => {
                    onDateModeChange('custom');
                    onDateRangeChange({ ...dateRange, to, preset: 'custom' });
                  }}
                />
              </div>
            ) : null}
          </section>

          {creatorOptions.length > 0 ? (
            <section>
              <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">
                Created by
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onCreatedByFilterChange('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                    createdByFilter === 'all'
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-[#1F2937] text-[#D1D5DB] border border-[#374151]'
                  }`}
                >
                  All
                </button>
                {creatorOptions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onCreatedByFilterChange(name)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold max-w-[160px] truncate ${
                      createdByFilter === name
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-[#1F2937] text-[#D1D5DB] border border-[#374151]'
                    }`}
                    title={name}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {showBranchFilter ? (
            <section>
              <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">
                Branch
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onBranchFilterChange('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                    branchFilter === 'all'
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-[#1F2937] text-[#D1D5DB] border border-[#374151]'
                  }`}
                >
                  All
                </button>
                {branchOptions.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onBranchFilterChange(b.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold max-w-[160px] truncate ${
                      branchFilter === b.id
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-[#1F2937] text-[#D1D5DB] border border-[#374151]'
                    }`}
                    title={b.name}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-[#374151] shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClear}
            className="flex-1 h-11 rounded-xl border border-[#374151] text-[#D1D5DB] text-sm font-semibold hover:bg-[#1F2937]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
