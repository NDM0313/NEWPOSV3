import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/app/components/ui/utils';
import type { LabelPrintJob } from '@/app/services/barcodeLabelPrint';

/** Printable A4 area after 10mm margins (matches buildA4SheetHtml). */
const A4_PRINTABLE_W_MM = 190;
const A4_PRINTABLE_H_MM = 277;
const A4_GAP_MM = 2;
const A4_MARGIN_RATIO = 10 / 210;
const LARGE_PREVIEW_MAX_W_PX = 280;

export type LabelPreviewDisplayOptions = {
  showName: boolean;
  showPrice: boolean;
  showVariation: boolean;
  showPacking: boolean;
  showCompany: boolean;
  showBranch: boolean;
};

export function sheetCountForLabels(totalLabels: number, maxPerSheet: number): number {
  if (totalLabels <= 0) return 0;
  return Math.ceil(totalLabels / Math.max(1, maxPerSheet));
}

export function gridRowsForSheet(maxPerSheet: number, columns: number): number {
  return Math.ceil(Math.max(1, maxPerSheet) / Math.max(2, columns));
}

export const SAMPLE_LABEL_PREVIEW_JOB: LabelPrintJob = {
  productName: 'BRIDAL - 365 - SAMPLE /1012',
  sku: 'PRD-0048-2',
  barcode: 'PRD-0048-2',
  price: 127750,
  variationName: 'Size M',
  quantity: 1,
};

export interface BarcodeLabelPreviewCardProps extends LabelPreviewDisplayOptions {
  job: LabelPrintJob | null;
  companyName?: string;
  branchName?: string;
  className?: string;
  compact?: boolean;
  /** Larger preview for dedicated preview column */
  large?: boolean;
  /**
   * Ultra-tiny clipped cell for A4 sheet mini preview (matches print overflow:hidden).
   * Takes precedence over compact when true.
   */
  sheetCell?: boolean;
  /** Approximate physical aspect when fixed sticker size is on */
  labelWidthMm?: number;
  labelHeightMm?: number;
}

function BarcodeBars({
  compact,
  large,
  sheetCell,
  shortSticker,
}: {
  compact?: boolean;
  large?: boolean;
  sheetCell?: boolean;
  shortSticker?: boolean;
}) {
  const count = sheetCell ? 10 : shortSticker && large ? 18 : compact ? 12 : large ? 24 : 20;
  const barW = sheetCell ? 1 : shortSticker && large ? 2 : compact ? 1 : large ? 3 : 2;
  const barH = sheetCell ? 5 : shortSticker && large ? 22 : compact ? 12 : large ? 44 : 32;
  return (
    <div
      className={cn(
        'flex justify-center gap-px shrink-0',
        sheetCell ? 'my-px' : compact ? 'my-0.5' : large ? 'my-2' : 'my-1',
        shortSticker && large && 'my-1',
      )}
    >
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-black" style={{ width: barW, height: barH }} />
      ))}
    </div>
  );
}

function LabelContent({
  job,
  companyName,
  branchName,
  showName,
  showPrice,
  showVariation,
  showPacking,
  showCompany,
  showBranch,
  sheetCell,
  compact,
  large,
  shortSticker,
}: LabelPreviewDisplayOptions & {
  job: LabelPrintJob | null;
  companyName?: string;
  branchName?: string;
  sheetCell?: boolean;
  compact?: boolean;
  large?: boolean;
  shortSticker?: boolean;
}) {
  const code = job?.barcode?.trim() || '0000000000';
  const nameText = sheetCell
    ? 'text-[3.5px] leading-tight'
    : shortSticker && large
      ? 'text-xs leading-tight'
      : compact
        ? 'text-[7px]'
        : large
          ? 'text-base'
          : 'text-xs';

  return (
    <>
      {showCompany && companyName && (
        <p
          className={cn(
            'font-bold uppercase text-muted-foreground w-full',
            sheetCell
              ? 'text-[2.5px] truncate'
              : shortSticker && large
                ? 'text-[8px]'
                : compact
                  ? 'text-[5px] truncate'
                  : large
                    ? 'text-[10px]'
                    : 'text-[8px] truncate',
          )}
        >
          {companyName}
        </p>
      )}
      {showBranch && branchName && (
        <p
          className={cn(
            'text-muted-foreground w-full',
            sheetCell
              ? 'text-[2.5px] truncate'
              : shortSticker && large
                ? 'text-[8px]'
                : compact
                  ? 'text-[5px] truncate'
                  : large
                    ? 'text-[10px]'
                    : 'text-[8px] truncate',
          )}
        >
          {branchName}
        </p>
      )}
      {showName && (
        <p
          className={cn(
            'font-bold text-black w-full leading-tight',
            nameText,
            sheetCell && 'line-clamp-1',
          )}
        >
          {job?.productName ?? 'Product name'}
        </p>
      )}
      {showVariation && job?.variationName && (
        <p
          className={cn(
            'text-muted-foreground w-full',
            sheetCell ? 'text-[2.5px] truncate' : shortSticker && large ? 'text-[9px]' : compact ? 'text-[5px] truncate' : 'text-[9px]',
          )}
        >
          {job.variationName}
        </p>
      )}
      <BarcodeBars compact={compact} large={large} sheetCell={sheetCell} shortSticker={shortSticker} />
      <p
        className={cn(
          'font-mono tracking-wider text-gray-800 w-full',
          sheetCell ? 'text-[2.5px] truncate' : shortSticker && large ? 'text-[10px]' : compact ? 'text-[5px] truncate' : large ? 'text-sm' : 'text-[10px] truncate',
        )}
      >
        {code}
      </p>
      {showPacking && job?.packingSummary && (
        <p
          className={cn(
            'text-muted-foreground w-full',
            sheetCell ? 'text-[2.5px] truncate' : shortSticker && large ? 'text-[8px]' : compact ? 'text-[5px] truncate' : large ? 'text-xs' : 'text-[9px] truncate',
          )}
        >
          {job.packingSummary}
        </p>
      )}
      {showPrice && job?.price != null && (
        <p
          className={cn(
            'font-bold text-black w-full',
            sheetCell ? 'text-[3px] truncate' : shortSticker && large ? 'text-xs' : compact ? 'text-[6px] truncate' : large ? 'text-base' : 'text-xs truncate',
          )}
        >
          Rs. {Number(job.price).toLocaleString('en-PK')}
        </p>
      )}
    </>
  );
}

export function BarcodeLabelPreviewCard({
  job,
  companyName,
  branchName,
  showName,
  showPrice,
  showVariation,
  showPacking,
  showCompany,
  showBranch,
  className,
  compact,
  large,
  sheetCell,
  labelWidthMm,
  labelHeightMm,
}: BarcodeLabelPreviewCardProps) {
  const hasMm =
    labelWidthMm != null &&
    labelHeightMm != null &&
    labelWidthMm > 0 &&
    labelHeightMm > 0;
  const shortSticker = hasMm && labelHeightMm! <= 30;
  const trueSizeLarge = Boolean(large && hasMm && !sheetCell);

  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  const checkOverflow = useCallback(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) {
      setOverflows(false);
      return;
    }
    const pad = 2;
    const tooTall = content.scrollHeight > frame.clientHeight + pad;
    const tooWide = content.scrollWidth > frame.clientWidth + pad;
    setOverflows(tooTall || tooWide);
  }, []);

  useLayoutEffect(() => {
    if (!trueSizeLarge) {
      setOverflows(false);
      return;
    }
    checkOverflow();
  }, [
    trueSizeLarge,
    checkOverflow,
    job,
    companyName,
    branchName,
    showName,
    showPrice,
    showVariation,
    showPacking,
    showCompany,
    showBranch,
    labelWidthMm,
    labelHeightMm,
  ]);

  useEffect(() => {
    if (!trueSizeLarge) return;
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    const ro = new ResizeObserver(() => checkOverflow());
    ro.observe(frame);
    ro.observe(content);
    return () => ro.disconnect();
  }, [trueSizeLarge, checkOverflow]);

  const displayOpts = {
    showName,
    showPrice,
    showVariation,
    showPacking,
    showCompany,
    showBranch,
  };

  // True-size large sticker: fixed px frame matching mm aspect; content may spill past border.
  if (trueSizeLarge) {
    const wMm = labelWidthMm!;
    const hMm = labelHeightMm!;
    const pxPerMm = LARGE_PREVIEW_MAX_W_PX / wMm;
    const frameW = Math.round(wMm * pxPerMm);
    const frameH = Math.round(hMm * pxPerMm);

    return (
      <div className={cn('mx-auto flex flex-col items-center gap-2', className)}>
        <p className="text-[10px] text-muted-foreground">
          Sticker preview · {wMm}×{hMm} mm ({(wMm / 10).toFixed(1)}×{(hMm / 10).toFixed(1)} cm)
        </p>
        <div
          className="relative"
          style={{
            width: frameW,
            // Extra space below so spilled content stays visible
            minHeight: frameH,
            paddingBottom: overflows ? 24 : 0,
          }}
        >
          <div
            ref={frameRef}
            className={cn(
              'relative bg-white text-black rounded border-2 border-dashed text-center box-border overflow-visible',
              overflows ? 'border-amber-500 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]' : 'border-gray-400 shadow-lg',
            )}
            style={{
              width: frameW,
              height: frameH,
              boxSizing: 'border-box',
            }}
          >
            {/* Clip guide: print would hide outside this box */}
            <div
              className="pointer-events-none absolute inset-0 rounded z-0"
              style={{
                boxShadow: overflows ? 'inset 0 0 0 1px rgba(245, 158, 11, 0.5)' : undefined,
              }}
              aria-hidden
            />
            <div
              ref={contentRef}
              className={cn(
                'relative z-10 flex flex-col items-center justify-start text-center px-1.5 py-1 space-y-0.5 w-full',
                shortSticker ? 'text-[10px]' : 'text-sm',
              )}
              style={{ minHeight: '100%' }}
            >
              <LabelContent
                job={job}
                companyName={companyName}
                branchName={branchName}
                {...displayOpts}
                large
                shortSticker={shortSticker}
              />
            </div>
          </div>
          {overflows ? (
            <div
              className="absolute left-0 right-0 top-full mt-1 rounded bg-amber-500/15 border border-amber-500/40 px-2 py-1"
              style={{ width: frameW }}
            >
              <p className="text-[10px] text-amber-200 leading-snug text-center">
                Content may not fit this sticker size — text or barcode spills past the dashed edge (print will clip).
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Sheet cell / compact / large without fixed mm
  const aspectStyle =
    hasMm && sheetCell
      ? {
          aspectRatio: `${labelWidthMm} / ${labelHeightMm}`,
          width: '100%',
          display: 'flex',
          flexDirection: 'column' as const,
          justifyContent: 'center',
          overflow: 'hidden' as const,
          boxSizing: 'border-box' as const,
        }
      : sheetCell
        ? {
            display: 'flex',
            flexDirection: 'column' as const,
            justifyContent: 'center',
            overflow: 'hidden' as const,
            boxSizing: 'border-box' as const,
            minHeight: 0,
            height: '100%',
          }
        : undefined;

  return (
    <div
      className={cn(
        'bg-white text-black rounded border border-dashed border-gray-300 text-center',
        sheetCell
          ? 'p-px space-y-px shadow-none'
          : compact
            ? 'p-1 space-y-0.5'
            : large
              ? 'p-5 shadow-lg space-y-0.5'
              : 'p-3 shadow-lg space-y-0.5',
        sheetCell ? 'text-[3px] leading-none' : compact ? 'text-[6px]' : large ? 'text-sm' : 'text-xs',
        className,
      )}
      style={aspectStyle}
    >
      <LabelContent
        job={job}
        companyName={companyName}
        branchName={branchName}
        {...displayOpts}
        sheetCell={sheetCell}
        compact={compact}
        large={large}
      />
    </div>
  );
}

export function A4SheetMiniPreview({
  totalLabels,
  maxLabelsPerSheet,
  a4Columns,
  firstLabel,
  display,
  companyName,
  branchName,
  largeSheet,
  useFixedLabelSize,
  labelWidthMm,
  labelHeightMm,
}: {
  totalLabels: number;
  maxLabelsPerSheet: number;
  a4Columns: number;
  firstLabel: LabelPrintJob | null;
  display: LabelPreviewDisplayOptions;
  companyName?: string;
  branchName?: string;
  largeSheet?: boolean;
  useFixedLabelSize?: boolean;
  labelWidthMm?: number;
  labelHeightMm?: number;
}) {
  const cols = Math.max(2, Math.min(4, a4Columns));
  const perPage = Math.max(6, maxLabelsPerSheet);
  const sheets = sheetCountForLabels(totalLabels, perPage);
  const rows = gridRowsForSheet(perPage, cols);
  const fixed =
    useFixedLabelSize === true &&
    labelWidthMm != null &&
    labelHeightMm != null &&
    labelWidthMm > 0 &&
    labelHeightMm > 0;

  const wMm = fixed ? labelWidthMm! : 0;
  const hMm = fixed ? labelHeightMm! : 0;

  const fittedRows = fixed
    ? Math.max(1, Math.floor((A4_PRINTABLE_H_MM + A4_GAP_MM) / (hMm + A4_GAP_MM)))
    : rows;
  const visibleRows = Math.min(fittedRows, rows, 12);
  // Prefer showing a full page worth of cells (capped for mini UI).
  const cellsOnPreview = Math.min(
    Math.max(totalLabels, Math.min(perPage, cols * visibleRows)),
    perPage,
    cols * visibleRows,
  );

  const colPct = fixed ? (wMm / A4_PRINTABLE_W_MM) * 100 : 0;
  const gapPct = fixed ? (A4_GAP_MM / A4_PRINTABLE_W_MM) * 100 : 0;
  const padPct = A4_MARGIN_RATIO * 100;
  const cellAspect = fixed ? (`${wMm} / ${hMm}` as const) : undefined;

  return (
    <div className="space-y-2">
      <p className={cn('text-muted-foreground leading-snug', largeSheet ? 'text-xs' : 'text-[10px]')}>
        A4 sheet look · up to {perPage} per page ({cols}×{rows} grid)
        {fixed ? ` · ${labelWidthMm}×${labelHeightMm} mm` : ' · equal cells'}
        {totalLabels > 0 ? ` · sample ${Math.min(totalLabels, cellsOnPreview)} labels` : ''} · {sheets || 1} sheet
        {(sheets || 1) === 1 ? '' : 's'}
      </p>
      <div
        className="bg-white rounded shadow-md border border-gray-400 mx-auto overflow-hidden"
        style={{ width: largeSheet ? 180 : 140, aspectRatio: '210 / 297' }}
      >
        <div
          className="grid h-full content-start justify-start box-border"
          style={
            fixed
              ? {
                  gridTemplateColumns: `repeat(${cols}, ${colPct}%)`,
                  gap: `${gapPct}%`,
                  padding: `${padPct}%`,
                  alignContent: 'start',
                  justifyContent: 'start',
                }
              : {
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: 2,
                  padding: 4,
                }
          }
        >
          {Array.from({ length: cellsOnPreview }).map((_, i) =>
            i === 0 ? (
              <BarcodeLabelPreviewCard
                key={i}
                job={firstLabel}
                companyName={companyName}
                branchName={branchName}
                {...display}
                sheetCell
                className="min-h-0 w-full"
                labelWidthMm={fixed ? labelWidthMm : undefined}
                labelHeightMm={fixed ? labelHeightMm : undefined}
              />
            ) : (
              <div
                key={i}
                className="border border-dashed border-gray-200 rounded bg-gray-50 overflow-hidden box-border"
                style={
                  fixed
                    ? { aspectRatio: cellAspect, minHeight: 0, width: '100%' }
                    : { minHeight: 22, aspectRatio: '1 / 0.55' }
                }
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
