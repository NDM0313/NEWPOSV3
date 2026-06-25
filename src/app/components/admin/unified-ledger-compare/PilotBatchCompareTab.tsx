import { useCallback, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import {
  CLONE_REFERENCE,
  DIN_CHINA_COMPANY_NAME,
  GATE_A_STATUS,
  MR_JALIL_EXPECTED_BALANCE,
  TIEOUT_STATUS,
} from '@/app/lib/unifiedLedgerGoldenFixtures';
import { runDinChinaPilotBatchCompare } from '@/app/services/unifiedLedgerPilotBatchCompareService';
import { downloadCompareJson } from './CompareSummaryCards';
import type { CompareFilterState } from './compareFilters';

export function PilotBatchCompareTab(props: {
  filters: CompareFilterState;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof runDinChinaPilotBatchCompare>> | null>(null);

  const runBatch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await runDinChinaPilotBatchCompare({
        dateFrom: props.filters.dateFrom || null,
        dateTo: props.filters.dateTo || null,
        useHybridOldEngine: false,
      });
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Batch compare failed');
    } finally {
      setLoading(false);
    }
  }, [props.filters.dateFrom, props.filters.dateTo]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 text-sm text-gray-400 space-y-1">
        <p>
          <strong className="text-white">{DIN_CHINA_COMPANY_NAME}</strong> — MR JALIL × 3 bases × 3 branch
          scopes (expected <strong className="text-white">9/9 PASS</strong>).
        </p>
        <p>Golden balance: PKR {MR_JALIL_EXPECTED_BALANCE.toLocaleString()} · Clone: {CLONE_REFERENCE}</p>
        <p>
          Reference: {GATE_A_STATUS} · Tie-out: {TIEOUT_STATUS}
        </p>
      </div>

      <Button onClick={runBatch} disabled={loading}>
        {loading ? 'Running batch…' : 'Run DIN CHINA 9/9 batch'}
      </Button>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <LoadingSpinner />}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Compared" value={result.summary.contactsCompared} />
            <MiniStat label="Pass" value={result.summary.passCount} />
            <MiniStat label="Fail" value={result.summary.failCount} highlight={result.summary.failCount > 0} />
            <MiniStat label="Max |diff|" value={result.summary.maxAbsDifference} />
          </div>

          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800 bg-gray-900/80">
                  <th className="text-left p-2">Branch</th>
                  <th className="text-left p-2">Basis</th>
                  <th className="text-right p-2">Old</th>
                  <th className="text-right p-2">New</th>
                  <th className="text-right p-2">Diff</th>
                  <th className="text-center p-2">Pass</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr
                    key={`${row.branchLabel}-${row.basis}-${i}`}
                    className={`border-b border-gray-800/50 ${row.pass ? '' : 'bg-red-500/10'}`}
                  >
                    <td className="p-2">{row.branchLabel || 'All'}</td>
                    <td className="p-2">{row.basis}</td>
                    <td className="p-2 text-right font-mono">{row.oldBalance.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono">{row.newBalance.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono">{row.difference.toFixed(2)}</td>
                    <td className="p-2 text-center">{row.pass ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCompareJson(`phase2-compare-batch-${Date.now()}.json`, result)
            }
          >
            Export JSON
          </Button>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${highlight ? 'border-amber-500/50 bg-amber-500/10' : 'border-gray-800 bg-gray-900/50'}`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-mono mt-1">{value}</div>
    </div>
  );
}
