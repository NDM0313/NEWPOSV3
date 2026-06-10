import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
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
      <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
        Loading document comparison…
      </div>
    );
  }
  if (!comparison) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 space-y-4 text-sm">
      <div>
        <p className="font-semibold text-amber-200">Document comparison (diagnostic only)</p>
        <p className="text-amber-100/70 text-xs mt-1">
          Does not change the official GL balance shown above. For developer investigation only.
        </p>
        {comparison.note ? <p className="text-amber-100/80 text-xs mt-2">{comparison.note}</p> : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-md bg-gray-950/60 px-3 py-2">
          <p className="text-[10px] uppercase text-gray-500">GL closing</p>
          <p className="font-semibold text-white tabular-nums">{formatCurrency(comparison.glClosingBalance)}</p>
        </div>
        <div className="rounded-md bg-gray-950/60 px-3 py-2">
          <p className="text-[10px] uppercase text-gray-500">Document closing</p>
          <p className="font-semibold text-white tabular-nums">{formatCurrency(comparison.documentClosingBalance)}</p>
        </div>
        <div className="rounded-md bg-gray-950/60 px-3 py-2">
          <p className="text-[10px] uppercase text-gray-500">Difference</p>
          <p className="font-semibold text-amber-300 tabular-nums">{formatCurrency(comparison.difference)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ComparisonList title="Rows only in GL" items={comparison.onlyInGl} empty="None" />
        <ComparisonList title="Rows only in documents" items={comparison.onlyInDocuments} empty="None" />
      </div>
    </div>
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
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">{title}</p>
      <div className="max-h-40 overflow-y-auto rounded-md border border-gray-800 bg-gray-950/40">
        {items.length === 0 ? (
          <p className="px-3 py-2 text-gray-600 text-xs">{empty}</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {items.slice(0, 50).map((r, i) => (
              <li key={`${r.referenceNo}-${i}`} className="px-3 py-1.5 text-xs flex justify-between gap-2">
                <span className="font-mono text-gray-300 truncate">{r.referenceNo}</span>
                <span className="text-gray-500 shrink-0">{r.date}</span>
                <span className="tabular-nums text-gray-400 shrink-0">{formatCurrency(r.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        {items.length > 50 ? (
          <p className="px-3 py-1 text-[10px] text-gray-600">+{items.length - 50} more</p>
        ) : null}
      </div>
    </div>
  );
}
