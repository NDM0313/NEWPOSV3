import React, { useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { defaultRoznamchaTraceDateRange } from '@/app/lib/roznamchaTraceDiagnostics';
import { detectRoznamchaRepairCandidate } from '@/app/lib/roznamchaRepairDiagnostics';
import { useRepairQueue } from '@/app/components/admin/developer-center/RepairQueueContext';
import {
  loadRoznamchaTraceSnapshot,
  type RoznamchaTraceSnapshot,
} from '@/app/services/accountingDeveloperCenterService';

interface Props {
  companyId: string;
  initialQuery?: string;
}

export function RoznamchaTraceTab({ companyId, initialQuery = '' }: Props) {
  const { sendToRepairQueue } = useRepairQueue();
  const defaults = defaultRoznamchaTraceDateRange();
  const [query, setQuery] = useState(initialQuery);
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<RoznamchaTraceSnapshot | null>(null);

  const run = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await loadRoznamchaTraceSnapshot(companyId, query, dateFrom, dateTo);
      setSnapshot(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Roznamcha trace failed');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, query, dateFrom, dateTo]);

  useEffect(() => {
    if (initialQuery && companyId) void run();
    // Deep-link bootstrap only (?tab=roznamcha&q=...)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, initialQuery]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Reference (q)</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="HQ-RCV-0006"
            className="mt-1 bg-input-background border-border"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 bg-input-background border-border w-[150px]"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 bg-input-background border-border w-[150px]"
          />
        </div>
        <Button type="button" size="sm" onClick={run} disabled={loading}>
          <Search className={`w-4 h-4 mr-1 ${loading ? 'animate-pulse' : ''}`} />
          Run diagnostic
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={run} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <span className="text-xs text-violet-400/90 ml-auto">
          Excluded rows are dedupe diagnostics — not missing from Roznamcha. Queue actions are audit-only unless
          metadata repair is detected.
        </span>
      </div>

      {snapshot && (
        <Card className="border-border bg-card/40">
          <CardHeader>
            <CardTitle className="text-base">Roznamcha trace snapshot</CardTitle>
            <CardDescription>
              Pre-dedupe: {snapshot.preCount} · Post-dedupe: {snapshot.postCount} · Candidates:{' '}
              {snapshot.candidates.length}
              {snapshot.query ? ` · Filter: ${snapshot.query}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {snapshot.candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No pre-dedupe rows match this reference in {snapshot.dateFrom}–{snapshot.dateTo}. Widen the date
                range or clear the filter.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-2">Source</th>
                    <th className="py-2 pr-2">Ref</th>
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Dir</th>
                    <th className="py-2 pr-2">Amount</th>
                    <th className="py-2 pr-2">Liquidity</th>
                    <th className="py-2 pr-2">Included</th>
                    <th className="py-2 pr-2">Priority</th>
                    <th className="py-2 pr-2">Entity keys</th>
                    <th className="py-2 pr-2">Reason</th>
                    <th className="py-2">Repair</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.candidates.map((row) => {
                    const repair = detectRoznamchaRepairCandidate({
                      rowId: row.rowId,
                      ref: row.ref,
                      sourcePaymentId: row.sourcePaymentId,
                      sourceRentalPaymentId: row.sourceRentalPaymentId,
                      sourceJournalEntryId: row.sourceJournalEntryId,
                      paymentAccountId: row.paymentAccountId,
                      excludedReason: row.included ? null : row.reason,
                      winnerRef: row.winnerRef,
                    });
                    return (
                    <tr key={row.rowId} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-2 font-mono text-muted-foreground">{row.source}</td>
                      <td className="py-2 pr-2 text-gray-200">
                        {row.ref}
                        {row.journalEntryNo ? (
                          <span className="block text-muted-foreground font-mono text-[10px]">{row.journalEntryNo}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{row.date}</td>
                      <td className="py-2 pr-2">{row.direction}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{row.amount}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{row.liquidityAccount}</td>
                      <td className="py-2 pr-2">
                        {row.included ? (
                          <Badge
                            className="bg-emerald-900/40 text-emerald-300 border-emerald-800"
                            title="Canonical row after dedupe — this is what Roznamcha counts."
                          >
                            Canonical
                          </Badge>
                        ) : (
                          <Badge
                            className="bg-amber-900/40 text-amber-300 border-amber-800"
                            title="Not missing from Roznamcha — excluded to avoid double counting. See the Canonical row for the same receipt."
                          >
                            Excluded (dedupe)
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{row.sourcePriority}</td>
                      <td className="py-2 pr-2 font-mono text-[10px] text-muted-foreground max-w-[140px]">
                        {row.entityKeys.join(' · ') || '—'}
                      </td>
                      <td className="py-2 text-muted-foreground max-w-xs">
                        {row.reason}
                        {!row.included && row.winnerRef ? (
                          <span className="block text-muted-foreground text-[10px] mt-0.5">
                            Cash already counted via canonical row (ref {row.winnerRef}).
                          </span>
                        ) : null}
                        {row.winnerRef ? (
                          <span className="block text-muted-foreground">Winner ref: {row.winnerRef}</span>
                        ) : null}
                      </td>
                      <td className="py-2">
                        {repair.canQueue && repair.queueItem ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            title="Audit/report only — does not change cash, payments, or journal lines."
                            onClick={() => {
                              sendToRepairQueue(repair.queueItem!);
                              toast.success('Sent to Repair Queue (audit only)');
                            }}
                          >
                            {repair.queueItem.actionId === 'roznamcha.report_duplicate_source'
                              ? 'Report duplicate (audit only)'
                              : 'Send to queue'}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">{repair.reason}</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
