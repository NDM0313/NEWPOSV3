import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';

interface CalendarDatePickerProps {
  value?: Date;
  onChange?: (date?: Date) => void;
  placeholder?: string;
  showTime?: boolean;
  label?: string;
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(value || null);
  const [currentMonth, setCurrentMonth] = useState(value || new Date());
  const [selectedTime, setSelectedTime] = useState(() => {
    if (value) {
      const hours = value.getHours().toString().padStart(2, '0');
      const minutes = value.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return '00:00';
  });

  // Sync internal state when value prop changes (e.g. parent loads saved date in edit mode)
  useEffect(() => {
    if (value) {
      setSelectedDate(value);
      setCurrentMonth(value);
      const hours = value.getHours().toString().padStart(2, '0');
      const minutes = value.getMinutes().toString().padStart(2, '0');
      setSelectedTime(`${hours}:${minutes}`);
    } else {
      setSelectedDate(null);
      setSelectedTime('00:00');
    }
  }, [value?.getTime?.() ?? value]);

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (date: Date | null | undefined, time: string) => {
    if (!date) return '';
    const dateStr = formatDate(date);
    return showTime ? `${dateStr} ${time}` : dateStr;
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

  const displayText = selectedDate
    ? formatDateTime(selectedDate, selectedTime)
    : placeholder;

  const hasValue = !!selectedDate;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal bg-gray-900 border-gray-800 text-white hover:bg-gray-800 hover:text-white",
              !hasValue && "text-gray-500"
            )}
          >
            <Calendar className="mr-2 h-4 w-4" />
            <span className="flex-1 truncate">{displayText}</span>
            {hasValue && (
              <X
                className="ml-2 h-4 w-4 text-gray-500 hover:text-white"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-800" align="start">
          <div className="p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={prevMonth}
                className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <ChevronLeft size={18} />
              </Button>
              <div className="text-sm font-semibold text-white">
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={nextMonth}
                className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <ChevronRight size={18} />
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="w-64">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
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
                        !isSelected && !isDisabled && "text-gray-300 hover:bg-gray-800",
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
              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
                    <Clock size={12} />
                    Select Time
                  </label>
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
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
                  className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={!selectedDate}
                  className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
