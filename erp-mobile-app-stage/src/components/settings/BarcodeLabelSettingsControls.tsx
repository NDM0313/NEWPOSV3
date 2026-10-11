import { useLayoutEffect, useRef, useState } from 'react';
import {
  BARCODE_LABEL_PRESETS,
  clampLabelHeightMm,
  clampLabelWidthMm,
  cmToMm,
  fitLabelsOnA4Page,
  gridSummary,
  mmToCm,
  presetIdFromLayout,
  stickerSizeSummary,
  type BarcodeLabelPresetId,
} from '../../lib/barcodeLabelPresets';

const CHECKBOX_CLASS =
  'w-4 h-4 shrink-0 mt-0.5 rounded border-[#4B5563] bg-[#374151] text-[#3B82F6] focus:ring-[#3B82F6] focus:ring-offset-0';

const INPUT_CLASS =
  'mt-1 w-full h-9 rounded-lg bg-[#111827] border border-[#374151] text-white text-sm px-2 disabled:opacity-50';

export type LabelLayoutPatch = {
  a4Columns?: number;
  maxLabelsPerSheet?: number;
  useFixedLabelSize?: boolean;
  labelWidthMm?: number;
  labelHeightMm?: number;
};

export type LabelContentFlags = {
  showName: boolean;
  showPrice: boolean;
  showVariation: boolean;
  showPacking: boolean;
  showCompanyName: boolean;
  showBranchName: boolean;
};

/** Compact true-size sticker preview (mm frame + overflow hint). */
export function MobileBarcodeLabelSizePreview({
  widthMm,
  heightMm,
  showName,
  showPrice,
  showCompany,
  companyName,
}: {
  widthMm: number;
  heightMm: number;
  showName: boolean;
  showPrice: boolean;
  showCompany: boolean;
  companyName?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const maxW = 220;
  const pxPerMm = maxW / Math.max(1, widthMm);
  const frameW = Math.round(widthMm * pxPerMm);
  const frameH = Math.round(heightMm * pxPerMm);
  const short = heightMm <= 30;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    setOverflows(content.scrollHeight > frame.clientHeight + 2);
  }, [widthMm, heightMm, showName, showPrice, showCompany, companyName]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-[10px] text-[#6B7280]">
        {widthMm}×{heightMm} mm ({mmToCm(widthMm)}×{mmToCm(heightMm)} cm)
      </p>
      <div
        ref={frameRef}
        className={`bg-white text-black rounded border-2 border-dashed text-center overflow-visible box-border ${
          overflows ? 'border-amber-500' : 'border-gray-400'
        }`}
        style={{ width: frameW, height: frameH }}
      >
        <div
          ref={contentRef}
          className={`flex flex-col items-center justify-start px-1 py-0.5 space-y-px ${
            short ? 'text-[8px]' : 'text-[10px]'
          }`}
        >
          {showCompany && companyName ? (
            <p className="font-bold uppercase text-gray-500 truncate w-full text-[7px]">{companyName}</p>
          ) : null}
          {showName ? (
            <p className="font-bold leading-tight line-clamp-2 w-full">SAMPLE PRODUCT /1012</p>
          ) : null}
          <div className="flex justify-center gap-px my-0.5">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="bg-black" style={{ width: 1, height: short ? 10 : 16 }} />
            ))}
          </div>
          <p className="font-mono text-[7px]">PRD-0048-2</p>
          {showPrice ? <p className="font-bold text-[8px]">Rs. 12,750</p> : null}
        </div>
      </div>
      {overflows ? (
        <p className="text-[10px] text-amber-300 text-center leading-snug px-2">
          Content may not fit this sticker — print will clip overflow.
        </p>
      ) : null}
    </div>
  );
}

export function MobileBarcodeLabelContentToggles({
  flags,
  disabled,
  companyName,
  branchName,
  onChange,
}: {
  flags: LabelContentFlags;
  disabled?: boolean;
  companyName?: string;
  branchName?: string;
  onChange: (patch: Partial<LabelContentFlags>) => void;
}) {
  const rows: { key: keyof LabelContentFlags; label: string }[] = [
    { key: 'showName', label: 'Show product name' },
    { key: 'showVariation', label: 'Show variation' },
    { key: 'showPrice', label: 'Show price' },
    { key: 'showPacking', label: 'Show packing details' },
    {
      key: 'showCompanyName',
      label: `Show company name${companyName ? ` (${companyName})` : ''}`,
    },
    {
      key: 'showBranchName',
      label: `Show branch name${branchName ? ` (${branchName})` : ''}`,
    },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map(({ key, label }) => (
        <label key={key} className="flex items-start gap-3 w-full text-left cursor-pointer">
          <input
            type="checkbox"
            checked={flags[key]}
            disabled={disabled}
            onChange={(e) => onChange({ [key]: e.target.checked })}
            className={CHECKBOX_CLASS}
          />
          <span className="flex-1 min-w-0 text-sm leading-snug text-[#E5E7EB] pt-0.5">{label}</span>
        </label>
      ))}
    </div>
  );
}

export function MobileBarcodeLabelSheetControls({
  a4Columns,
  maxLabelsPerSheet,
  useFixedLabelSize,
  labelWidthMm,
  labelHeightMm,
  disabled,
  onChange,
}: {
  a4Columns: number;
  maxLabelsPerSheet: number;
  useFixedLabelSize: boolean;
  labelWidthMm: number;
  labelHeightMm: number;
  disabled?: boolean;
  onChange: (patch: LabelLayoutPatch) => void;
}) {
  const presetId = presetIdFromLayout(a4Columns, maxLabelsPerSheet, {
    useFixedLabelSize,
    labelWidthMm,
    labelHeightMm,
  });
  const widthCm = mmToCm(labelWidthMm);
  const heightCm = mmToCm(labelHeightMm);

  const applyPreset = (id: BarcodeLabelPresetId) => {
    const p = BARCODE_LABEL_PRESETS.find((x) => x.id === id);
    if (!p || id === 'custom') return;
    const patch: LabelLayoutPatch = {
      a4Columns: p.a4Columns,
      maxLabelsPerSheet: p.maxLabelsPerSheet,
    };
    if (p.useFixedLabelSize && p.labelWidthMm != null && p.labelHeightMm != null) {
      patch.useFixedLabelSize = true;
      patch.labelWidthMm = p.labelWidthMm;
      patch.labelHeightMm = p.labelHeightMm;
    } else {
      patch.useFixedLabelSize = false;
    }
    onChange(patch);
  };

  const applyFit = () => {
    const fit = fitLabelsOnA4Page({ widthMm: labelWidthMm, heightMm: labelHeightMm });
    onChange({
      useFixedLabelSize: true,
      a4Columns: fit.a4Columns,
      maxLabelsPerSheet: fit.maxLabelsPerSheet,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-[#9CA3AF]">Sheet preset</p>
        <select
          value={presetId}
          disabled={disabled}
          onChange={(e) => applyPreset(e.target.value as BarcodeLabelPresetId)}
          className={INPUT_CLASS}
        >
          {BARCODE_LABEL_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={useFixedLabelSize}
          disabled={disabled}
          onChange={(e) => onChange({ useFixedLabelSize: e.target.checked })}
          className={CHECKBOX_CLASS}
        />
        <span className="text-sm text-[#E5E7EB] pt-0.5">Use fixed sticker size (cm)</span>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-[#9CA3AF]">Width (cm)</p>
          <input
            type="number"
            min={2}
            max={12}
            step={0.1}
            disabled={disabled || !useFixedLabelSize}
            value={widthCm}
            onChange={(e) => {
              const cm = parseFloat(e.target.value);
              if (!Number.isFinite(cm)) return;
              onChange({ labelWidthMm: clampLabelWidthMm(cmToMm(cm)), useFixedLabelSize: true });
            }}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <p className="text-xs text-[#9CA3AF]">Height (cm)</p>
          <input
            type="number"
            min={1}
            max={8}
            step={0.1}
            disabled={disabled || !useFixedLabelSize}
            value={heightCm}
            onChange={(e) => {
              const cm = parseFloat(e.target.value);
              if (!Number.isFinite(cm)) return;
              onChange({ labelHeightMm: clampLabelHeightMm(cmToMm(cm)), useFixedLabelSize: true });
            }}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <button
        type="button"
        disabled={disabled || !useFixedLabelSize}
        onClick={applyFit}
        className="w-full h-9 rounded-lg text-xs font-medium border border-[#374151] bg-[#111827] text-white disabled:opacity-50"
      >
        Fit to A4
      </button>

      {useFixedLabelSize ? (
        <p className="text-[10px] text-[#9CA3AF] leading-snug">
          {stickerSizeSummary(labelWidthMm, labelHeightMm, a4Columns, maxLabelsPerSheet)}
        </p>
      ) : null}

      <div className="flex gap-1">
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ a4Columns: n })}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${
              a4Columns === n
                ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                : 'bg-[#374151] border-[#4B5563] text-[#9CA3AF]'
            }`}
          >
            {n} cols
          </button>
        ))}
      </div>

      <div>
        <p className="text-xs text-[#9CA3AF]">Labels per A4 page</p>
        <input
          type="number"
          min={6}
          max={60}
          disabled={disabled}
          value={maxLabelsPerSheet}
          onChange={(e) => {
            const n = Math.max(6, Math.min(60, parseInt(e.target.value, 10) || 30));
            onChange({ maxLabelsPerSheet: n });
          }}
          className={INPUT_CLASS}
        />
        <p className="text-[10px] text-[#6B7280] mt-1">{gridSummary(a4Columns, maxLabelsPerSheet)}</p>
      </div>
    </div>
  );
}
