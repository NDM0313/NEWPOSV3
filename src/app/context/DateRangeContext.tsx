import React, { createContext, useContext, useState, ReactNode } from 'react';

export type DateRangeType = 'fromStart' | 'today' | 'last7days' | 'last15days' | 'last30days' | 'week' | 'month' | 'lastQuarter' | 'thisYear' | 'lastYear' | 'custom';

export interface DateRange {
  type: DateRangeType;
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangeContextType {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  setDateRangeType: (type: DateRangeType) => void;
  setCustomDateRange: (startDate: Date, endDate: Date) => void;
  getDateRangeForQuery: () => { startDate: string; endDate: string } | null;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export const useDateRange = () => {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error('useDateRange must be used within DateRangeProvider');
  }
  return context;
};

export const DateRangeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const getDateRangeForType = (type: DateRangeType): { startDate: Date; endDate: Date } => {
    const today = getToday();
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    switch (type) {
      case 'fromStart':
        // Show all data from a fixed past date (e.g. business start)
        const fromStart = new Date(today.getFullYear() - 10, 0, 1); // 10 years back
        return { startDate: fromStart, endDate };

      case 'today':
        return { startDate: today, endDate };

      case 'last7days':
        const last7Start = new Date(today);
        last7Start.setDate(today.getDate() - 6); // Include today, so 6 days back
        return { startDate: last7Start, endDate };

      case 'last15days':
        const last15Start = new Date(today);
        last15Start.setDate(today.getDate() - 14);
        return { startDate: last15Start, endDate };

      case 'last30days':
        const last30Start = new Date(today);
        last30Start.setDate(today.getDate() - 29);
        return { startDate: last30Start, endDate };

      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        return { startDate: weekStart, endDate };

      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: monthStart, endDate };

      case 'lastQuarter':
        const currentQuarter = Math.floor(today.getMonth() / 3);
        const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
        const lastQuarterYear = currentQuarter === 0 ? today.getFullYear() - 1 : today.getFullYear();
        const quarterStart = new Date(lastQuarterYear, lastQuarter * 3, 1);
        const quarterEnd = new Date(lastQuarterYear, (lastQuarter + 1) * 3, 0);
        quarterEnd.setHours(23, 59, 59, 999);
        return { startDate: quarterStart, endDate: quarterEnd };

      case 'thisYear':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        return { startDate: yearStart, endDate };

      case 'lastYear':
        const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
        lastYearEnd.setHours(23, 59, 59, 999);
        return { startDate: lastYearStart, endDate: lastYearEnd };

      case 'custom':
        // Will be set by setCustomDateRange
        return { startDate: today, endDate };

      default:
        return { startDate: today, endDate };
    }
  };

  const [dateRange, setDateRangeState] = useState<DateRange>(() => {
    const { startDate, endDate } = getDateRangeForType('fromStart');
    return {
      type: 'fromStart',
      startDate,
      endDate,
    };
  });

  const setDateRange = (range: DateRange) => {
    setDateRangeState(range);
  };

  const setDateRangeType = (type: DateRangeType) => {
    if (type === 'custom') {
      // Keep existing custom dates if already set
      if (dateRange.type === 'custom' && dateRange.startDate && dateRange.endDate) {
        setDateRangeState({
          type: 'custom',
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });
      } else {
        // Default to today if switching to custom without dates
        const { startDate, endDate } = getDateRangeForType('today');
        setDateRangeState({
          type: 'custom',
          startDate,
          endDate,
        });
      }
    } else {
      const { startDate, endDate } = getDateRangeForType(type);
      setDateRangeState({
        type,
        startDate,
        endDate,
      });
    }
  };

  const setCustomDateRange = (startDate: Date, endDate: Date) => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    setDateRangeState({
      type: 'custom',
      startDate: start,
      endDate: end,
    });
  };

  const getDateRangeForQuery = (): { startDate: string; endDate: string } | null => {
    if (!dateRange.startDate || !dateRange.endDate) return null;
    return {
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
    };
  };

  const value: DateRangeContextType = {
    dateRange,
    setDateRange,
    setDateRangeType,
    setCustomDateRange,
    getDateRangeForQuery,
  };

  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  );
};
