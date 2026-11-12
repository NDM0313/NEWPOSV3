import React from 'react';
import { cn } from '@/app/components/ui/utils';
import { movementRowColorClass } from '@/app/lib/stockMovementDisplay';
import type { StockMovementReportRow } from '@/app/lib/stockMovementReportLogic';
import { formatQty } from '@/app/utils/quantity';

interface Props {
  rows: StockMovementReportRow[];
  emptyMessage?: string;
  className?: string;
  showVariationColumn?: boolean;
}

export function MovementHistoryTable({ rows, emptyMessage, className, showVariationColumn }: Props) {
  if (!rows.length) {
    return (
      <div className={cn('rounded-lg border border-border bg-card/40 p-8 text-center text-muted-foreground', className)}>
        {emptyMessage || 'No stock movements in the selected period.'}
      </div>
    );
  }

  const fmtInOut = (n: number) => (n === 0 ? '—' : formatQty(n));
  const fmtBalance = (n: number) => formatQty(n);

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border', className)}>
      <table className="w-full text-sm">
        <thead className="bg-card text-muted-foreground uppercase text-xs">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Branch</th>
            {showVariationColumn && <th className="px-3 py-2 text-left">Variation</th>}
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left">Reference</th>
            <th className="px-3 py-2 text-left">Party</th>
            <th className="px-3 py-2 text-right text-emerald-400">Qty In</th>
            <th className="px-3 py-2 text-right text-red-400">Qty Out</th>
            <th className="px-3 py-2 text-right">Balance</th>
            <th className="px-3 py-2 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={cn('border-t border-border/80', movementRowColorClass(r.movementType, r.quantity))}
            >
              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                {new Date(r.date).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.branchName || '—'}</td>
              {showVariationColumn && (
                <td className="px-3 py-2 text-purple-300">{r.variationLabel || '—'}</td>
              )}
              <td className="px-3 py-2 font-medium">{r.movementTypeLabel}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.reference || '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.party || '—'}</td>
              <td className="px-3 py-2 text-right text-emerald-400 tabular-nums">{fmtInOut(r.qtyIn)}</td>
              <td className="px-3 py-2 text-right text-red-400 tabular-nums">{fmtInOut(r.qtyOut)}</td>
              <td className="px-3 py-2 text-right font-semibold text-foreground tabular-nums">{fmtBalance(r.runningBalance)}</td>
              <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{r.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

