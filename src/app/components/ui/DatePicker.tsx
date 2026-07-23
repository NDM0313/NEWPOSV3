/**
 * Shared DatePicker — company dateFormat display, value YYYY-MM-DD (ISO date).
 *
 * Canonical imports for web ERP date inputs:
 * - DatePicker — date only (filters, pickup/return, accounting entry date)
 * - DateTimePicker — date + time (sales, purchases, payment receive)
 * - DateRangePicker — preset report ranges
 * - CalendarDateRangePicker — dual-calendar ledger/rental ranges
 *
 * Shared calendar chrome (CalendarDatePicker) includes month + year dropdowns
 * so multi-year jumps do not require repeated month chevrons. Prefer these
 * wrappers; avoid native type="date" / datetime-local and direct ../ui/calendar
 * in new forms.
 */

import React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarDatePicker } from './CalendarDatePicker';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { formatDate as formatDateUtil } from '@/app/utils/formatDate';
import { cn } from './utils';

/** Display format fallback when company settings unavailable */
export const DISPLAY_DATE_FORMAT = 'dd MMM yyyy';

/** Value format for DB/API (ISO date only) */
export const ISO_DATE_FORMAT = 'yyyy-MM-dd';

export interface DatePickerProps {
  /** Current value: YYYY-MM-DD string (ISO) */
  value?: string;
  /** Called with YYYY-MM-DD when user selects a date */
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * Single date picker. Value/onChange use YYYY-MM-DD; display uses company dateFormat.
 */
export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  label,
  required = false,
  minDate,
  maxDate,
  disabled = false,
  className,
}) => {
  const { dateFormat, timezone } = useFormatDate();

  const dateValue = value?.trim()
    ? (() => {
        const d = parseISO(value);
        return isValid(d) ? d : undefined;
      })()
    : undefined;

  const handleChange = (date: Date | undefined) => {
    if (!onChange) return;
    if (!date) {
      onChange('');
      return;
    }
    onChange(format(date, ISO_DATE_FORMAT));
  };

  return (
    <div className={cn('w-full', className, disabled && 'pointer-events-none opacity-60')}>
      <CalendarDatePicker
        value={dateValue}
        onChange={handleChange}
        placeholder={placeholder}
        label={label}
        required={required}
        minDate={minDate}
        maxDate={maxDate}
        showTime={false}
        displayFormat={(d) => formatDateUtil(d, dateFormat, timezone)}
      />
    </div>
  );
};

export default DatePicker;
