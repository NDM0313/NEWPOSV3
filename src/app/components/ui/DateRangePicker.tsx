import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, X } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import { DatePicker } from './DatePicker';

interface DateRangePickerProps {
  value?: { from?: Date; to?: Date };
  onChange?: (range: { from?: Date; to?: Date }) => void;
  placeholder?: string;
}

const presetRanges = [
  {
    label: 'Today',
    getValue: () => {
      const today = new Date();
      return { from: today, to: today };
    }
  },
  {
    label: 'Yesterday',
    getValue: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: yesterday, to: yesterday };
    }
  },
  {
    label: 'Last 7 Days',
    getValue: () => {
      const today = new Date();
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      return { from: lastWeek, to: today };
    }
  },
  {
    label: 'Last 30 Days',
    getValue: () => {
      const today = new Date();
      const lastMonth = new Date();
      lastMonth.setDate(lastMonth.getDate() - 30);
      return { from: lastMonth, to: today };
    }
  },
  {
    label: 'This Month',
    getValue: () => {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: firstDay, to: today };
    }
  },
  {
    label: 'Last Month',
    getValue: () => {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: firstDay, to: lastDay };
    }
  },
  {
    label: 'Last Quarter',
    getValue: () => {
      const today = new Date();
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
      const lastQuarterYear = currentQuarter === 0 ? today.getFullYear() - 1 : today.getFullYear();
      const quarterStart = new Date(lastQuarterYear, lastQuarter * 3, 1);
      const quarterEnd = new Date(lastQuarterYear, (lastQuarter + 1) * 3, 0);
      return { from: quarterStart, to: quarterEnd };
    }
  },
  {
    label: 'This Year',
    getValue: () => {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), 0, 1);
      return { from: firstDay, to: today };
    }
  },
  {
    label: 'Last Year',
    getValue: () => {
      const today = new Date();
      const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
      return { from: lastYearStart, to: lastYearEnd };
    }
  },
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date range'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [fromDate, setFromDate] = useState(value?.from || null);
  const [toDate, setToDate] = useState(value?.to || null);

  /** DD MMM YYYY – global display format */
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '';
    return format(date, 'dd MMM yyyy');
  };

  const handlePresetClick = (preset: typeof presetRanges[0]) => {
    const range = preset.getValue();
    setFromDate(range.from || null);
    setToDate(range.to || null);
    onChange?.(range);
    setIsOpen(false);
  };

  const handleClear = () => {
    setFromDate(null);
    setToDate(null);
    onChange?.({ from: undefined, to: undefined });
  };

  const displayText = fromDate && toDate
    ? `${formatDate(fromDate)} - ${formatDate(toDate)}`
    : fromDate
    ? `From ${formatDate(fromDate)}`
    : placeholder;

  const hasValue = fromDate || toDate;

  return (
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
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[351px] p-0 bg-popover border-border" align="start">
        <div className="flex">
          {/* Quick Presets */}
          <div className="border-r border-border p-3 space-y-1 min-w-[140px]">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Quick Select
            </div>
            {presetRanges.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className="w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs – shared DatePicker (DD MMM YYYY display, YYYY-MM-DD value) */}
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                From Date
              </label>
              <DatePicker
                value={fromDate ? format(fromDate, 'yyyy-MM-dd') : ''}
                onChange={(v) => {
                  const date = v ? new Date(v) : null;
                  setFromDate(date);
                  onChange?.({ from: date || undefined, to: toDate || undefined });
                }}
                placeholder="From"
                className="max-w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                To Date
              </label>
              <DatePicker
                value={toDate ? format(toDate, 'yyyy-MM-dd') : ''}
                onChange={(v) => {
                  const date = v ? new Date(v) : null;
                  setToDate(date);
                  onChange?.({ from: fromDate || undefined, to: date || undefined });
                }}
                minDate={fromDate || undefined}
                placeholder="To"
                className="max-w-full"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-foreground"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
