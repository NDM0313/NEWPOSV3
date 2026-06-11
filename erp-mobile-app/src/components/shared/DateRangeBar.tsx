import { useState } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import {
  buildDateRange,
  DATE_RANGE_PRESET_CHIPS,
  defaultRangeToday,
  type DateRangePreset,
  type DateRangeValue,
} from '../../lib/dateRangePresets';
import { useFiscalYearStart } from '../../context/FiscalYearContext';
import {
  inputHasTime,
  localNowDateString,
  localNowDateTimeString,
  toDateInputValue,
  toDateTimeInputValue,
  toLocalDateString,
} from '../../utils/localDate';

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
    toggleOn: 'bg-white/25 text-white border-white/40',
    toggleOff: 'text-white/50 hover:text-white/80',
  },
  purple: {
    active: 'bg-white text-[#7C3AED]',
    idle: 'bg-white/10 text-white hover:bg-white/20',
    input: 'bg-white/10 border-white/20 text-white',
    label: 'text-white/80',
    toggleOn: 'bg-white/25 text-white border-white/40',
    toggleOff: 'text-white/50 hover:text-white/80',
  },
  dark: {
    active: 'bg-[#3B82F6] text-white',
    idle: 'bg-[#111827] text-[#9CA3AF] border border-[#374151] hover:text-white',
    input: 'bg-[#111827] border-[#374151] text-white',
    label: 'text-[#9CA3AF]',
    toggleOn: 'bg-[#3B82F6]/20 text-[#93C5FD] border-[#3B82F6]/40',
    toggleOff: 'text-[#6B7280] hover:text-[#9CA3AF]',
  },
} as const;

function RangeBoundField({
  label,
  value,
  onChange,
  styles,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  styles: (typeof VARIANT_STYLES)[keyof typeof VARIANT_STYLES];
}) {
  const [timeEnabled, setTimeEnabled] = useState(() => inputHasTime(value));
  const useDateTime = timeEnabled;
  const displayValue = useDateTime
    ? toDateTimeInputValue(value || localNowDateTimeString())
    : toDateInputValue(value || localNowDateString());

  const handleChange = (next: string) => {
    onChange(useDateTime ? next : toLocalDateString(next));
  };

  const toggleTime = () => {
    const next = !timeEnabled;
    setTimeEnabled(next);
    if (next) {
      onChange(toDateTimeInputValue(value || localNowDateTimeString()));
    } else {
      onChange(toDateInputValue(value || localNowDateString()));
    }
  };

  return (
    <div>
      <label className={`text-[10px] flex items-center gap-1 ${styles.label}`}>
        <CalendarDays className="w-3 h-3" /> {label}
      </label>
      <div className="flex items-center gap-1 mt-1">
        <input
          type={useDateTime ? 'datetime-local' : 'date'}
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          className={`flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm ${styles.input} [color-scheme:dark]`}
        />
        <button
          type="button"
          onClick={toggleTime}
          aria-pressed={timeEnabled}
          aria-label={`${label} time set karein`}
          className={`p-2 rounded-lg border shrink-0 transition-colors ${
            timeEnabled ? styles.toggleOn : `${styles.toggleOff} border-transparent`
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

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
  const fiscalYearStart = useFiscalYearStart();
  const hide = new Set(hidePresets ?? []);
  const styles = VARIANT_STYLES[variant];
  const chips = DATE_RANGE_PRESET_CHIPS.filter((c) => !hide.has(c.id));

  const select = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setCustomOpen(true);
      onChange({
        ...buildDateRange('custom', undefined, fiscalYearStart),
        from: value.from || defaultRangeToday(),
        to: value.to || defaultRangeToday(),
      });
    } else {
      setCustomOpen(false);
      onChange(buildDateRange(preset, undefined, fiscalYearStart));
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
          <RangeBoundField
            label="From"
            value={value.from}
            onChange={(from) => onChange({ ...value, from, preset: 'custom' })}
            styles={styles}
          />
          <RangeBoundField
            label="To"
            value={value.to}
            onChange={(to) => onChange({ ...value, to, preset: 'custom' })}
            styles={styles}
          />
        </div>
      )}
    </div>
  );
}

export function makeInitialRange(preset: DateRangePreset = 'month'): DateRangeValue {
  return buildDateRange(preset);
}
