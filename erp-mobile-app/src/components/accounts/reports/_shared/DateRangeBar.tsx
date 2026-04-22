import { useState } from 'react';
import { CalendarDays } from 'lucide-react';

export type DateRangePreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

export interface DateRangeValue {
  from: string;
  to: string;
  preset: DateRangePreset;
}

export interface DateRangeBarProps {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  hidePresets?: DateRangePreset[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildRange(preset: DateRangePreset): DateRangeValue {
  const today = new Date();
  const to = toIso(today);
  const from = new Date(today);
  switch (preset) {
    case 'today':
      return { from: to, to, preset };
    case 'week': {
      const day = from.getDay();
      from.setDate(from.getDate() - day);
      return { from: toIso(from), to, preset };
    }
    case 'month':
      from.setDate(1);
      return { from: toIso(from), to, preset };
    case 'quarter': {
      const m = from.getMonth();
      from.setMonth(m - (m % 3), 1);
      return { from: toIso(from), to, preset };
    }
    case 'year':
      from.setMonth(0, 1);
      return { from: toIso(from), to, preset };
    case 'all':
      return { from: '', to: '', preset };
    case 'custom':
    default:
      return { from: to, to, preset };
  }
}

export function makeInitialRange(preset: DateRangePreset = 'month'): DateRangeValue {
  return buildRange(preset);
}

/**
 * Compact date range selector with preset chips + custom range drawer. Used at
 * the top of every report so filter UX stays consistent.
 */
export function DateRangeBar({ value, onChange, hidePresets }: DateRangeBarProps) {
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom');
  const hide = new Set(hidePresets ?? []);

  const allChips: { id: DateRangePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This week' },
    { id: 'month', label: 'This month' },
    { id: 'quarter', label: 'Quarter' },
    { id: 'year', label: 'This year' },
    { id: 'all', label: 'All time' },
    { id: 'custom', label: 'Custom' },
  ];
  const chips = allChips.filter((c) => !hide.has(c.id));

  const select = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setCustomOpen(true);
      onChange({ ...buildRange(preset), from: value.from || todayIso(), to: value.to || todayIso() });
    } else {
      setCustomOpen(false);
      onChange(buildRange(preset));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
        {chips.map((c) => (
          <button
            key={c.id}
            onClick={() => select(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              value.preset === c.id
                ? 'bg-white text-[#4F46E5]'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {(customOpen || value.preset === 'custom') && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-[10px] text-white/80 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> From
            </label>
            <input
              type="date"
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value, preset: 'custom' })}
              className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/80 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> To
            </label>
            <input
              type="date"
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value, preset: 'custom' })}
              className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
