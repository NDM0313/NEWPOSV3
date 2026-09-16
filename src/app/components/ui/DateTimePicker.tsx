/**
 * Shared DateTimePicker — company dateFormat/timeFormat/timezone display, value yyyy-MM-ddTHH:mm.
 * Use for document/payment timestamps (sales, purchases, payment receive, transfers).
 */

import React from 'react';
import { isValid } from 'date-fns';
import { CalendarDatePicker } from './CalendarDatePicker';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { formatDateTime as formatDateTimeUtil } from '@/app/utils/formatDate';
import { formatLocalDateTimeYYYYMMDDHHmm, parseLocalDateTimeInput } from '@/app/utils/localDate';
import { cn } from './utils';

export const ISO_DATETIME_MINUTE_FORMAT = "yyyy-MM-dd'T'HH:mm";

export interface DateTimePickerProps {
  /** Current value: yyyy-MM-ddTHH:mm (local) */
  value?: string;
  /** Called with yyyy-MM-ddTHH:mm when user confirms */
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date & time',
  label,
  required = false,
  minDate,
  maxDate,
  disabled = false,
  className,
}) => {
  const { dateFormat, timeFormat, timezone } = useFormatDate();

  const dateValue = value?.trim()
    ? (() => {
        const d = parseLocalDateTimeInput(value);
        return isValid(d) ? d : undefined;
      })()
    : undefined;

  const handleChange = (date: Date | undefined) => {
    if (!onChange) return;
    if (!date) {
      onChange('');
      return;
    }
    onChange(formatLocalDateTimeYYYYMMDDHHmm(date));
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
        showTime={true}
        displayFormat={(d) => formatDateTimeUtil(d, dateFormat, timeFormat as '12h' | '24h', timezone)}
      />
    </div>
  );
};

/** Convert Date state to DateTimePicker string value. */
export function dateToDateTimePickerValue(d: Date | undefined | null): string {
  if (!d || !isValid(d)) return '';
  return formatLocalDateTimeYYYYMMDDHHmm(d);
}

/** Convert DateTimePicker string to Date for form state. */
export function dateTimePickerValueToDate(value: string | undefined): Date | undefined {
  const v = String(value || '').trim();
  if (!v) return undefined;
  const d = parseLocalDateTimeInput(v);
  return isValid(d) ? d : undefined;
}

export default DateTimePicker;
