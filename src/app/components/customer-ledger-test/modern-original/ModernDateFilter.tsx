import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { getTodayInAppTimezone, formatDateToYYYYMMDD, getTodayYYYYMMDD, formatLongDate } from '@/app/components/ui/utils';

interface ModernDateFilterProps {
  dateRange: { from: string; to: string };
  onApply: (dateRange: { from: string; to: string }) => void;
  /** Initial preset to show (e.g. 'last30days'). Default: 'last30days' */
  defaultPreset?: string;
}

export function ModernDateFilter({ dateRange, onApply, defaultPreset = 'last30days' }: ModernDateFilterProps) {
  const [from, setFrom] = useState(dateRange.from);
  const [to, setTo] = useState(dateRange.to);
  const [showPresets, setShowPresets] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>(defaultPreset);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFrom(dateRange.from);
    setTo(dateRange.to);
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPresets(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDateRange = (preset: string) => {
    const today = getTodayInAppTimezone();
    const todayTime = today.getTime();
    const msPerDay = 24 * 60 * 60 * 1000;

    let fromDate: Date;
    let toDate: Date;

    switch (preset) {
      case 'today':
        fromDate = today;
        toDate = today;
        break;
      case 'yesterday':
        fromDate = new Date(todayTime - msPerDay);
        toDate = new Date(todayTime - msPerDay);
        break;
      case 'last7days':
        fromDate = new Date(todayTime - 7 * msPerDay);
        toDate = today;
        break;
      case 'last30days':
        fromDate = new Date(todayTime - 30 * msPerDay);
        toDate = today;
        break;
      case 'thisWeek': {
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        fromDate = new Date(todayTime - mondayOffset * msPerDay);
        toDate = today;
        break;
      }
      case 'lastWeek': {
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const lastMonday = new Date(todayTime - (mondayOffset + 7) * msPerDay);
        const lastSunday = new Date(todayTime - (mondayOffset + 1) * msPerDay);
        fromDate = lastMonday;
        toDate = lastSunday;
        break;
      }
      case 'thisMonth': {
        const ymd = getTodayYYYYMMDD();
        const [y, m] = ymd.split('-').map(Number);
        return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: ymd };
      }
      case 'lastMonth': {
        const ymd = getTodayYYYYMMDD();
        const [y, m] = ymd.split('-').map(Number);
        const lastM = m === 1 ? 12 : m - 1;
        const lastY = m === 1 ? y - 1 : y;
        const lastMonthLastDay = new Date(lastY, lastM, 0);
        const lastDay = formatDateToYYYYMMDD(lastMonthLastDay);
        return { from: `${lastY}-${String(lastM).padStart(2, '0')}-01`, to: lastDay };
      }
      case 'thisQuarter': {
        const ymd = getTodayYYYYMMDD();
        const [y, m] = ymd.split('-').map(Number);
        const q = Math.floor((m - 1) / 3);
        return { from: `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`, to: ymd };
      }
      case 'thisYear':
        return { from: `${getTodayYYYYMMDD().slice(0, 4)}-01-01`, to: getTodayYYYYMMDD() };
      case 'lastYear': {
        const y = parseInt(getTodayYYYYMMDD().slice(0, 4), 10) - 1;
        return { from: `${y}-01-01`, to: `${y}-12-31` };
      }
      case 'all': {
        const y = getTodayYYYYMMDD().slice(0, 4);
        return { from: `${y}-01-01`, to: getTodayYYYYMMDD() };
      }
      default:
        fromDate = today;
        toDate = today;
    }

    return {
      from: formatDateToYYYYMMDD(fromDate),
      to: formatDateToYYYYMMDD(toDate),
    };
  };

  const presetOptions = [
    { id: 'today', label: 'Today', icon: '📅' },
    { id: 'yesterday', label: 'Yesterday', icon: '📆' },
    { id: 'last7days', label: 'Last 7 Days', icon: '📊' },
    { id: 'last30days', label: 'Last 30 Days', icon: '📈' },
    { id: 'thisWeek', label: 'This Week', icon: '🗓️' },
    { id: 'lastWeek', label: 'Last Week', icon: '📋' },
    { id: 'thisMonth', label: 'This Month', icon: '🗒️' },
    { id: 'lastMonth', label: 'Last Month', icon: '📄' },
    { id: 'thisQuarter', label: 'This Quarter', icon: '📊' },
    { id: 'thisYear', label: 'This Year', icon: '📅' },
    { id: 'lastYear', label: 'Last Year', icon: '🗓️' },
    { id: 'all', label: 'All Time', icon: '🌐' },
    { id: 'custom', label: 'Custom Range', icon: '⚙️' },
  ];

  const handlePresetClick = (presetId: string) => {
    setSelectedPreset(presetId);

    if (presetId === 'custom') {
      setShowPresets(false);
      return;
    }

    const range = getDateRange(presetId);
    setFrom(range.from);
    setTo(range.to);
    onApply(range);
    setShowPresets(false);
  };

  const handleApply = () => {
    if (from && to) {
      onApply({ from, to });
      setSelectedPreset('custom');
    }
  };

  const handleClear = () => {
    const range = getDateRange('all');
    setFrom(range.from);
    setTo(range.to);
    onApply(range);
    setSelectedPreset('all');
  };

  const getPresetLabel = () => {
    const preset = presetOptions.find(p => p.id === selectedPreset);
    if (preset && preset.id !== 'custom') {
      return preset.label;
    }
    return `${formatLongDate(from)} - ${formatLongDate(to)}`;
  };

  return (
    <div className="flex items-center gap-3" ref={dropdownRef}>
      <div className="relative">
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="px-4 py-3 rounded-lg text-sm transition-colors flex items-center gap-2 min-w-[200px] justify-between shadow-sm bg-gray-900 border border-gray-700 text-white hover:border-gray-600"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span>{getPresetLabel()}</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform text-gray-400 ${showPresets ? 'rotate-180' : ''}`} />
        </button>

        {showPresets && (
          <div className="absolute top-full left-0 mt-2 rounded-lg shadow-2xl z-30 min-w-[280px] bg-gray-900 border border-gray-700">
            <div className="p-2 max-h-[400px] overflow-y-auto">
              <div className="mb-2 px-3 py-2">
                <div className="text-xs uppercase tracking-wide font-semibold text-gray-500">Quick Select</div>
              </div>
              {presetOptions.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.id)}
                  className={`w-full px-3 py-2.5 rounded-lg text-left text-sm transition-colors flex items-center gap-3 ${
                    selectedPreset === preset.id ? 'bg-gray-800 text-blue-400' : 'bg-transparent text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  <span className="text-lg">{preset.icon}</span>
                  <span>{preset.label}</span>
                  {selectedPreset === preset.id && (
                    <span className="ml-auto text-blue-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedPreset === 'custom' && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-500" />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="pl-10 pr-4 py-3 rounded-lg text-sm focus:outline-none shadow-sm bg-gray-900 border border-gray-700 text-white focus:border-gray-600"
              />
            </div>
            <span className="text-gray-500">to</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-500" />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="pl-10 pr-4 py-3 rounded-lg text-sm focus:outline-none shadow-sm bg-gray-900 border border-gray-700 text-white focus:border-gray-600"
              />
            </div>
          </div>
          <button
            onClick={handleApply}
            className="px-6 py-3 text-sm rounded-lg transition-colors bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            Apply
          </button>
        </>
      )}

      <button
        onClick={handleClear}
        className="p-3 rounded-lg transition-colors flex items-center justify-center shadow-sm bg-gray-900 border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white"
        title="Reset to All Time"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
