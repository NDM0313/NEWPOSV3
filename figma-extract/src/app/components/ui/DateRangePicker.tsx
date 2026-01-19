import React, { useState } from 'react';
import { Calendar, X } from 'lucide-react';
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
    label: 'This Year',
    getValue: () => {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), 0, 1);
      return { from: firstDay, to: today };
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

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
        <div className="flex">
          {/* Quick Presets */}
          <div className="border-r border-gray-800 p-3 space-y-1 min-w-[140px]">
            <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Quick Select
            </div>
            {presetRanges.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className="w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 rounded transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                From Date
              </label>
              <input
                type="date"
                value={fromDate ? fromDate.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : null;
                  setFromDate(date);
                  onChange?.({ from: date || undefined, to: toDate || undefined });
                }}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                To Date
              </label>
              <input
                type="date"
                value={toDate ? toDate.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : null;
                  setToDate(date);
                  onChange?.({ from: fromDate || undefined, to: date || undefined });
                }}
                min={fromDate ? fromDate.toISOString().split('T')[0] : undefined}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="flex-1 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
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
