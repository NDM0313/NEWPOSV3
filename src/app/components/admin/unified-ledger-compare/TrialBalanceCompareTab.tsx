import { useCallback, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { compareTrialBalanceTieOut } from '@/app/services/unifiedLedgerTrialBalanceCompareService';
import type { TrialBalanceCompareResult } from '@/app/lib/unifiedLedgerCompareTypes';
import { CompareSummaryCards, downloadCompareJson } from './CompareSummaryCards';
import type { CompareFilterState } from './compareFilters';

export function TrialBalanceCompareTab(props: {
  companyId: string | null;
  filters: CompareFilterState;
}) {
  const { companyId, filters } = props;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrialBalanceCompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCompare = useCallback(async () => {
    if (!companyId || !filters.dateFrom || !filters.dateTo) {
      setError('Select company and date range');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await compareTrialBalanceTieOut({
        companyId,
        branchId: filters.branchId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        basis: filters.basis,
      });
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Compare failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, filters]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Compare legacy <code className="text-amber-300">getTrialBalance</code> vs{' '}
        <code className="text-amber-300">get_unified_trial_balance</code> (shadow only).
        Both sides use <strong className="text-amber-200">official_gl</strong> — legacy TB has no
        effective_party lens; the global Basis filter does not apply here.
      </p>
      <Button onClick={runCompare} disabled={loading}>
        {loading ? 'Comparing…' : 'Run trial balance compare'}
      </Button>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <LoadingSpinner />}
      {result?.rpcError && <p className="text-amber-400 text-sm">RPC: {result.rpcError}</p>}

      {result && (
        <div className="space-y-4">
          <CompareSummaryCards
            oldBalance={result.oldTotalDebit - result.oldTotalCredit}
            newBalance={result.newTotalDebit - result.newTotalCredit}
            difference={result.difference}
            pass={result.pass}
            oldEngineName={result.oldEngineName}
            newEngineName={result.newEngineName}
            oldQueryMs={result.oldQueryMs}
            newQueryMs={result.newQueryMs}
            extra={
              <div className="text-sm text-gray-400 grid md:grid-cols-2 gap-2">
                <p>
                  Old Dr/Cr: {result.oldTotalDebit.toFixed(2)} / {result.oldTotalCredit.toFixed(2)} (
                  {result.oldAccountCount} accounts)
                </p>
                <p>
                  New Dr/Cr: {result.newTotalDebit.toFixed(2)} / {result.newTotalCredit.toFixed(2)} (
                  {result.newAccountCount} accounts)
                </p>
                <p className="col-span-2">
                  Account diffs: {result.accountDiffs.length}
                  {result.accountDiffs.length > 0 ? ' — see table below' : ' — none'}
                </p>
              </div>
            }
          />

          {result.accountDiffs.length > 0 && (
            <div className="rounded-lg border border-gray-800 overflow-hidden">
              <div className="px-3 py-2 bg-gray-900/80 text-sm font-medium">
                Account diffs ({result.accountDiffs.length})
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left p-2">Code</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Kind</th>
                      <th className="text-right p-2">Old net</th>
                      <th className="text-right p-2">New net</th>
                      <th className="text-right p-2">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.accountDiffs.slice(0, 50).map((d, i) => (
                      <tr key={`${d.accountId}-${i}`} className="border-b border-gray-800/50">
                        <td className="p-2">{d.accountCode}</td>
                        <td className="p-2">{d.accountName}</td>
                        <td className="p-2">{d.kind}</td>
                        <td className="p-2 text-right">{d.oldNetBalance.toFixed(2)}</td>
                        <td className="p-2 text-right">{d.newNetBalance.toFixed(2)}</td>
                        <td className="p-2 text-right">{d.difference.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCompareJson(`phase2-compare-tb-${Date.now()}.json`, result)
            }
          >
            Export JSON
          </Button>
        </div>
      )}
    </div>
  );
}
