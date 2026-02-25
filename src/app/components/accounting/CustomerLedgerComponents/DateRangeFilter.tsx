'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { DatePicker } from '@/app/components/ui/DatePicker';

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}) => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-gray-400" />
        <DatePicker
          value={dateFrom}
          onChange={onDateFromChange}
          placeholder="From Date"
          className="w-40"
        />
      </div>
      <span className="text-gray-400">to</span>
      <DatePicker
        value={dateTo}
        onChange={onDateToChange}
        placeholder="To Date"
        className="w-40"
      />
    </div>
  );
};
