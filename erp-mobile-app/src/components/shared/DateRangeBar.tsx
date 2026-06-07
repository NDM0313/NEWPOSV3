import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import {
  buildDateRange,
  DATE_RANGE_PRESET_CHIPS,
  defaultRangeToday,
  type DateRangePreset,
  type DateRangeValue,
} from '../../lib/dateRangePresets';

export type { DateRangePreset, DateRangeValue };

export interface DateRangeBarProps {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  hidePresets?: DateRangePreset[];
  /** Report gradient header (default) vs dark module chrome vs rental purple header */
  variant?: 'gradient' | 'dark' | 'purple';
}

const VARIANT_STYLES = {
  gradient: {
    active: 'bg-white text-[#4F46E5]',
    idle: 'bg-white/10 text-white hover:bg-white/20',
    input: 'bg-white/10 border-white/20 text-white',
    label: 'text-white/80',
  },
  purple: {
    active: 'bg-white text-[#7C3AED]',
    idle: 'bg-white/10 text-white hover:bg-white/20',
    input: 'bg-white/10 border-white/20 text-white',
    label: 'text-white/80',
  },
  dark: {
    active: 'bg-[#3B82F6] text-white',
    idle: 'bg-[#111827] text-[#9CA3AF] border border-[#374151] hover:text-white',
    input: 'bg-[#111827] border-[#374151] text-white',
    label: 'text-[#9CA3AF]',
  },
} as const;

/**
 * Shared date-range chips + optional custom range. Use on every screen that
 * filters by period so presets stay aligned with web (Sat–Fri this/last week).
 */
export function DateRangeBar({
  value,
  onChange,
  hidePresets,
  variant = 'gradient',
}: DateRangeBarProps) {
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom');
  const hide = new Set(hidePresets ?? []);
  const styles = VARIANT_STYLES[variant];
  const chips = DATE_RANGE_PRESET_CHIPS.filter((c) => !hide.has(c.id));

  const select = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setCustomOpen(true);
      onChange({
        ...buildDateRange('custom'),
        from: value.from || defaultRangeToday(),
        to: value.to || defaultRangeToday(),
      });
    } else {
      setCustomOpen(false);
      onChange(buildDateRange(preset));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => select(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              value.preset === c.id ? styles.active : styles.idle
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {(customOpen || value.preset === 'custom') && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className={`text-[10px] flex items-center gap-1 ${styles.label}`}>
              <CalendarDays className="w-3 h-3" /> From
            </label>
            <input
              type="date"
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value, preset: 'custom' })}
              className={`w-full mt-1 px-3 py-2 border rounded-lg text-sm ${styles.input}`}
            />
          </div>
          <div>
            <label className={`text-[10px] flex items-center gap-1 ${styles.label}`}>
              <CalendarDays className="w-3 h-3" /> To
            </label>
            <input
              type="date"
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value, preset: 'custom' })}
              className={`w-full mt-1 px-3 py-2 border rounded-lg text-sm ${styles.input}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function makeInitialRange(preset: DateRangePreset = 'month'): DateRangeValue {
  return buildDateRange(preset);
}
