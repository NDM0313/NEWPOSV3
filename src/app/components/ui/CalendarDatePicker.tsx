import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import { formatDate as formatDateGlobal } from '../../../utils/dateFormat';

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

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '';
    // Use global format: "15 Jan 2024"
    return formatDateGlobal(date);
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
        <label 
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {label}
          {required && <span style={{ color: 'var(--color-error)' }} className="ml-1">*</span>}
        </label>
      )}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              color: hasValue ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
              e.currentTarget.style.color = hasValue ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)';
            }}
          >
            <Calendar className="mr-2 h-4 w-4" />
            <span className="flex-1 truncate">{displayText}</span>
            {hasValue && (
              <X
                className="ml-2 h-4 w-4"
                style={{ color: 'var(--color-text-tertiary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }}
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0" 
          align="start"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)'
          }}
        >
          <div className="p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={prevMonth}
                className="h-8 w-8"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <ChevronLeft size={18} />
              </Button>
              <div 
                className="text-sm font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={nextMonth}
                className="h-8 w-8"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <ChevronRight size={18} />
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="w-64">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map((day) => (
                  <div 
                    key={day} 
                    className="text-center text-xs font-medium py-2"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
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
                      className="h-9 text-sm rounded transition-colors"
                      style={{
                        backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                        color: isSelected 
                          ? 'var(--color-text-primary)' 
                          : isDisabled 
                          ? 'var(--color-text-disabled)' 
                          : 'var(--color-text-primary)',
                        fontWeight: isSelected ? '600' : 'normal',
                        borderRadius: 'var(--radius-sm)',
                        border: isToday && !isSelected ? `1px solid var(--color-primary)` : 'none',
                        opacity: isDisabled ? 0.5 : 1,
                        cursor: isDisabled ? 'not-allowed' : 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected && !isDisabled) {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected && !isDisabled) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Selection (Optional) */}
            {showTime && (
              <div 
                className="mt-4 pt-4 border-t"
                style={{ borderColor: 'var(--color-border-primary)' }}
              >
                <div className="space-y-2">
                  <label 
                    className="text-xs font-medium flex items-center gap-1"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <Clock size={12} />
                    Select Time
                  </label>
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderColor: 'var(--color-border-primary)',
                      color: 'var(--color-text-primary)',
                      borderRadius: 'var(--radius-lg)',
                      focusRingColor: 'var(--color-primary)'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div 
              className="mt-4 pt-4 border-t flex items-center justify-between"
              style={{ borderColor: 'var(--color-border-primary)' }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                style={{ color: 'var(--color-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-primary)';
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-primary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Today
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  style={{
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-secondary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={!selectedDate}
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-primary)',
                    opacity: !selectedDate ? 0.5 : 1,
                    cursor: !selectedDate ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedDate) {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                      e.currentTarget.style.opacity = '0.9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedDate) {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                      e.currentTarget.style.opacity = '1';
                    }
                  }}
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
