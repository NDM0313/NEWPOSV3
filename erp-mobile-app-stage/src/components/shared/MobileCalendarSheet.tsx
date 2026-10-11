import { useEffect, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { formatLocalDateYYYYMMDD, localNowDateTimeString } from '../../utils/localDate';
import {
  CALENDAR_DAYS,
  CalendarMonthYearHeader,
  formatHHMM,
  getDaysInMonth,
  parseISODateOnly,
  parseISODateTimeLocal,
  startOfLocalDay,
} from './calendarChrome';

export type MobileCalendarMode = 'date' | 'datetime';

export interface MobileCalendarSheetProps {
  open: boolean;
  onClose: () => void;
  mode: MobileCalendarMode;
  /** YYYY-MM-DD or yyyy-MM-ddTHH:mm */
  value: string;
  onConfirm: (value: string) => void;
  title?: string;
  min?: string;
  max?: string;
  /** Clear sets empty string via onConfirm then closes. */
  allowClear?: boolean;
}

function parseBound(iso?: string): Date | undefined {
  if (!iso?.trim()) return undefined;
  const d = parseISODateOnly(iso.trim().slice(0, 10));
  return d ?? undefined;
}

export function MobileCalendarSheet({
  open,
  onClose,
  mode,
  value,
  onConfirm,
  title,
  min,
  max,
  allowClear = true,
}: MobileCalendarSheetProps) {
  const minDate = parseBound(min);
  const maxDate = parseBound(max);
  const initial = mode === 'datetime' ? parseISODateTimeLocal(value) : parseISODateOnly(value);

  const [currentMonth, setCurrentMonth] = useState(() => initial ?? new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    initial ? startOfLocalDay(initial) : null,
  );
  const [selectedTime, setSelectedTime] = useState(() => {
    if (initial && mode === 'datetime') return formatHHMM(initial);
    const now = new Date();
    return formatHHMM(now);
  });

  useEffect(() => {
    if (!open) return;
    const parsed = mode === 'datetime' ? parseISODateTimeLocal(value) : parseISODateOnly(value);
    if (parsed) {
      setSelectedDate(startOfLocalDay(parsed));
      setCurrentMonth(parsed);
      if (mode === 'datetime') setSelectedTime(formatHHMM(parsed));
    } else {
      setSelectedDate(null);
      setCurrentMonth(new Date());
      if (mode === 'datetime') {
        const now = new Date();
        setSelectedTime(formatHHMM(now));
      }
    }
  }, [open, value, mode]);

  if (!open) return null;

  const isDisabled = (date: Date) => {
    const day = startOfLocalDay(date);
    if (minDate && day < startOfLocalDay(minDate)) return true;
    if (maxDate && day > startOfLocalDay(maxDate)) return true;
    return false;
  };

  const isSelected = (date: Date) =>
    !!selectedDate && date.toDateString() === selectedDate.toDateString();

  const canConfirm =
    mode === 'datetime'
      ? !!selectedDate && /^\d{2}:\d{2}$/.test(selectedTime)
      : !!selectedDate;

  const handleConfirm = () => {
    if (!selectedDate) return;
    if (mode === 'date') {
      onConfirm(formatLocalDateYYYYMMDD(selectedDate));
      onClose();
      return;
    }
    const [h, m] = selectedTime.split(':').map(Number);
    const withTime = new Date(selectedDate);
    withTime.setHours(h || 0, m || 0, 0, 0);
    onConfirm(
      `${formatLocalDateYYYYMMDD(withTime)}T${String(withTime.getHours()).padStart(2, '0')}:${String(withTime.getMinutes()).padStart(2, '0')}`,
    );
    onClose();
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDate(startOfLocalDay(today));
    setCurrentMonth(today);
    if (mode === 'datetime') setSelectedTime(formatHHMM(today));
  };

  const handleClear = () => {
    setSelectedDate(null);
    onConfirm('');
    onClose();
  };

  const heading =
    title ?? (mode === 'datetime' ? 'Select date & time' : 'Select date');

  return (
    <div className="fixed inset-0 z-[240] flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close calendar"
        onClick={onClose}
      />
      <div className="relative bg-[#111827] border-t border-[#374151] rounded-t-2xl shadow-xl max-h-[92vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-base font-semibold text-white">{heading}</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:bg-[#1F2937]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pb-4 overflow-y-auto">
          <CalendarMonthYearHeader
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            minDate={minDate}
            maxDate={maxDate}
          />

          <div className="grid grid-cols-7 gap-1 mb-1">
            {CALENDAR_DAYS.map((day) => (
              <div
                key={day}
                className="h-9 flex items-center justify-center text-[11px] font-medium text-[#9CA3AF]"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {getDaysInMonth(currentMonth).map((date, idx) => {
              if (!date) return <div key={`e-${idx}`} className="h-11" />;
              const selected = isSelected(date);
              const today = date.toDateString() === new Date().toDateString();
              const disabled = isDisabled(date);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && setSelectedDate(startOfLocalDay(date))}
                  className={[
                    'h-11 min-h-[44px] text-sm rounded-lg transition-colors',
                    selected && 'bg-[#3B82F6] text-white font-semibold',
                    !selected && !disabled && 'text-[#E5E7EB] hover:bg-[#1F2937] active:bg-[#374151]',
                    today && !selected && 'border border-[#3B82F6]',
                    disabled && 'text-[#4B5563] opacity-50 cursor-not-allowed',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {mode === 'datetime' && (
            <div className="mt-4 pt-4 border-t border-[#374151] space-y-2">
              <label className="text-xs font-medium text-[#9CA3AF] flex items-center gap-1.5">
                <Clock size={14} />
                Time <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="time"
                required
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value || formatHHMM(new Date()))}
                className="w-full h-11 min-h-[44px] px-3 rounded-lg bg-[#0B0F19] border border-[#374151] text-white text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 [color-scheme:dark]"
              />
              <p className="text-[11px] text-[#6B7280]">
                Time is required. Empty opens with now ({localNowDateTimeString().slice(11, 16)}).
              </p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-[#374151] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="h-11 px-3 rounded-lg text-sm font-medium text-[#60A5FA] hover:bg-[#1E3A5F]/40"
            >
              Today
            </button>
            <div className="flex gap-2">
              {allowClear && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="h-11 px-4 rounded-lg text-sm font-medium border border-[#374151] text-[#D1D5DB] hover:bg-[#1F2937]"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                disabled={!canConfirm}
                onClick={handleConfirm}
                className="h-11 px-5 rounded-lg text-sm font-semibold bg-[#3B82F6] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2563EB]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
