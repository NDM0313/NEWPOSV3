import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { mergeWithDefaults, type CompanyPrintingSettings } from '@/app/types/printingSettings';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  ALL_LEDGER_COLUMN_KEYS,
  DEFAULT_LEDGER_PRINT_COLUMN_KEYS,
  LEDGER_COLUMN_CATALOG,
  getHiddenLedgerColumnKeys,
  getSavedLedgerColumnKeys,
  validateLedgerColumnLayout,
  defaultLedgerColumnWidths,
  type LedgerColumnKey,
} from '@/app/components/reports/shared/ledgerColumnLayout';

interface LedgerColumnLayoutEditorProps {
  settings: CompanyPrintingSettings | null;
  onSettingsChange: (partial: Partial<CompanyPrintingSettings>) => void;
}

export function LedgerColumnLayoutEditor({ settings, onSettingsChange }: LedgerColumnLayoutEditorProps) {
  const merged = mergeWithDefaults(settings);
  const visibleKeys = getSavedLedgerColumnKeys(settings);
  const hiddenKeys = getHiddenLedgerColumnKeys(settings);
  const widths = merged.reportExport.ledgerColumnWidths ?? {};
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const validation = useMemo(
    () => validateLedgerColumnLayout(visibleKeys, widths),
    [visibleKeys, widths],
  );

  const patchReportExport = (patch: Partial<typeof merged.reportExport>) => {
    setBlockedMessage(null);
    onSettingsChange({
      reportExport: { ...merged.reportExport, ...patch },
    });
  };

  const setVisibleKeys = (keys: LedgerColumnKey[], actionLabel?: string) => {
    const v = validateLedgerColumnLayout(keys, widths);
    if (!v.valid) {
      setBlockedMessage(v.errors[0] ?? `Cannot ${actionLabel ?? 'update'} column layout.`);
      return;
    }
    patchReportExport({ ledgerPrintColumns: keys });
  };

  const setWidth = (key: LedgerColumnKey, value: number) => {
    patchReportExport({
      ledgerColumnWidths: {
        ...widths,
        [key]: Math.min(50, Math.max(5, value)),
      },
    });
  };

  const moveColumn = (index: number, dir: -1 | 1) => {
    const next = [...visibleKeys];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setVisibleKeys(next);
  };

  const removeColumn = (key: LedgerColumnKey) => {
    if (LEDGER_COLUMN_CATALOG[key].required) {
      setBlockedMessage('Balance column is required and cannot be removed.');
      return;
    }
    setVisibleKeys(visibleKeys.filter((k) => k !== key), 'remove column');
  };

  const addColumn = (key: LedgerColumnKey) => {
    if (visibleKeys.includes(key)) return;
    setVisibleKeys([...visibleKeys, key]);
  };

  const resetLayout = () => {
    onSettingsChange({
      reportExport: {
        ...merged.reportExport,
        ledgerPrintColumns: [...DEFAULT_LEDGER_PRINT_COLUMN_KEYS],
        ledgerColumnWidths: defaultLedgerColumnWidths(),
      },
    });
  };

  const widthTotal = visibleKeys.reduce((s, k) => s + (widths[k] ?? 0), 0);
  const splitAt = Math.ceil(visibleKeys.length / 2);
  const leftColumnKeys = visibleKeys.slice(0, splitAt);
  const rightColumnKeys = visibleKeys.slice(splitAt);

  const renderColumnRow = (key: LedgerColumnKey, index: number) => {
    const def = LEDGER_COLUMN_CATALOG[key];
    return (
      <div
        key={key}
        className="flex flex-wrap items-center gap-2 rounded-md border border-gray-800 bg-gray-900/60 px-2 py-1.5"
      >
        <span className="text-sm text-white min-w-[80px] flex-1">{def.label}</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400"
            disabled={index === 0}
            onClick={() => moveColumn(index, -1)}
            title="Move up"
          >
            <ChevronUp size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400"
            disabled={index === visibleKeys.length - 1}
            onClick={() => moveColumn(index, 1)}
            title="Move down"
          >
            <ChevronDown size={14} />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-[10px] text-gray-500 sr-only">Width</Label>
          <Input
            type="number"
            min={5}
            max={50}
            value={widths[key] ?? ''}
            placeholder="auto"
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setWidth(key, v);
              else {
                const next = { ...widths };
                delete next[key];
                patchReportExport({ ledgerColumnWidths: next });
              }
            }}
            className="h-8 w-16 bg-gray-800 border-gray-700 text-white text-xs"
          />
          <span className="text-[10px] text-gray-500">%</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-400/80 hover:text-red-400"
          disabled={def.required}
          onClick={() => removeColumn(key)}
          title={def.required ? 'Required column' : 'Remove column'}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/80 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Column layout</p>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-gray-400" onClick={resetLayout}>
          <RotateCcw size={12} className="mr-1" />
          Reset
        </Button>
      </div>

      <p className="text-[11px] text-gray-500">
        Reorder, hide, or resize columns. Width % per column (5–50). Balance column is required. Preview updates live.
      </p>

      {validation.errors.length > 0 ? (
        <div className="text-xs text-red-400 space-y-0.5">
          {validation.errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      ) : null}
      {blockedMessage ? <div className="text-xs text-red-400">{blockedMessage}</div> : null}
      {validation.warnings.length > 0 ? (
        <div className="text-xs text-amber-400/90 space-y-0.5">
          {validation.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2 min-w-0">
          {leftColumnKeys.map((key, i) => renderColumnRow(key, i))}
        </div>
        <div className="space-y-2 min-w-0">
          {rightColumnKeys.map((key, i) => renderColumnRow(key, splitAt + i))}
        </div>
      </div>

      {hiddenKeys.length > 0 ? (
        <div className="pt-1 border-t border-gray-800">
          <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">Add column</p>
          <div className="flex flex-wrap gap-2">
            {hiddenKeys.map((key) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs border-gray-700 text-gray-300"
                onClick={() => addColumn(key)}
              >
                <Plus size={12} className="mr-1" />
                {LEDGER_COLUMN_CATALOG[key].label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-[10px] text-gray-600">
        Specified widths: {widthTotal > 0 ? `${widthTotal}%` : 'auto (equal split)'} · {visibleKeys.length} visible /{' '}
        {ALL_LEDGER_COLUMN_KEYS.length} available
      </p>
    </div>
  );
}
