/**
 * Unified Products tab — Inventory (stock card), movement history, and Sales report modes.
 */

import React, { useState } from 'react';
import { Package, ShoppingBag, BookOpen } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { ProductLedger } from './ProductLedger';
import { ProductSellReportPage } from './ProductSellReportPage';
import { StockMovementHistoryReportPage } from './stock-movement-history/StockMovementHistoryReportPage';

type Props = {
  startDate: string;
  endDate: string;
  branchId?: string;
};

type ProductReportMode = 'inventory' | 'movement-history' | 'sales';

export function ProductReportsPage({ startDate, endDate, branchId }: Props) {
  const [mode, setMode] = useState<ProductReportMode>('inventory');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'inventory' as const, label: 'Inventory', icon: Package },
            { key: 'movement-history' as const, label: 'Stock Ledger', icon: BookOpen },
            { key: 'sales' as const, label: 'Sales', icon: ShoppingBag },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setMode(t.key)}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2',
              mode === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {mode === 'inventory' ? (
        <ProductLedger />
      ) : mode === 'movement-history' ? (
        <StockMovementHistoryReportPage startDate={startDate} endDate={endDate} branchId={branchId} />
      ) : (
        <ProductSellReportPage startDate={startDate} endDate={endDate} branchId={branchId} />
      )}
    </div>
  );
}

export default ProductReportsPage;
