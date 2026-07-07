import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/app/components/ui/button';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { compareAccountLedgerTieOut } from '@/app/services/unifiedLedgerAccountCompareService';
import type { LedgerRowCompareResult } from '@/app/lib/unifiedLedgerCompareTypes';
import { CompareDiffTable, CompareSummaryCards, downloadCompareJson } from './CompareSummaryCards';
import type { CompareFilterState } from './compareFilters';

type AccountOption = { id: string; code: string; name: string };

export function AccountLedgerCompareTab(props: {
  companyId: string | null;
  filters: CompareFilterState;
}) {
  const { companyId, filters } = props;
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LedgerRowCompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('code');
      setAccounts((data || []) as AccountOption[]);
    })();
  }, [companyId]);

  const runCompare = useCallback(async () => {
    if (!companyId || !accountId) {
      setError('Select company and account');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await compareAccountLedgerTieOut({
        companyId,
        accountId,
        branchId: filters.branchId,
        dateFrom: filters.dateFrom || null,
        dateTo: filters.dateTo || null,
        basis: filters.basis,
      });
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Compare failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, accountId, filters]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-border bg-card/40 p-4">
        <label className="text-sm space-y-1">
          Account
          <select
            className="w-full rounded bg-muted border border-border px-2 py-1.5"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">— Select —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <Button onClick={runCompare} disabled={loading}>
            {loading ? 'Comparing…' : 'Run compare'}
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
              downloadCompareJson(`phase2-compare-account-${Date.now()}.json`, result)
            }
          >
            Export JSON
          </Button>
        </div>
      )}
    </div>
  );
}
