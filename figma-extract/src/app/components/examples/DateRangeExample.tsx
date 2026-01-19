import React, { useState } from 'react';
import { CalendarDateRangePicker } from '../ui/CalendarDateRangePicker';

export const DateRangeExample = () => {
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [dateTimeRange, setDateTimeRange] = useState<{ from?: Date; to?: Date }>({});

  return (
    <div className="p-8 space-y-8 bg-gray-950 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Date Range Picker Examples</h1>
          <p className="text-gray-400">Professional calendar-based date range selection</p>
        </div>

        {/* Example 1: Date Only */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Date Range Only</h3>
            <p className="text-sm text-gray-400">Select start and end dates without time</p>
          </div>
          
          <div className="max-w-md">
            <CalendarDateRangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder="Select date range"
              showTime={false}
            />
          </div>

          {dateRange.from && dateRange.to && (
            <div className="mt-4 p-4 bg-gray-950 border border-gray-800 rounded-lg">
              <p className="text-sm text-gray-400">Selected Range:</p>
              <p className="text-white font-medium">
                {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Example 2: Date + Time */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Date Range with Time</h3>
            <p className="text-sm text-gray-400">Select start and end dates with optional time selection</p>
          </div>
          
          <div className="max-w-md">
            <CalendarDateRangePicker
              value={dateTimeRange}
              onChange={setDateTimeRange}
              placeholder="Select date and time range"
              showTime={true}
            />
          </div>

          {dateTimeRange.from && dateTimeRange.to && (
            <div className="mt-4 p-4 bg-gray-950 border border-gray-800 rounded-lg">
              <p className="text-sm text-gray-400">Selected Range:</p>
              <p className="text-white font-medium">
                {dateTimeRange.from.toLocaleDateString()} - {dateTimeRange.to.toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Feature List */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <div className="mt-1 w-2 h-2 rounded-full bg-blue-500"></div>
              <div>
                <p className="text-sm font-medium text-white">Dual Month View</p>
                <p className="text-xs text-gray-500">See two months side-by-side</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-1 w-2 h-2 rounded-full bg-green-500"></div>
              <div>
                <p className="text-sm font-medium text-white">Range Selection</p>
                <p className="text-xs text-gray-500">Click start and end dates</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-1 w-2 h-2 rounded-full bg-purple-500"></div>
              <div>
                <p className="text-sm font-medium text-white">Hover Preview</p>
                <p className="text-xs text-gray-500">See range before confirming</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-1 w-2 h-2 rounded-full bg-yellow-500"></div>
              <div>
                <p className="text-sm font-medium text-white">Optional Time</p>
                <p className="text-xs text-gray-500">Add time selection if needed</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-1 w-2 h-2 rounded-full bg-red-500"></div>
              <div>
                <p className="text-sm font-medium text-white">Clear & Confirm</p>
                <p className="text-xs text-gray-500">Easy action buttons</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-1 w-2 h-2 rounded-full bg-orange-500"></div>
              <div>
                <p className="text-sm font-medium text-white">Dark Theme</p>
                <p className="text-xs text-gray-500">Consistent with app design</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
