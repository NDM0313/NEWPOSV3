import { useEffect, useState } from 'react';
import { DateInputField } from './DateTimePicker';
import {
  buildDateRange,
  DATE_RANGE_PRESET_CHIPS,
  defaultRangeToday,
  type DateRangePreset,
  type DateRangeValue,
} from '../../lib/dateRangePresets';
import { resolveFiscalYearConfig } from '../../api/fiscalYearConfig';
import type { FiscalYearConfig } from '../../utils/financialYear';

export type { DateRangePreset, DateRangeValue };

export interface DateRangeBarProps {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  hidePresets?: DateRangePreset[];
  /** Keep these chips first (e.g. `all` for ledgers) so full history is one tap away. */
  pinPresets?: DateRangePreset[];
  /** Report gradient header (default) vs dark module chrome vs rental purple header */
  variant?: 'gradient' | 'dark' | 'purple';
  companyId?: string | null;
  branchId?: string | null;
  fiscalYearConfig?: FiscalYearConfig | null;
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
  pinPresets,
  variant = 'gradient',
  companyId,
  branchId,
  fiscalYearConfig: fiscalYearConfigProp,
}: DateRangeBarProps) {
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom');
  const [loadedFiscalYearConfig, setLoadedFiscalYearConfig] = useState<FiscalYearConfig | null>(null);
  const hide = new Set(hidePresets ?? []);
  const styles = VARIANT_STYLES[variant];
  const pinOrder = pinPresets ?? [];
  const chips = (() => {
    const visible = DATE_RANGE_PRESET_CHIPS.filter((c) => !hide.has(c.id));
    if (!pinOrder.length) return visible;
    const pinned = pinOrder
      .map((id) => visible.find((c) => c.id === id))
      .filter((c): c is (typeof DATE_RANGE_PRESET_CHIPS)[number] => Boolean(c));
    const pinnedIds = new Set(pinned.map((c) => c.id));
    return [...pinned, ...visible.filter((c) => !pinnedIds.has(c.id))];
  })();
  const fiscalYearConfig = fiscalYearConfigProp ?? loadedFiscalYearConfig;

  useEffect(() => {
    if (fiscalYearConfigProp) {
      setLoadedFiscalYearConfig(fiscalYearConfigProp);
      return;
    }
    if (!companyId) {
      setLoadedFiscalYearConfig(null);
      return;
    }
    let cancelled = false;
    resolveFiscalYearConfig(companyId, branchId)
      .then((cfg) => {
        if (!cancelled) setLoadedFiscalYearConfig(cfg);
      })
      .catch(() => {
        if (!cancelled) setLoadedFiscalYearConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, fiscalYearConfigProp]);

  useEffect(() => {
    if (!fiscalYearConfig) return;
    if (value.preset !== 'currentFinancialYear' && value.preset !== 'lastFinancialYear') return;
    const next = buildDateRange(value.preset, undefined, fiscalYearConfig);
    if (next.from === value.from && next.to === value.to) return;
    onChange(next);
  }, [fiscalYearConfig, value.preset, value.from, value.to, onChange]);

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
      onChange(buildDateRange(preset, undefined, fiscalYearConfig));
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
          <DateInputField
            label="From"
            value={value.from}
            onChange={(from) => onChange({ ...value, from, preset: 'custom' })}
          />
          <DateInputField
            label="To"
            value={value.to}
            onChange={(to) => onChange({ ...value, to, preset: 'custom' })}
          />
        </div>
      )}
    </div>
  );
}

export function makeInitialRange(preset: DateRangePreset = 'currentFinancialYear'): DateRangeValue {
  return buildDateRange(preset);
}
