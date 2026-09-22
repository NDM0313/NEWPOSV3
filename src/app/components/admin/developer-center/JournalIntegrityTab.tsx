import React, { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { defaultDayBookDiagnosticsDateRange } from '@/app/lib/dayBookDiagnostics';
import {
  loadJournalIntegrityBrowse,
  type JournalIntegrityBrowseSnapshot,
} from '@/app/services/accountingDeveloperCenterService';

interface Props {
  companyId: string;
  initialQuery?: string;
}

function severityBadge(sev: string) {
  if (sev === 'error') return <Badge className="bg-red-900/40 text-red-300 border-red-800">{sev}</Badge>;
  if (sev === 'warning') return <Badge className="bg-amber-900/40 text-amber-300 border-amber-800">{sev}</Badge>;
  if (sev === 'info') return <Badge className="bg-slate-800 text-slate-300 border-slate-700">{sev}</Badge>;
  return <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-800">clean</Badge>;
}

export function JournalIntegrityTab({ companyId, initialQuery = '' }: Props) {
  const defaults = defaultDayBookDiagnosticsDateRange();
  const [query, setQuery] = useState(initialQuery);
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<JournalIntegrityBrowseSnapshot | null>(null);

  const run = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setSnapshot(
        await loadJournalIntegrityBrowse(companyId, {
          query,
          dateFrom,
          dateTo,
          suspiciousOnly,
        })
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Journal browse failed');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, query, dateFrom, dateTo, suspiciousOnly]);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => {
    if (companyId) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Filter (q)</label>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="JE-0012 or payment" className="mt-1 bg-input-background border-border" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 bg-input-background border-border w-[150px]" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 bg-input-background border-border w-[150px]" />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
          <input type="checkbox" checked={suspiciousOnly} onChange={(e) => setSuspiciousOnly(e.target.checked)} />
          Suspicious only
        </label>
        <Button type="button" size="sm" onClick={run} disabled={loading}>
          <Search className={`w-4 h-4 mr-1 ${loading ? 'animate-pulse' : ''}`} />
          Browse
        </Button>
        <span className="text-xs text-violet-400/90 ml-auto">Browse-only — Phase C6</span>
      </div>

      {snapshot && (
        <Card className="border-border bg-card/40">
          <CardHeader>
            <CardTitle className="text-base">Journal explorer ({snapshot.rows.length})</CardTitle>
            <CardDescription>No void/repair actions — use Integrity Lab for writes.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {snapshot.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No journals match filters.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-2">Entry</th>
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Ref type</th>
                    <th className="py-2 pr-2">Display ref</th>
                    <th className="py-2 pr-2">Severity</th>
                    <th className="py-2">Rules</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.rows.map((row) => (
                    <tr key={row.je.id} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-2 text-gray-200">{row.je.entry_no || row.je.id.slice(0, 8)}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{row.je.entry_date?.slice(0, 10)}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{row.je.reference_type}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{row.uiRef?.displayRef || '—'}</td>
                      <td className="py-2 pr-2">{severityBadge(row.severity)}</td>
                      <td className="py-2 text-muted-foreground max-w-md">{row.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
