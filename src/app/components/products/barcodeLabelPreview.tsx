import React from 'react';
import { cn } from '@/app/components/ui/utils';
import type { LabelPrintJob } from '@/app/services/barcodeLabelPrint';

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
};

export interface BarcodeLabelPreviewCardProps extends LabelPreviewDisplayOptions {
  job: LabelPrintJob | null;
  companyName?: string;
  branchName?: string;
  className?: string;
  compact?: boolean;
  /** Larger preview for dedicated preview column */
  large?: boolean;
}

function BarcodeBars({ compact, large }: { compact?: boolean; large?: boolean }) {
  const count = compact ? 12 : large ? 24 : 20;
  const barW = compact ? 1 : large ? 3 : 2;
  const barH = compact ? 12 : large ? 44 : 32;
  return (
    <div className={cn('flex justify-center gap-px my-1', compact && 'my-0.5', large && 'my-2')}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-black" style={{ width: barW, height: barH }} />
      ))}
    </div>
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
}: BarcodeLabelPreviewCardProps) {
  const code = job?.barcode?.trim() || '0000000000';
  const text = compact ? 'text-[6px]' : large ? 'text-sm' : 'text-xs';
  const nameText = compact ? 'text-[7px]' : large ? 'text-base' : 'text-xs';

  return (
    <div
      className={cn(
        'bg-white text-black rounded border border-dashed border-gray-300 text-center space-y-0.5',
        compact ? 'p-1' : large ? 'p-5 shadow-lg' : 'p-3 shadow-lg',
        text,
        className
      )}
    >
      {showCompany && companyName && (
        <p
          className={cn(
            'font-bold uppercase text-muted-foreground',
            compact ? 'text-[5px]' : large ? 'text-[10px]' : 'text-[8px]'
          )}
        >
          {companyName}
        </p>
      )}
      {showBranch && branchName && (
        <p className={cn('text-muted-foreground', compact ? 'text-[5px]' : large ? 'text-[10px]' : 'text-[8px]')}>
          {branchName}
        </p>
      )}
      {showName && (
        <p className={cn('font-bold leading-tight text-black', nameText)}>
          {job?.productName ?? 'Product name'}
        </p>
      )}
      {showVariation && job?.variationName && (
        <p className={cn('text-muted-foreground', compact ? 'text-[5px]' : 'text-[9px]')}>{job.variationName}</p>
      )}
      <BarcodeBars compact={compact} large={large} />
      <p
        className={cn(
          'font-mono tracking-wider text-gray-800',
          compact ? 'text-[5px]' : large ? 'text-sm' : 'text-[10px]'
        )}
      >
        {code}
      </p>
      {showPacking && job?.packingSummary && (
        <p className={cn('text-muted-foreground', compact ? 'text-[5px]' : large ? 'text-xs' : 'text-[9px]')}>
          {job.packingSummary}
        </p>
      )}
      {showPrice && job?.price != null && (
        <p className={cn('font-bold text-black', compact ? 'text-[6px]' : large ? 'text-base' : 'text-xs')}>
          Rs. {Number(job.price).toLocaleString('en-PK')}
        </p>
      )}
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
}: {
  totalLabels: number;
  maxLabelsPerSheet: number;
  a4Columns: number;
  firstLabel: LabelPrintJob | null;
  display: LabelPreviewDisplayOptions;
  companyName?: string;
  branchName?: string;
  largeSheet?: boolean;
}) {
  const cols = Math.max(2, Math.min(4, a4Columns));
  const perPage = Math.max(6, maxLabelsPerSheet);
  const cellsOnPreview = Math.min(totalLabels, perPage, 12);
  const sheets = sheetCountForLabels(totalLabels, perPage);
  const rows = gridRowsForSheet(perPage, cols);

  return (
    <div className="space-y-2">
      <p className={cn('text-muted-foreground leading-snug', largeSheet ? 'text-xs' : 'text-[10px]')}>
        Printing {totalLabels} label{totalLabels === 1 ? '' : 's'} · up to {perPage} per A4 page ({cols}×{rows}{' '}
        grid) · {sheets} sheet{sheets === 1 ? '' : 's'}
      </p>
      <div
        className="bg-white rounded shadow-md border border-gray-400 mx-auto overflow-hidden"
        style={{ width: largeSheet ? 180 : 140, aspectRatio: '210 / 297' }}
      >
        <div
          className="grid gap-0.5 p-1 h-full"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cellsOnPreview }).map((_, i) =>
            i === 0 ? (
              <BarcodeLabelPreviewCard
                key={i}
                job={firstLabel}
                companyName={companyName}
                branchName={branchName}
                {...display}
                compact
                className="min-h-0 shadow-none"
              />
            ) : (
              <div
                key={i}
                className="border border-dashed border-gray-200 rounded bg-gray-50 min-h-[28px]"
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
