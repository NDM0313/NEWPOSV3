import React, { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { defaultDayBookDiagnosticsDateRange } from '@/app/lib/dayBookDiagnostics';
import {
  loadDayBookDiagnostics,
  type DayBookDiagnosticsSnapshot,
} from '@/app/services/accountingDeveloperCenterService';

interface Props {
  companyId: string;
  initialQuery?: string;
}

export function DayBookDiagnosticsTab({ companyId, initialQuery = '' }: Props) {
  const defaults = defaultDayBookDiagnosticsDateRange();
  const [query, setQuery] = useState(initialQuery);
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [includeVoid, setIncludeVoid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<DayBookDiagnosticsSnapshot | null>(null);

  const run = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setSnapshot(await loadDayBookDiagnostics(companyId, query, dateFrom, dateTo, includeVoid));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Day Book diagnostic failed');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, query, dateFrom, dateTo, includeVoid]);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => {
    if (initialQuery && companyId) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, initialQuery]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Voucher filter (q)</label>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="JE-0188" className="mt-1 bg-gray-950 border-gray-800" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500">From</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 bg-gray-950 border-gray-800 w-[150px]" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500">To</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 bg-gray-950 border-gray-800 w-[150px]" />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400 pb-2">
          <input type="checkbox" checked={includeVoid} onChange={(e) => setIncludeVoid(e.target.checked)} />
          Include voided JEs in query
        </label>
        <Button type="button" size="sm" onClick={run} disabled={loading}>
          <Search className={`w-4 h-4 mr-1 ${loading ? 'animate-pulse' : ''}`} />
          Run diagnostic
        </Button>
        <span className="text-xs text-violet-400/90 ml-auto">Read-only — Phase C4</span>
      </div>

      {snapshot && (
        <>
          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-base">Period balance</CardTitle>
              <CardDescription>
                {snapshot.dateFrom} → {snapshot.dateTo} · Lines: {snapshot.periodBalance.activeLineCount}
                {snapshot.periodBalance.voidLineCount ? ` · Void lines excluded: ${snapshot.periodBalance.voidLineCount}` : ''}
              </CardDescription>
              {snapshot.truncationWarning && <p className="text-xs text-amber-400">{snapshot.truncationWarning}</p>}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 text-sm">
              <span>Debit: ₨{snapshot.periodBalance.totalDebit.toLocaleString()}</span>
              <span>Credit: ₨{snapshot.periodBalance.totalCredit.toLocaleString()}</span>
              <span>Diff: ₨{snapshot.periodBalance.difference.toLocaleString()}</span>
              {snapshot.periodBalance.isBalanced ? (
                <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-800">Balanced</Badge>
              ) : (
                <Badge className="bg-red-900/40 text-red-300 border-red-800">Unbalanced</Badge>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-base">Unbalanced vouchers ({snapshot.unbalancedVouchers.length})</CardTitle>
              <CardDescription>Per-voucher debit − credit; matches Day Book report logic.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {snapshot.unbalancedVouchers.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No unbalanced vouchers in range.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="py-2 pr-2">Voucher</th>
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Lines</th>
                      <th className="py-2 pr-2">Debit</th>
                      <th className="py-2 pr-2">Credit</th>
                      <th className="py-2">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.unbalancedVouchers.map((row) => (
                      <tr key={row.journalEntryId} className="border-b border-gray-800/60">
                        <td className="py-2 pr-2 text-gray-200">{row.voucher}</td>
                        <td className="py-2 pr-2 text-gray-400">{row.entryDate}</td>
                        <td className="py-2 pr-2 text-gray-500">{row.referenceType}</td>
                        <td className="py-2 pr-2">{row.lineCount}</td>
                        <td className="py-2 pr-2">{row.debit.toLocaleString()}</td>
                        <td className="py-2 pr-2">{row.credit.toLocaleString()}</td>
                        <td className="py-2 text-amber-300">{row.diff.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
