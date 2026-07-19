import { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { formatLocalDateTimeDisplay } from '../../utils/localDate';
import { formatLocalDateYYYYMMDD } from '../../utils/localDate';
import { parseISODateOnly, parseISODateTimeLocal } from './calendarChrome';
import { MobileCalendarSheet } from './MobileCalendarSheet';

export interface DateInputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Minimum date (YYYY-MM-DD) */
  min?: string;
  /** Maximum date (YYYY-MM-DD) */
  max?: string;
  /**
   * @deprecated Prefer `DateTimeInputField` for document/payment timestamps.
   * When true, behaves like datetime mode (time required).
   */
  showTime?: boolean;
  /** @deprecated Native picker only; unused with sheet */
  pickerLabel?: string;
  /** Focus ring color token — rental flows use purple */
  accent?: 'default' | 'rental';
  disabled?: boolean;
}

export interface DateTimeInputFieldProps {
  label: string;
  /** yyyy-MM-ddTHH:mm local */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  min?: string;
  max?: string;
  accent?: 'default' | 'rental';
  disabled?: boolean;
}

const accentFocusClass: Record<NonNullable<DateInputFieldProps['accent']>, string> = {
  default: 'focus-within:border-[#3B82F6]',
  rental: 'focus-within:border-[#8B5CF6]',
};

function displayDate(value: string): string {
  const d = parseISODateOnly(value);
  if (!d) return '';
  return formatLocalDateYYYYMMDD(d);
}

function displayDateTime(value: string): string {
  const d = parseISODateTimeLocal(value);
  if (!d) return '';
  return formatLocalDateTimeDisplay(d);
}

/**
 * Date-only field — bottom sheet with month/year selects (no time).
 * Use for filters, rental dates, due dates.
 */
export function DateInputField({
  label,
  value,
  onChange,
  required = false,
  min,
  max,
  showTime = false,
  accent = 'default',
  disabled = false,
}: DateInputFieldProps) {
  if (showTime) {
    return (
      <DateTimeInputField
        label={label}
        value={value}
        onChange={onChange}
        required={required}
        min={min}
        max={max}
        accent={accent}
        disabled={disabled}
      />
    );
  }

  const [open, setOpen] = useState(false);
  const shown = useMemo(() => (value?.trim() ? displayDate(value) : ''), [value]);

  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
        {label}
        {required ? <span className="text-[#EF4444] ml-0.5">*</span> : null}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={`flex items-center gap-2 w-full bg-[#111827] border border-[#374151] rounded-lg px-3 h-11 min-h-[44px] text-left transition-colors ${accentFocusClass[accent]} disabled:opacity-50`}
      >
        <Calendar className="w-5 h-5 text-[#6B7280] shrink-0" aria-hidden />
        <span className={`flex-1 min-w-0 truncate text-sm ${shown ? 'text-white' : 'text-[#6B7280]'}`}>
          {shown || 'Select date'}
        </span>
      </button>
      <MobileCalendarSheet
        open={open}
        onClose={() => setOpen(false)}
        mode="date"
        value={value}
        onConfirm={onChange}
        min={min}
        max={max}
        title={label}
      />
    </div>
  );
}

/**
 * Date + time field — bottom sheet; time is always required before Confirm.
 * Use for sales, purchases, payments, journal, expenses.
 */
export function DateTimeInputField({
  label,
  value,
  onChange,
  required = false,
  min,
  max,
  accent = 'default',
  disabled = false,
}: DateTimeInputFieldProps) {
  const [open, setOpen] = useState(false);
  const shown = useMemo(() => (value?.trim() ? displayDateTime(value) : ''), [value]);

  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
        {label}
        {required ? <span className="text-[#EF4444] ml-0.5">*</span> : null}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={`flex items-center gap-2 w-full bg-[#111827] border border-[#374151] rounded-lg px-3 h-11 min-h-[44px] text-left transition-colors ${accentFocusClass[accent]} disabled:opacity-50`}
      >
        <Calendar className="w-5 h-5 text-[#6B7280] shrink-0" aria-hidden />
        <span className={`flex-1 min-w-0 truncate text-sm ${shown ? 'text-white' : 'text-[#6B7280]'}`}>
          {shown || 'Select date & time'}
        </span>
      </button>
      <MobileCalendarSheet
        open={open}
        onClose={() => setOpen(false)}
        mode="datetime"
        value={value}
        onConfirm={onChange}
        min={min}
        max={max}
        title={label}
      />
    </div>
  );
}
