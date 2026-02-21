import { useState } from 'react';
import { Calendar, X } from 'lucide-react';

interface DateRangeSelectorProps {
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
}

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'lastYear' | 'custom';

export function DateRangeSelector({ dateFrom, dateTo, onDateChange }: DateRangeSelectorProps) {
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('month');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const getDateRange = (preset: DatePreset): { from: string; to: string } => {
    const today = new Date();
    let from = new Date();
    let to = new Date();

    switch (preset) {
      case 'today':
        from = to = today;
        break;
      case 'yesterday':
        from = to = new Date(today);
        from.setDate(today.getDate() - 1);
        break;
      case 'week':
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
    if (preset === 'custom') setShowCustomModal(true);
    else {
      const { from, to } = getDateRange(preset);
      onDateChange(from, to);
    }
  };

  const presets: { id: DatePreset; label: string; icon: string }[] = [
    { id: 'today', label: 'Today', icon: '📅' },
    { id: 'yesterday', label: 'Yesterday', icon: '📆' },
    { id: 'week', label: 'Week', icon: '📆' },
    { id: 'month', label: 'Month', icon: '🗓️' },
    { id: 'year', label: 'Year', icon: '📊' },
    { id: 'lastYear', label: 'Last Year', icon: '📈' },
    { id: 'custom', label: 'Custom', icon: '⚙️' },
  ];

  const getPresetLabel = () =>
    ({ today: 'Today', yesterday: 'Yesterday', week: 'Week', month: 'Month', year: 'Year', lastYear: 'Last Year', custom: 'Custom' } as const)[
      selectedPreset
    ];

  return (
    <>
      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-[#3B82F6]" />
          <span className="text-xs font-medium text-white">{getPresetLabel()}</span>
          <span className="text-xs text-[#6B7280] ml-auto">{dateFrom} to {dateTo}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetChange(preset.id)}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedPreset === preset.id ? 'bg-[#3B82F6] text-white' : 'bg-[#111827] text-[#9CA3AF] hover:bg-[#374151]'
              }`}
            >
              <span className="mr-1">{preset.icon}</span>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {showCustomModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center">
          <div className="bg-[#1F2937] rounded-t-3xl sm:rounded-2xl w-full max-w-md pb-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-center pt-2 pb-4 sm:hidden">
              <div className="w-12 h-1 bg-[#374151] rounded-full" />
            </div>
            <div className="px-6 pb-4 border-b border-[#374151] flex items-center justify-between sticky top-0 bg-[#1F2937] z-10">
              <h2 className="text-lg font-semibold text-white">Custom Date Range</h2>
              <button onClick={() => setShowCustomModal(false)} className="p-2 hover:bg-[#374151] rounded-lg">
                <X className="w-5 h-5 text-[#9CA3AF]" />
              </button>
            </div>
            <div className="px-6 pt-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#3B82F6]" /> From Date
                </label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full h-14 bg-[#111827] border border-[#374151] rounded-xl px-4 text-white focus:outline-none focus:border-[#3B82F6]"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#10B981]" /> To Date
                </label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full h-14 bg-[#111827] border border-[#374151] rounded-xl px-4 text-white focus:outline-none focus:border-[#10B981]"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div className="flex gap-3 pt-2 pb-2">
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="flex-1 h-14 border border-[#374151] rounded-xl font-medium hover:bg-[#374151] text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDateChange(customFrom, customTo);
                    setShowCustomModal(false);
                  }}
                  disabled={!customFrom || !customTo}
                  className="flex-1 h-14 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
