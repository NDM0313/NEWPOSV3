import React from 'react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import { cn } from '@/app/components/ui/utils';
import {
  BARCODE_LABEL_PRESETS,
  gridSummary,
  presetIdFromLayout,
  type BarcodeLabelPresetId,
} from '@/app/lib/barcodeLabelPresets';
import { gridRowsForSheet } from './barcodeLabelPreview';

export type LabelFieldOptions = {
  showName: boolean;
  showPrice: boolean;
  showVariation: boolean;
  showPacking: boolean;
  showCompany: boolean;
  showBranch: boolean;
};

type OptionRowProps = {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
};

function OptionRow({ id, checked, onCheckedChange, label }: OptionRowProps) {
  return (
    <div className="flex items-start gap-3 w-full text-left">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        className="mt-0.5 shrink-0 border-gray-500 data-[state=checked]:bg-blue-600"
      />
      <Label htmlFor={id} className="flex-1 min-w-0 text-sm font-normal leading-snug text-gray-300 cursor-pointer pt-0.5">
        {label}
      </Label>
    </div>
  );
}

export function BarcodeLabelContentFields({
  idPrefix,
  options,
  onChange,
  companyName,
  branchName,
}: {
  idPrefix: string;
  options: LabelFieldOptions;
  onChange: (patch: Partial<LabelFieldOptions>) => void;
  companyName?: string;
  branchName?: string;
}) {
  return (
    <div className="space-y-2.5">
      <OptionRow
        id={`${idPrefix}-name`}
        checked={options.showName}
        onCheckedChange={(v) => onChange({ showName: v })}
        label="Show product name"
      />
      <OptionRow
        id={`${idPrefix}-var`}
        checked={options.showVariation}
        onCheckedChange={(v) => onChange({ showVariation: v })}
        label="Show variation"
      />
      <OptionRow
        id={`${idPrefix}-price`}
        checked={options.showPrice}
        onCheckedChange={(v) => onChange({ showPrice: v })}
        label="Show price"
      />
      <OptionRow
        id={`${idPrefix}-pack`}
        checked={options.showPacking}
        onCheckedChange={(v) => onChange({ showPacking: v })}
        label="Show packing details"
      />
      <OptionRow
        id={`${idPrefix}-co`}
        checked={options.showCompany}
        onCheckedChange={(v) => onChange({ showCompany: v })}
        label={`Show company name${companyName ? ` (${companyName})` : ''}`}
      />
      <OptionRow
        id={`${idPrefix}-br`}
        checked={options.showBranch}
        onCheckedChange={(v) => onChange({ showBranch: v })}
        label={`Show branch name${branchName ? ` (${branchName})` : ''}`}
      />
    </div>
  );
}

export function BarcodeLabelSheetLayoutFields({
  presetId,
  onPresetChange,
  a4Columns,
  onA4ColumnsChange,
  maxLabelsPerSheet,
  onMaxLabelsPerSheetChange,
}: {
  presetId: BarcodeLabelPresetId;
  onPresetChange: (id: BarcodeLabelPresetId) => void;
  a4Columns: number;
  onA4ColumnsChange: (n: number) => void;
  maxLabelsPerSheet: number;
  onMaxLabelsPerSheetChange: (n: number) => void;
}) {
  const gridRows = gridRowsForSheet(maxLabelsPerSheet, a4Columns);
  const preset = BARCODE_LABEL_PRESETS.find((p) => p.id === presetId);

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-gray-400">Sheet preset</Label>
        <select
          value={presetId}
          onChange={(e) => {
            const id = e.target.value as BarcodeLabelPresetId;
            onPresetChange(id);
            const p = BARCODE_LABEL_PRESETS.find((x) => x.id === id);
            if (p && id !== 'custom') {
              onA4ColumnsChange(p.a4Columns);
              onMaxLabelsPerSheetChange(p.maxLabelsPerSheet);
            }
          }}
          className="mt-1 w-full h-9 rounded bg-gray-950 border border-gray-700 text-white text-sm px-2"
        >
          {BARCODE_LABEL_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {preset?.description ? (
          <p className="text-[10px] text-gray-500 mt-1 leading-snug">{preset.description}</p>
        ) : null}
      </div>
      <div className="flex gap-1">
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              onA4ColumnsChange(n);
              onPresetChange(presetIdFromLayout(n, maxLabelsPerSheet));
            }}
            className={cn(
              'flex-1 py-1.5 rounded text-xs font-medium border transition-colors',
              a4Columns === n
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
            )}
          >
            {n} cols
          </button>
        ))}
      </div>
      <div>
        <Label className="text-xs text-gray-400">Labels per A4 page</Label>
        <input
          type="number"
          min={6}
          max={60}
          value={maxLabelsPerSheet}
          onChange={(e) => {
            const n = Math.max(6, Math.min(60, parseInt(e.target.value, 10) || 30));
            onMaxLabelsPerSheetChange(n);
            onPresetChange(presetIdFromLayout(a4Columns, n));
          }}
          className="mt-1 w-full h-9 rounded bg-gray-950 border border-gray-700 text-white text-sm px-2"
        />
        <p className="text-[10px] text-gray-500 mt-1">{gridSummary(a4Columns, maxLabelsPerSheet)}</p>
        <p className="text-[10px] text-gray-600 mt-0.5">
          Grid ≈ {a4Columns} columns × {gridRows} rows
        </p>
      </div>
    </div>
  );
}
