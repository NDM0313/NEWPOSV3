import { useCallback, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { compareCashBankLedgerTieOut } from '@/app/services/unifiedLedgerCashBankCompareService';
import type { LedgerRowCompareResult } from '@/app/lib/unifiedLedgerCompareTypes';
import { CompareDiffTable, CompareSummaryCards, downloadCompareJson } from './CompareSummaryCards';
import type { CompareFilterState } from './compareFilters';

export function CashBankCompareTab(props: {
  companyId: string | null;
  filters: CompareFilterState;
}) {
  const { companyId, filters } = props;
  const [liquidity, setLiquidity] = useState<'cash' | 'bank' | 'wallet' | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LedgerRowCompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCompare = useCallback(async () => {
    if (!companyId || !filters.dateFrom || !filters.dateTo) {
      setError('Select company and date range');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await compareCashBankLedgerTieOut({
        companyId,
        branchId: filters.branchId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        basis: filters.basis,
        liquidity,
      });
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Compare failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, filters, liquidity]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Compare legacy roznamcha vs <code className="text-amber-300">get_unified_cash_bank_ledger</code>{' '}
        (shadow only).
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        <label className="text-sm space-y-1">
          Liquidity
          <select
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5"
            value={liquidity}
            onChange={(e) => setLiquidity(e.target.value as typeof liquidity)}
          >
            <option value="all">All</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="wallet">Wallet</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button onClick={runCompare} disabled={loading}>
            {loading ? 'Comparing…' : 'Run cash/bank compare'}
          </Button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <LoadingSpinner />}
      {result?.rpcError && <p className="text-amber-400 text-sm">RPC: {result.rpcError}</p>}

      {result && (
        <div className="space-y-4">
          <CompareSummaryCards
            oldBalance={result.oldBalance}
            newBalance={result.newBalance}
            difference={result.difference}
            pass={result.pass}
            oldRowCount={result.oldRowCount}
            newRowCount={result.newRowCount}
            oldEngineName={result.oldEngineName}
            newEngineName={result.newEngineName}
            oldQueryMs={result.oldQueryMs}
            newQueryMs={result.newQueryMs}
          />
          <CompareDiffTable title={`Missing in new (${result.missingInNew.length})`} rows={result.missingInNew} />
          <CompareDiffTable title={`Extra in new (${result.extraInNew.length})`} rows={result.extraInNew} />
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCompareJson(`phase2-compare-cashbank-${Date.now()}.json`, result)
            }
          >
            Export JSON
          </Button>
        </div>
      )}
    </div>
  );
}
