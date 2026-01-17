import React, { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import { formatDate as formatDateGlobal, formatDateRange as formatDateRangeGlobal, getDatePresets } from '../../../utils/dateFormat';

interface DateRangePickerProps {
  value?: { from?: Date; to?: Date };
  onChange?: (range: { from?: Date; to?: Date }) => void;
  placeholder?: string;
}

// Use global date presets from dateFormat utility
// Only include: Today, Yesterday, This Month, Last Month (as per requirements)
const presetRanges = getDatePresets().map(preset => ({
  label: preset.label,
  getValue: () => ({ from: preset.from, to: preset.to })
}));

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
    // Use global format: "15 Jan 2024"
    return formatDateGlobal(date);
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
    ? formatDateRangeGlobal(fromDate, toDate) // Uses format: "01 Jan 2024 – 31 Jan 2024"
    : fromDate
    ? `From ${formatDate(fromDate)}`
    : placeholder;

  const hasValue = fromDate || toDate;

  return (
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
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
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
        <div className="flex">
          {/* Quick Presets */}
          <div 
            className="border-r p-3 space-y-1 min-w-[140px]"
            style={{ borderRightColor: 'var(--color-border-primary)' }}
          >
            <div 
              className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Quick Select
            </div>
            {presetRanges.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className="w-full text-left px-2 py-1.5 text-sm rounded transition-colors"
                style={{
                  color: 'var(--color-text-primary)',
                  borderRadius: 'var(--radius-sm)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label 
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: 'var(--color-text-secondary)' }}
              >
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
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-primary)',
                  borderRadius: 'var(--radius-lg)'
                }}
              />
            </div>

            <div className="space-y-2">
              <label 
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: 'var(--color-text-secondary)' }}
              >
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
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-primary)',
                  borderRadius: 'var(--radius-lg)'
                }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="flex-1"
                style={{
                  borderColor: 'var(--color-border-primary)',
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
                onClick={() => setIsOpen(false)}
                className="flex-1"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                }}
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
