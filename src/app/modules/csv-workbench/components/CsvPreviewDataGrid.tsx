import React, { useMemo } from 'react';
import { cn } from '@/app/components/ui/utils';
import type { CsvRowValidation } from '../types';

export type CsvPreviewColumn = {
  key: string;
  label: string;
  /** Optional narrow width class e.g. w-16 */
  className?: string;
};

export interface CsvPreviewDataGridProps {
  columns: CsvPreviewColumn[];
  /** One object per data row; values stringified for display */
  rows: Record<string, string | number | boolean | undefined | null>[];
  /** 0-based row index into `rows` */
  rowErrors?: Map<number, CsvRowValidation[]>;
  maxHeightClass?: string;
  caption?: string;
}

/**
 * Dense, data-first preview table for CSV validation (no decorative chrome).
 */
export function CsvPreviewDataGrid({
  columns,
  rows,
  rowErrors,
  maxHeightClass = 'max-h-[min(420px,50vh)]',
  caption,
}: CsvPreviewDataGridProps) {
  const errorSummary = useMemo(() => {
    if (!rowErrors?.size) return null;
    let n = 0;
    rowErrors.forEach((list) => {
      n += list.filter((x) => x.severity === 'error').length;
    });
    return n;
  }, [rowErrors]);

  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-950/80">
      {caption && <div className="border-b border-zinc-800 px-2 py-1.5 text-[11px] text-zinc-400">{caption}</div>}
      {errorSummary != null && errorSummary > 0 && (
        <div className="border-b border-red-900/50 bg-red-950/30 px-2 py-1 text-[11px] text-red-300">
          {errorSummary} blocking issue(s) — fix rows below before import.
        </div>
      )}
      <div className={cn('overflow-auto', maxHeightClass)}>
        <table className="w-full border-collapse text-left font-mono text-[11px] text-zinc-200">
          <thead className="sticky top-0 z-[1] bg-zinc-900 shadow-sm">
            <tr className="border-b border-zinc-800">
              <th className="whitespace-nowrap border-r border-zinc-800 px-1.5 py-1 text-zinc-500">#</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'whitespace-nowrap border-r border-zinc-800 px-1.5 py-1 font-semibold text-zinc-400 last:border-r-0',
                    c.className
                  )}
                >
                  {c.label}
                </th>
              ))}
              <th className="whitespace-nowrap px-1.5 py-1 text-amber-200/90">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const issues = rowErrors?.get(ri) ?? [];
              const hasError = issues.some((i) => i.severity === 'error');
              const hasWarn = issues.some((i) => i.severity === 'warning');
              return (
                <tr
                  key={ri}
                  className={cn(
                    'border-b border-zinc-800/80 odd:bg-zinc-900/40',
                    hasError && 'bg-red-950/35 border-l-2 border-l-red-500',
                    !hasError && hasWarn && 'bg-amber-950/20 border-l-2 border-l-amber-600'
                  )}
                >
                  <td className="border-r border-zinc-800 px-1.5 py-0.5 text-zinc-500">{ri + 1}</td>
                  {columns.map((c) => (
                    <td key={c.key} className={cn('border-r border-zinc-800 px-1.5 py-0.5 last:border-r-0', c.className)}>
                      {formatCell(row[c.key])}
                    </td>
                  ))}
                  <td className="max-w-[220px] whitespace-pre-wrap break-words px-1.5 py-0.5 text-amber-100/90">
                    {issues.map((i, ii) => (
                      <div key={`${ii}-${i.field ?? ''}-${i.message}`} className="leading-tight">
                        {i.severity === 'error' ? '[E] ' : '[W] '}
                        {i.message}
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(v: string | number | boolean | undefined | null): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}
