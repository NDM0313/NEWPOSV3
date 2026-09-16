import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { ErpInfoPanel } from '@/app/components/ui/erp-surfaces';
import type { LedgerDocumentComparisonResult } from './types';

export function LedgerDocumentComparisonPanel({
  comparison,
  loading,
}: {
  comparison: LedgerDocumentComparisonResult | null;
  loading: boolean;
}) {
  const { formatCurrency } = useFormatCurrency();

  if (loading) {
    return (
      <ErpInfoPanel variant="warning" className="px-4 py-3 text-sm">
        Loading document comparison…
      </ErpInfoPanel>
    );
  }
  if (!comparison) return null;

  return (
    <ErpInfoPanel variant="warning" className="p-4 space-y-4 text-sm">
      <div>
        <p className="font-semibold">Document comparison (diagnostic only)</p>
        <p className="text-muted-foreground text-xs mt-1">
          Does not change the official GL balance shown above. For developer investigation only.
        </p>
        {comparison.note ? <p className="text-muted-foreground text-xs mt-2">{comparison.note}</p> : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <p className="text-[10px] uppercase text-muted-foreground">GL closing</p>
          <p className="font-semibold text-foreground tabular-nums">{formatCurrency(comparison.glClosingBalance)}</p>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <p className="text-[10px] uppercase text-muted-foreground">Document closing</p>
          <p className="font-semibold text-foreground tabular-nums">{formatCurrency(comparison.documentClosingBalance)}</p>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <p className="text-[10px] uppercase text-muted-foreground">Difference</p>
          <p className="font-semibold text-amber-700 dark:text-amber-300 tabular-nums">{formatCurrency(comparison.difference)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ComparisonList title="Rows only in GL" items={comparison.onlyInGl} empty="None" />
        <ComparisonList title="Rows only in documents" items={comparison.onlyInDocuments} empty="None" />
      </div>
    </ErpInfoPanel>
  );
}

function ComparisonList({
  title,
  items,
  empty,
}: {
  title: string;
  items: { referenceNo: string; date: string; amount: number }[];
  empty: string;
}) {
  const { formatCurrency } = useFormatCurrency();
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/30">
        {items.length === 0 ? (
          <p className="px-3 py-2 text-muted-foreground text-xs">{empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.slice(0, 50).map((r, i) => (
              <li key={`${r.referenceNo}-${i}`} className="px-3 py-1.5 text-xs flex justify-between gap-2">
                <span className="font-mono text-foreground truncate">{r.referenceNo}</span>
                <span className="text-muted-foreground shrink-0">{r.date}</span>
                <span className="tabular-nums text-muted-foreground shrink-0">{formatCurrency(r.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        {items.length > 50 ? (
          <p className="px-3 py-1 text-[10px] text-muted-foreground">+{items.length - 50} more</p>
        ) : null}
      </div>
    </div>
  );
}
