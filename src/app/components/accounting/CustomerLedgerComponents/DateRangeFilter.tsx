'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { Input } from '@/app/components/ui/input';

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
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="bg-gray-800 border-gray-700 text-white w-40"
          placeholder="From Date"
        />
      </div>
      <span className="text-gray-400">to</span>
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className="bg-gray-800 border-gray-700 text-white w-40"
        placeholder="To Date"
      />
    </div>
  );
};
