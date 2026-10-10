import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import type { StockIntegrityFlags, StockStatusFilter } from '@/app/lib/stockMovementReportLogic';

interface Props {
  flags: StockIntegrityFlags;
  onFilterShortcut?: (status: StockStatusFilter) => void;
  className?: string;
}

const items: { key: keyof StockIntegrityFlags; label: string; status?: StockStatusFilter }[] = [
  { key: 'negativeStockCount', label: 'Negative stock', status: 'negative_stock' },
  { key: 'zeroStockCount', label: 'Zero stock (with history)', status: 'zero_stock' },
  { key: 'noMovementCount', label: 'No movement', status: 'no_movement' },
  { key: 'missingBalanceCount', label: 'Missing balance row' },
  { key: 'balanceWithoutMovementCount', label: 'Balance without movements' },
];

export function StockIntegrityPanel({ flags, onFilterShortcut, className }: Props) {
  const total = Object.values(flags).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  return (
    <div className={cn('rounded-lg border border-amber-900/50 bg-amber-950/20 p-4', className)}>
      <div className="flex items-center gap-2 text-amber-300 font-medium mb-3">
        <AlertTriangle size={18} />
        Stock integrity summary
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(({ key, label, status }) => {
          const count = flags[key];
          if (!count) return null;
          return (
            <button
              key={key}
              type="button"
              disabled={!status || !onFilterShortcut}
              onClick={() => status && onFilterShortcut?.(status)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm border border-amber-800/50 bg-amber-950/30 text-amber-200',
                status && onFilterShortcut && 'hover:bg-amber-900/40 cursor-pointer',
                !status && 'cursor-default',
              )}
            >
              {label}: <span className="font-semibold">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
