import { useCallback, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { compareCashBankLedgerTieOut } from '@/app/services/unifiedLedgerCashBankCompareService';
import type { LedgerRowCompareResult } from '@/app/lib/unifiedLedgerCompareTypes';
import { CompareDiffTable, CompareSummaryCards, CompareAmountMismatchTable, downloadCompareJson } from './CompareSummaryCards';
import type { CompareFilterState } from './compareFilters';

function CashBankDiagnosticBanner() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 space-y-2 text-sm text-muted-foreground">
      <p className="font-semibold text-amber-200">Shadow diagnostic only — not production Roznamcha parity</p>
      <p>
        This tab compares <strong className="text-foreground">legacy roznamcha cashbook rows</strong> against the{' '}
        <strong className="text-foreground">raw unified GL cash/bank RPC</strong> (
        <code className="text-amber-300">get_unified_cash_bank_ledger</code>). That pairing is{' '}
        <strong className="text-amber-200">semantically expected to differ</strong> on closing totals and row grain.
      </p>
      <p>
        Live DIN CHINA Roznamcha uses the{' '}
        <strong className="text-foreground">payment + journal composite</strong> parity assembler (
        <code className="text-amber-300">assembleRoznamchaUnifiedParityMain</code>) — not raw GL as the main
        loader. Phase 2.16 golden totals remain authoritative for production.
      </p>
      <p className="text-xs text-muted-foreground">
        <strong className="text-amber-200">PASS</strong> on this tab means <strong>row parity</strong> (0 missing, 0
        extra, 0 amount mismatches after economic-key matching and optional <code>manual_receipt</code> supplement).
        Closing balance and period-net cards are <strong>informational</strong> and may differ when opening scope,
        transfer Dr/Cr orientation, or payment-composite vs raw GL semantics diverge.
      </p>
    </div>
  );
}

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

  const diag = result?.cashBankDiagnostic;

  return (
    <div className="space-y-4">
      <CashBankDiagnosticBanner />
      <p className="text-xs text-muted-foreground">
        Both sides use <strong className="text-muted-foreground">official_gl</strong>. Roznamcha has no effective_party lens;
        the global Basis filter does not apply here.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-border bg-card/40 p-4">
        <label className="text-sm space-y-1">
          Liquidity
          <select
            className="w-full rounded bg-muted border border-border px-2 py-1.5"
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
            {loading ? 'Comparing…' : 'Run cash/bank diagnostic compare'}
          </Button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <LoadingSpinner />}
      {result?.rpcError && <p className="text-amber-400 text-sm">RPC: {result.rpcError}</p>}

      {result && (
        <div className="space-y-4">
          {diag && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div
                className={`rounded-lg border p-3 ${diag.rowParityPass ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10'}`}
              >
                <div className="text-xs text-muted-foreground">Row parity (gate)</div>
                <div className="text-lg font-mono mt-1">{diag.rowParityPass ? 'PASS' : 'FAIL'}</div>
              </div>
              <div
                className={`rounded-lg border p-3 ${diag.periodMovementPass ? 'border-border bg-muted/40' : 'border-amber-500/40 bg-amber-500/10'}`}
              >
                <div className="text-xs text-muted-foreground">Period net (informational)</div>
                <div className="text-lg font-mono mt-1">{diag.periodMovementPass ? 'Aligned' : 'Differs'}</div>
              </div>
              {diag.manualReceiptSupplementCount > 0 && (
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">manual_receipt supplement rows</div>
                  <div className="text-lg font-mono mt-1">{diag.manualReceiptSupplementCount}</div>
                </div>
              )}
            </div>
          )}
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
            extra={
              <p className="text-xs text-muted-foreground">
                Balance cards: legacy roznamcha closing vs raw unified GL closing —{' '}
                <strong className="text-muted-foreground">informational only</strong>; overall PASS follows row parity.
              </p>
            }
          />
          <CompareDiffTable title={`Missing in new (${result.missingInNew.length})`} rows={result.missingInNew} />
          <CompareDiffTable title={`Extra in new (${result.extraInNew.length})`} rows={result.extraInNew} />
          <CompareAmountMismatchTable
            title={`Amount mismatches (${result.amountMismatches.length})`}
            rows={result.amountMismatches}
          />
          {result.buildCommit && (
            <p className="text-xs text-muted-foreground font-mono">Build: {result.buildCommit}</p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCompareJson(`phase2-compare-cashbank-diagnostic-${Date.now()}.json`, result)
            }
          >
            Export JSON
          </Button>
        </div>
      )}
    </div>
  );
}
