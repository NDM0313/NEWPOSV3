import { useState } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

interface DateRangeSelectorProps {
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
}

type DatePreset = 'today' | 'week' | 'month' | 'year' | 'lastYear' | 'custom';

export function DateRangeSelector({ dateFrom, dateTo, onDateChange }: DateRangeSelectorProps) {
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('month');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);

  // Date calculation helpers
  const getToday = () => {
    const today = new Date();
    return formatDate(today);
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getDateRange = (preset: DatePreset): { from: string; to: string } => {
    const today = new Date();
    let from = new Date();
    let to = new Date();

    switch (preset) {
      case 'today':
        from = today;
        to = today;
        break;
      
      case 'week':
        // Start of week (Monday)
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        from = new Date(today);
        from.setDate(today.getDate() + diff);
        to = today;
        break;
      
      case 'month':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = today;
        break;
      
      case 'year':
        from = new Date(today.getFullYear(), 0, 1);
        to = today;
        break;
      
      case 'lastYear':
        from = new Date(today.getFullYear() - 1, 0, 1);
        to = new Date(today.getFullYear() - 1, 11, 31);
        break;
      
      case 'custom':
        return { from: customFrom, to: customTo };
    }

    return { from: formatDate(from), to: formatDate(to) };
  };

  const handlePresetChange = (preset: DatePreset) => {
    setSelectedPreset(preset);
    
    if (preset === 'custom') {
      setShowCustomModal(true);
    } else {
      const range = getDateRange(preset);
      onDateChange(range.from, range.to);
    }
  };

  const handleCustomApply = () => {
    onDateChange(customFrom, customTo);
    setShowCustomModal(false);
  };

  const getPresetLabel = () => {
    const labels = {
      today: 'Today',
      week: 'Week',
      month: 'Month',
      year: 'Year',
      lastYear: 'Last Year',
      custom: 'Custom'
    };
    return labels[selectedPreset];
  };

  const presets = [
    { id: 'today' as DatePreset, label: 'Today', icon: '📅' },
    { id: 'week' as DatePreset, label: 'Week', icon: '📆' },
    { id: 'month' as DatePreset, label: 'Month', icon: '🗓️' },
    { id: 'year' as DatePreset, label: 'Year', icon: '📊' },
    { id: 'lastYear' as DatePreset, label: 'Last Year', icon: '📈' },
    { id: 'custom' as DatePreset, label: 'Custom', icon: '⚙️' },
  ];

  return (
    <>
      {/* Compact Date Selector */}
      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-[#3B82F6]" />
          <span className="text-xs font-medium text-white">{getPresetLabel()}</span>
          <span className="text-xs text-[#6B7280] ml-auto">{dateFrom} to {dateTo}</span>
        </div>

        {/* Compact Presets - 2 rows */}
        <div className="grid grid-cols-3 gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetChange(preset.id)}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedPreset === preset.id
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#111827] text-[#9CA3AF] hover:bg-[#374151]'
              }`}
            >
              <span className="mr-1">{preset.icon}</span>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center">
          <div className="bg-[#1F2937] rounded-t-3xl sm:rounded-2xl w-full max-w-md pb-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-center pt-2 pb-4 sm:hidden">
              <div className="w-12 h-1 bg-[#374151] rounded-full"></div>
            </div>

            <div className="px-6 pb-4 border-b border-[#374151] flex items-center justify-between sticky top-0 bg-[#1F2937] z-10">
              <h2 className="text-lg font-semibold text-white">Custom Date Range</h2>
              <button
                onClick={() => setShowCustomModal(false)}
                className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
              >
                <X className="w-5 h-5 text-[#9CA3AF]" />
              </button>
            </div>

            <div className="px-6 pt-6 space-y-5">
              {/* From Date - Mobile Friendly */}
              <div>
                <label className="block text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#3B82F6]" />
                  From Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full h-14 bg-[#111827] border border-[#374151] rounded-xl px-4 text-white text-base focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 appearance-none"
                    style={{
                      colorScheme: 'dark'
                    }}
                  />
                </div>
                {/* Display Selected Date */}
                {customFrom && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#9CA3AF]">
                    <span className="px-2 py-1 bg-[#374151] rounded-md">
                      {new Date(customFrom + 'T00:00:00').toLocaleDateString('en-US', { 
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* To Date - Mobile Friendly */}
              <div>
                <label className="block text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#10B981]" />
                  To Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full h-14 bg-[#111827] border border-[#374151] rounded-xl px-4 text-white text-base focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 appearance-none"
                    style={{
                      colorScheme: 'dark'
                    }}
                  />
                </div>
                {/* Display Selected Date */}
                {customTo && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#9CA3AF]">
                    <span className="px-2 py-1 bg-[#374151] rounded-md">
                      {new Date(customTo + 'T00:00:00').toLocaleDateString('en-US', { 
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Range Helpers */}
              <div className="pt-2 border-t border-[#374151]">
                <p className="text-xs text-[#9CA3AF] mb-2">Quick Select Range:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const today = new Date();
                      const weekAgo = new Date(today);
                      weekAgo.setDate(today.getDate() - 7);
                      setCustomFrom(formatDate(weekAgo));
                      setCustomTo(formatDate(today));
                    }}
                    className="h-10 bg-[#111827] border border-[#374151] rounded-lg text-xs font-medium text-white hover:bg-[#374151] active:scale-95 transition-all"
                  >
                    Last 7 Days
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const monthAgo = new Date(today);
                      monthAgo.setMonth(today.getMonth() - 1);
                      setCustomFrom(formatDate(monthAgo));
                      setCustomTo(formatDate(today));
                    }}
                    className="h-10 bg-[#111827] border border-[#374151] rounded-lg text-xs font-medium text-white hover:bg-[#374151] active:scale-95 transition-all"
                  >
                    Last 30 Days
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                      setCustomFrom(formatDate(startOfMonth));
                      setCustomTo(formatDate(today));
                    }}
                    className="h-10 bg-[#111827] border border-[#374151] rounded-lg text-xs font-medium text-white hover:bg-[#374151] active:scale-95 transition-all"
                  >
                    This Month
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                      setCustomFrom(formatDate(lastMonth));
                      setCustomTo(formatDate(lastMonthEnd));
                    }}
                    className="h-10 bg-[#111827] border border-[#374151] rounded-lg text-xs font-medium text-white hover:bg-[#374151] active:scale-95 transition-all"
                  >
                    Last Month
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 pb-2">
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="flex-1 h-14 border border-[#374151] rounded-xl font-medium hover:bg-[#374151] transition-colors text-white active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomApply}
                  disabled={!customFrom || !customTo}
                  className="flex-1 h-14 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-medium transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  Apply Range
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}