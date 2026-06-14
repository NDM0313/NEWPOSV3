import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { Pagination } from '@/app/components/ui/pagination';
import { stockStatusBadgeClass, stockStatusBadgeLabel } from '@/app/lib/stockMovementDisplay';
import type { ProductReportSection, ProductStockSummary } from '@/app/lib/stockMovementReportLogic';
import { ProductStockSummaryCard } from './ProductStockSummaryCard';
import { MovementHistoryTable } from './MovementHistoryTable';

interface Props {
  summaries: ProductStockSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onExpand: (productId: string) => Promise<ProductReportSection>;
  expandAllEnabled: boolean;
  onExpandAll?: () => void;
  expandAllLoading?: boolean;
  className?: string;
}

export function ProductAccordionList({
  summaries,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onExpand,
  expandAllEnabled,
  onExpandAll,
  expandAllLoading,
  className,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, ProductReportSection>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const toggle = useCallback(
    async (productId: string) => {
      const next = new Set(expanded);
      if (next.has(productId)) {
        next.delete(productId);
        setExpanded(next);
        return;
      }
      next.add(productId);
      setExpanded(next);
      if (!details[productId]) {
        setLoadingId(productId);
        try {
          const section = await onExpand(productId);
          setDetails((d) => ({ ...d, [productId]: section }));
        } finally {
          setLoadingId(null);
        }
      }
    },
    [expanded, details, onExpand],
  );

  if (!summaries.length) {
    return (
      <div className={cn('rounded-lg border border-gray-800 p-8 text-center text-gray-400', className)}>
        No products match the selected filters.
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {expandAllEnabled && onExpandAll && (
        <button
          type="button"
          onClick={onExpandAll}
          disabled={expandAllLoading}
          className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
        >
          {expandAllLoading ? 'Expanding…' : 'Expand all on this page'}
        </button>
      )}

      {summaries.map((s) => {
        const isOpen = expanded.has(s.productId);
        const section = details[s.productId];
        const isLoading = loadingId === s.productId;

        return (
          <div key={s.productId} className="rounded-lg border border-gray-800 overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(s.productId)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-900/60 hover:bg-gray-900 text-left"
            >
              {isOpen ? <ChevronDown size={18} className="text-gray-400 shrink-0" /> : <ChevronRight size={18} className="text-gray-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <span className="font-medium text-white">{s.productName}</span>
                <span className="text-gray-500 ml-2 text-sm">{s.sku}</span>
              </div>
              <span className="text-sm text-gray-400">{s.movementCountInPeriod} mov.</span>
              <span className="text-sm font-semibold text-white">{s.currentStock}</span>
              <span className={cn('text-xs px-2 py-0.5 rounded border', stockStatusBadgeClass(s.status))}>
                {stockStatusBadgeLabel(s.status)}
              </span>
            </button>

            {isOpen && (
              <div className="p-4 border-t border-gray-800 space-y-4 bg-gray-950/30">
                {isLoading && (
                  <div className="flex items-center gap-2 text-gray-400 py-4">
                    <Loader2 className="animate-spin" size={18} />
                    Loading movements…
                  </div>
                )}
                {section && (
                  <>
                    <ProductStockSummaryCard summary={section.summary} />
                    <MovementHistoryTable
                      rows={section.rows}
                      emptyMessage="No stock movement found for this product."
                    />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {totalCount > pageSize && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(totalCount / pageSize)}
          onPageChange={onPageChange}
          pageSize={pageSize}
          totalItems={totalCount}
          onPageSizeChange={() => {}}
        />
      )}
    </div>
  );
}
