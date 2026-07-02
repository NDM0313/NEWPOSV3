import React from 'react';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import {
  stockStatusBadgeClass,
  stockStatusBadgeLabel,
} from '@/app/lib/stockMovementDisplay';
import type { ProductStockSummary } from '@/app/lib/stockMovementReportLogic';

interface Props {
  summary: ProductStockSummary;
  className?: string;
}

export function ProductStockSummaryCard({ summary, className }: Props) {
  const kpis = [
    { label: 'Opening Stock', value: summary.openingStock },
    { label: 'Total In', value: summary.totalIn, color: 'text-emerald-400' },
    { label: 'Total Out', value: summary.totalOut, color: 'text-red-400' },
    { label: 'Net Adjustment', value: summary.netAdjustment },
    { label: 'Period Closing', value: summary.periodClosing },
    { label: 'Current Stock', value: summary.currentStock, highlight: true },
  ];

  return (
    <div className={cn('rounded-lg border border-gray-800 bg-gray-900/60 p-4 space-y-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">{summary.productName}</h3>
          <p className="text-sm text-gray-400">
            SKU: {summary.sku}
            {summary.category ? ` · ${summary.category}` : ''}
            {summary.brand ? ` · ${summary.brand}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={cn('border', stockStatusBadgeClass(summary.status))}>
            {stockStatusBadgeLabel(summary.status)}
          </Badge>
          {summary.missingBalanceRow && (
            <Badge variant="outline" className="border-amber-700 text-amber-400">
              No stock balance row found
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-md bg-gray-950/50 p-3 border border-gray-800/80">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{k.label}</p>
            <p className={cn('text-lg font-semibold mt-1', k.color || (k.highlight ? 'text-blue-400' : 'text-white'))}>
              {Number(k.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              {summary.unit ? ` ${summary.unit}` : ''}
            </p>
          </div>
        ))}
      </div>

      {summary.lastMovementDate && (
        <p className="text-xs text-gray-500">
          Last movement: {new Date(summary.lastMovementDate).toLocaleString()}
          {' · '}
          {summary.movementCountInPeriod} movement(s) in selected period
        </p>
      )}
    </div>
  );
}
