import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { formatDate as formatDateUtil, formatTime as formatTimeUtil } from '@/app/utils/formatDate';

interface CalendarDatePickerProps {
  value?: Date;
  onChange?: (date?: Date) => void;
  placeholder?: string;
  showTime?: boolean;
  label?: string;
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
  /** Display format for the selected date (e.g. DD MMM YYYY). Default: locale short date */
  displayFormat?: (date: Date) => string;
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const CalendarDatePicker: React.FC<CalendarDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  showTime = false,
  label,
  required = false,
  minDate,
  maxDate,
  displayFormat,
}) => {
  const { dateFormat, timeFormat, timezone } = useFormatDate();
  const [isOpen, setIsOpen] = useState(false);
  // Helper to safely convert value to Date
  const getDateValue = (val: Date | undefined): Date | null => {
    if (!val) return null;
    if (val instanceof Date) {
      if (isNaN(val.getTime())) {
        console.warn('[CalendarDatePicker] Invalid Date object:', val);
        return null;
      }
      return val;
    }
    // Try to convert string/number to Date
    const dateVal = new Date(val);
    if (isNaN(dateVal.getTime())) {
      console.warn('[CalendarDatePicker] Invalid date value:', val);
      return null;
    }
    return dateVal;
  };
  
  const initialDate = getDateValue(value);
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate);
  const [currentMonth, setCurrentMonth] = useState(initialDate || new Date());
  const [selectedTime, setSelectedTime] = useState(() => {
    if (initialDate) {
      const hours = initialDate.getHours().toString().padStart(2, '0');
      const minutes = initialDate.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return '00:00';
  });

  // Sync internal state when value prop changes (e.g. parent loads saved date in edit mode)
  useEffect(() => {
    const dateValue = getDateValue(value);
    if (dateValue) {
      setSelectedDate(dateValue);
      setCurrentMonth(dateValue);
      const hours = dateValue.getHours().toString().padStart(2, '0');
      const minutes = dateValue.getMinutes().toString().padStart(2, '0');
      setSelectedTime(`${hours}:${minutes}`);
    } else {
      setSelectedDate(null);
      setSelectedTime('00:00');
    }
  }, [value?.getTime?.() ?? value]);

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '';
    if (displayFormat) return displayFormat(date);
    return formatDateUtil(date, dateFormat, timezone);
  };

  const formatDateTime = (date: Date | null | undefined, time: string) => {
    if (!date) return '';
    const dateStr = formatDate(date);
    if (!showTime) return dateStr;
    const [hours, minutes] = time.split(':').map(Number);
    const withTime = new Date(date);
    withTime.setHours(hours || 0, minutes || 0, 0, 0);
    if (displayFormat) return displayFormat(withTime);
    return `${dateStr} ${formatTimeUtil(withTime, timeFormat as '12h' | '24h', timezone)}`;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    // When no time picker, commit immediately so parent state updates even if user closes without clicking Confirm
    if (!showTime) {
      onChange?.(date);
      setIsOpen(false);
    }
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isDateSelected = (date: Date) => {
    if (!date || !selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  const handleConfirm = () => {
    if (selectedDate) {
      if (showTime) {
        const [hours, minutes] = selectedTime.split(':').map(Number);
        const dateWithTime = new Date(selectedDate);
        dateWithTime.setHours(hours, minutes, 0, 0);
        onChange?.(dateWithTime);
      } else {
        onChange?.(selectedDate);
      }
      setIsOpen(false);
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedDate(null);
    onChange?.(undefined);
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  // Show value (linked from parent) when present, else in-popover selection, so trigger is always linked to actual date
  const effectiveDate = getDateValue(value) ?? selectedDate;
  const timeForDisplay = effectiveDate === selectedDate ? selectedTime : (effectiveDate ? `${effectiveDate.getHours().toString().padStart(2, '0')}:${effectiveDate.getMinutes().toString().padStart(2, '0')}` : '00:00');
  const displayText = effectiveDate ? formatDateTime(effectiveDate, timeForDisplay) : placeholder;

  const hasValue = !!effectiveDate;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal bg-input-background border-border text-foreground hover:bg-accent hover:text-foreground",
              !hasValue && "text-muted-foreground"
            )}
          >
            <Calendar className="mr-2 h-4 w-4" />
            <span className="flex-1 truncate">{displayText}</span>
            {hasValue && (
              <X
                className="ml-2 h-4 w-4 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
          <div className="p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={prevMonth}
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <ChevronLeft size={18} />
              </Button>
              <div className="text-sm font-semibold text-foreground">
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={nextMonth}
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <ChevronRight size={18} />
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="w-64">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth(currentMonth).map((date, idx) => {
                  if (!date) {
                    return <div key={`empty-${idx}`} className="h-9" />;
                  }
                  
                  const isSelected = isDateSelected(date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  const isDisabled = isDateDisabled(date);
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => !isDisabled && handleDateClick(date)}
                      disabled={isDisabled}
                      className={cn(
                        "h-9 text-sm rounded transition-colors",
                        isSelected && "bg-blue-600 text-white font-semibold",
                        !isSelected && !isDisabled && "text-muted-foreground hover:bg-accent",
                        isToday && !isSelected && "border border-blue-500",
                        isDisabled && "text-gray-700 cursor-not-allowed opacity-50"
                      )}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Selection (Optional) */}
            {showTime && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Clock size={12} />
                    Select Time
                  </label>
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
              >
                Today
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  className="border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={!selectedDate}
                  className="bg-blue-600 hover:bg-blue-500 text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
