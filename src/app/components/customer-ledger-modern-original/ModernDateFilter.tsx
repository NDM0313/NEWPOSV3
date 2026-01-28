import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

interface ModernDateFilterProps {
  dateRange: { from: string; to: string };
  onApply: (dateRange: { from: string; to: string }) => void;
}

export function ModernDateFilter({ dateRange, onApply }: ModernDateFilterProps) {
  const [from, setFrom] = useState(dateRange.from);
  const [to, setTo] = useState(dateRange.to);
  const [showPresets, setShowPresets] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    const today = new Date('2025-01-27'); // Current app date
    let fromDate = new Date(today);
    let toDate = new Date(today);

    switch (preset) {
      case 'today':
        // Already set to today
        break;
      case 'yesterday':
        fromDate.setDate(today.getDate() - 1);
        toDate.setDate(today.getDate() - 1);
        break;
      case 'last7days':
        fromDate.setDate(today.getDate() - 7);
        break;
      case 'last30days':
        fromDate.setDate(today.getDate() - 30);
        break;
      case 'thisWeek':
        const dayOfWeek = today.getDay();
        fromDate.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        break;
      case 'lastWeek':
        const lastWeekStart = new Date(today);
        const lastWeekEnd = new Date(today);
        const currentDay = today.getDay();
        lastWeekStart.setDate(today.getDate() - (currentDay === 0 ? 13 : currentDay + 6));
        lastWeekEnd.setDate(today.getDate() - (currentDay === 0 ? 7 : currentDay));
        fromDate = lastWeekStart;
        toDate = lastWeekEnd;
        break;
      case 'thisMonth':
        fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth':
        fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        toDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'thisQuarter':
        const currentQuarter = Math.floor(today.getMonth() / 3);
        fromDate = new Date(today.getFullYear(), currentQuarter * 3, 1);
        break;
      case 'thisYear':
        fromDate = new Date(today.getFullYear(), 0, 1);
        break;
      case 'lastYear':
        fromDate = new Date(today.getFullYear() - 1, 0, 1);
        toDate = new Date(today.getFullYear() - 1, 11, 31);
        break;
      case 'all':
        fromDate = new Date('2025-01-01');
        toDate = new Date('2025-01-27');
        break;
    }

    return {
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
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
    return `${new Date(from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${new Date(to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };

  return (
    <div className="flex items-center gap-3" ref={dropdownRef}>
      {/* Quick Presets Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="px-4 py-3 rounded-lg text-sm transition-colors flex items-center gap-2 min-w-[200px] justify-between shadow-sm"
          style={{
            background: '#273548',
            border: '1px solid #334155',
            color: '#ffffff'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: '#94a3b8' }} />
            <span>{getPresetLabel()}</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${showPresets ? 'rotate-180' : ''}`} style={{ color: '#94a3b8' }} />
        </button>

        {showPresets && (
          <div className="absolute top-full left-0 mt-2 rounded-xl shadow-xl z-30 min-w-[280px]" style={{
            background: '#273548',
            border: '1px solid #334155'
          }}>
            <div className="p-2 max-h-[400px] overflow-y-auto">
              <div className="mb-2 px-3 py-2">
                <div className="text-xs uppercase tracking-wide" style={{ color: '#94a3b8' }}>Quick Select</div>
              </div>
              {presetOptions.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.id)}
                  className="w-full px-3 py-2.5 rounded-lg text-left text-sm transition-colors flex items-center gap-3"
                  style={{
                    background: selectedPreset === preset.id ? '#334155' : 'transparent',
                    color: selectedPreset === preset.id ? '#3b82f6' : '#ffffff'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedPreset !== preset.id) {
                      e.currentTarget.style.background = '#1e293b';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedPreset !== preset.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span className="text-lg">{preset.icon}</span>
                  <span>{preset.label}</span>
                  {selectedPreset === preset.id && (
                    <span className="ml-auto" style={{ color: '#3b82f6' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Custom Date Inputs (Only show if custom selected) */}
      {selectedPreset === 'custom' && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#94a3b8' }} />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="pl-10 pr-4 py-3 rounded-lg text-sm focus:outline-none shadow-sm"
                style={{
                  background: '#273548',
                  border: '1px solid #334155',
                  color: '#ffffff'
                }}
              />
            </div>
            <span style={{ color: '#94a3b8' }}>to</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#94a3b8' }} />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="pl-10 pr-4 py-3 rounded-lg text-sm focus:outline-none shadow-sm"
                style={{
                  background: '#273548',
                  border: '1px solid #334155',
                  color: '#ffffff'
                }}
              />
            </div>
          </div>

          <button
            onClick={handleApply}
            className="px-6 py-3 text-white text-sm rounded-lg transition-all shadow-md hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
            }}
          >
            Apply
          </button>
        </>
      )}

      {/* Clear/Reset Button */}
      <button
        onClick={handleClear}
        className="p-3 rounded-lg transition-colors flex items-center justify-center shadow-sm"
        style={{
          background: '#273548',
          color: '#94a3b8',
          border: '1px solid #334155'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#273548'}
        title="Reset to All Time"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
