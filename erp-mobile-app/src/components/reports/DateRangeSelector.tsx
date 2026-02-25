import { useState } from 'react';
import { Calendar, X, FileDown, Share2 } from 'lucide-react';

interface DateRangeSelectorProps {
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
  /** Optional: show Export PDF button (e.g. calls window.print) */
  onExportPDF?: () => void;
  /** Optional: show Share button (e.g. share report summary) */
  onShare?: () => void;
}

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'lastYear' | 'custom';

function toDisplayDate(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function DateRangeSelector({ dateFrom, dateTo, onDateChange, onExportPDF, onShare }: DateRangeSelectorProps) {
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
    if (preset === 'custom') {
      setCustomFrom(dateFrom);
      setCustomTo(dateTo);
      setShowCustomModal(true);
    } else {
      const { from, to } = getDateRange(preset);
      onDateChange(from, to);
    }
  };

  const applyCustomRange = () => {
    if (!customFrom || !customTo) return;
    setSelectedPreset('custom');
    onDateChange(customFrom, customTo);
    setShowCustomModal(false);
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
      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-[#3B82F6] shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-white">{getPresetLabel()}</span>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {toDisplayDate(dateFrom)} — {toDisplayDate(dateTo)}
            </p>
          </div>
          {(onExportPDF != null || onShare != null) && (
            <div className="flex items-center gap-1 shrink-0">
              {onExportPDF != null && (
                <button
                  type="button"
                  onClick={onExportPDF}
                  className="p-2 rounded-lg bg-[#111827] text-[#9CA3AF] hover:bg-[#374151] hover:text-white transition-colors"
                  title="Export PDF / Print"
                >
                  <FileDown className="w-4 h-4" />
                </button>
              )}
              {onShare != null && (
                <button
                  type="button"
                  onClick={onShare}
                  className="p-2 rounded-lg bg-[#111827] text-[#9CA3AF] hover:bg-[#374151] hover:text-white transition-colors"
                  title="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetChange(preset.id)}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                selectedPreset === preset.id ? 'bg-[#3B82F6] text-white shadow-md' : 'bg-[#111827] text-[#9CA3AF] hover:bg-[#374151] active:scale-[0.98]'
              }`}
            >
              <span aria-hidden>{preset.icon}</span>
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
              <p className="text-xs text-[#9CA3AF]">Pick start and end date for your report.</p>
              <div>
                <label className="block text-sm font-medium text-white mb-2">From date</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-xl px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">To date</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-xl px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div className="flex gap-3 pt-2 pb-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="flex-1 h-12 border border-[#374151] rounded-xl font-medium hover:bg-[#374151] text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyCustomRange}
                  disabled={!customFrom || !customTo || customFrom > customTo}
                  className="flex-1 h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply range
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
