import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';

interface DateRangePickerProps {
  value?: { from?: Date; to?: Date };
  onChange?: (range: { from?: Date; to?: Date }) => void;
  placeholder?: string;
  showTime?: boolean;
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CalendarDateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date range',
  showTime = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [fromDate, setFromDate] = useState<Date | null>(value?.from || null);
  const [toDate, setToDate] = useState<Date | null>(value?.to || null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [fromTime, setFromTime] = useState('00:00');
  const [toTime, setToTime] = useState('23:59');

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
    if (!fromDate || (fromDate && toDate)) {
      // Start new selection
      setFromDate(date);
      setToDate(null);
    } else {
      // Complete selection
      if (date < fromDate) {
        setToDate(fromDate);
        setFromDate(date);
      } else {
        setToDate(date);
      }
    }
  };

  const isDateInRange = (date: Date) => {
    if (!fromDate) return false;
    const compareDate = hoverDate && !toDate ? hoverDate : toDate;
    if (!compareDate) return false;
    
    const start = fromDate < compareDate ? fromDate : compareDate;
    const end = fromDate < compareDate ? compareDate : fromDate;
    
    return date >= start && date <= end;
  };

  const isDateSelected = (date: Date) => {
    if (!date) return false;
    const dateStr = date.toDateString();
    return (
      (fromDate && fromDate.toDateString() === dateStr) ||
      (toDate && toDate.toDateString() === dateStr)
    );
  };

  const handleConfirm = () => {
    if (fromDate && toDate) {
      onChange?.({ from: fromDate, to: toDate });
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setFromDate(null);
    setToDate(null);
    setHoverDate(null);
    onChange?.({ from: undefined, to: undefined });
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const displayText = fromDate && toDate
    ? `${formatDateTime(fromDate, fromTime)} - ${formatDateTime(toDate, toTime)}`
    : fromDate
    ? `From ${formatDateTime(fromDate, fromTime)}`
    : placeholder;

  const hasValue = fromDate || toDate;

  const leftMonth = currentMonth;
  const rightMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);

  return (
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
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
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
            <div className="flex gap-8">
              <span className="text-sm font-semibold text-white">
                {MONTHS[leftMonth.getMonth()]} {leftMonth.getFullYear()}
              </span>
              <span className="text-sm font-semibold text-white">
                {MONTHS[rightMonth.getMonth()]} {rightMonth.getFullYear()}
              </span>
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

          {/* Dual Calendar Grid */}
          <div className="flex gap-4">
            {/* Left Month */}
            <div className="w-64">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth(leftMonth).map((date, idx) => {
                  if (!date) {
                    return <div key={`empty-${idx}`} className="h-9" />;
                  }
                  
                  const isSelected = isDateSelected(date);
                  const isInRange = isDateInRange(date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => handleDateClick(date)}
                      onMouseEnter={() => setHoverDate(date)}
                      onMouseLeave={() => setHoverDate(null)}
                      className={cn(
                        "h-9 text-sm rounded transition-colors",
                        isSelected && "bg-blue-600 text-white font-semibold",
                        isInRange && !isSelected && "bg-blue-600/20 text-blue-300",
                        !isSelected && !isInRange && "text-gray-300 hover:bg-gray-800",
                        isToday && !isSelected && "border border-blue-500"
                      )}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Month */}
            <div className="w-64">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth(rightMonth).map((date, idx) => {
                  if (!date) {
                    return <div key={`empty-${idx}`} className="h-9" />;
                  }
                  
                  const isSelected = isDateSelected(date);
                  const isInRange = isDateInRange(date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => handleDateClick(date)}
                      onMouseEnter={() => setHoverDate(date)}
                      onMouseLeave={() => setHoverDate(null)}
                      className={cn(
                        "h-9 text-sm rounded transition-colors",
                        isSelected && "bg-blue-600 text-white font-semibold",
                        isInRange && !isSelected && "bg-blue-600/20 text-blue-300",
                        !isSelected && !isInRange && "text-gray-300 hover:bg-gray-800",
                        isToday && !isSelected && "border border-blue-500"
                      )}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Time Selection (Optional) */}
          {showTime && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
                    <Clock size={12} />
                    From Time
                  </label>
                  <input
                    type="time"
                    value={fromTime}
                    onChange={(e) => setFromTime(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
                    <Clock size={12} />
                    To Time
                  </label>
                  <input
                    type="time"
                    value={toTime}
                    onChange={(e) => setToTime(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              {fromDate && toDate ? (
                <span>
                  {formatDate(fromDate)} - {formatDate(toDate)}
                </span>
              ) : fromDate ? (
                <span>Select end date</span>
              ) : (
                <span>Select start date</span>
              )}
            </div>
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
                disabled={!fromDate || !toDate}
                className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
