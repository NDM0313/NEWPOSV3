/**
 * Shared DatePicker – global standard DD MMM YYYY display, YYYY-MM-DD (ISO) value.
 * Use everywhere for date inputs (Studio, Sales, Purchases, Accounting, Expense, Rentals, Dashboard).
 * Mobile-friendly, touch-optimized; uses CalendarDatePicker (no native type="date").
 */

import React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarDatePicker } from './CalendarDatePicker';
import { cn } from './utils';

/** Display format used across the app (DD MMM YYYY) */
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
 * Single date picker. Value/onChange use YYYY-MM-DD; display is DD MMM YYYY.
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
    <div className={cn('w-full', className)}>
      <CalendarDatePicker
        value={dateValue}
        onChange={handleChange}
        placeholder={placeholder}
        label={label}
        required={required}
        minDate={minDate}
        maxDate={maxDate}
        showTime={false}
        displayFormat={(d) => format(d, DISPLAY_DATE_FORMAT)}
      />
    </div>
  );
};

export default DatePicker;
