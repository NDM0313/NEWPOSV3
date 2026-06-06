import React, { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { defaultStatementTraceDateRange } from '@/app/lib/statementTraceDiagnostics';
import {
  loadStatementTraceSnapshot,
  type StatementTraceSnapshot,
} from '@/app/services/accountingDeveloperCenterService';

interface Props {
  companyId: string;
  initialQuery?: string;
}

export function StatementTraceTab({ companyId, initialQuery = '' }: Props) {
  const defaults = defaultStatementTraceDateRange();
  const [query, setQuery] = useState(initialQuery);
  const [contactId, setContactId] = useState('');
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<StatementTraceSnapshot | null>(null);

  const run = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await loadStatementTraceSnapshot(
        companyId,
        query,
        contactId.trim() || null,
        dateFrom,
        dateTo
      );
      setSnapshot(data);
      if (!data.contactId && query.trim()) {
        toast.message('No contact resolved from reference — try contact UUID or widen search');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Statement trace failed');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, query, contactId, dateFrom, dateTo]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (initialQuery && companyId) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, initialQuery]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Reference (q)</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="HQ-RCV-0006 or SL-0012"
            className="mt-1 bg-gray-950 border-gray-800"
          />
        </div>
        <div className="min-w-[200px]">
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Contact ID (optional)</label>
          <Input
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            placeholder="UUID — auto-resolve from q"
            className="mt-1 bg-gray-950 border-gray-800 font-mono text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 bg-gray-950 border-gray-800 w-[150px]"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 bg-gray-950 border-gray-800 w-[150px]"
          />
        </div>
        <Button type="button" size="sm" onClick={run} disabled={loading}>
          <Search className={`w-4 h-4 mr-1 ${loading ? 'animate-pulse' : ''}`} />
          Run diagnostic
        </Button>
        <span className="text-xs text-violet-400/90 ml-auto">Read-only — Phase C3</span>
      </div>

      {snapshot && (
        <Card className="border-gray-800 bg-gray-900/40">
          <CardHeader>
            <CardTitle className="text-base">Statement trace snapshot</CardTitle>
            <CardDescription>
              Contact: {snapshot.contactName || snapshot.contactId || '—'} · Statement rows:{' '}
              {snapshot.statementRowCount} · Candidates: {snapshot.candidates.length}
              {snapshot.query ? ` · Filter: ${snapshot.query}` : ''}
            </CardDescription>
            {snapshot.resolveHints.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">{snapshot.resolveHints.join(' · ')}</p>
            )}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {snapshot.candidates.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No statement rows match. Resolve contact from q, widen dates, or check exclusion probes.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="py-2 pr-2">Source</th>
                    <th className="py-2 pr-2">Ref</th>
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Debit</th>
                    <th className="py-2 pr-2">Credit</th>
                    <th className="py-2 pr-2">Included</th>
                    <th className="py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.candidates.map((row) => (
                    <tr key={row.rowId} className="border-b border-gray-800/60 align-top">
                      <td className="py-2 pr-2 font-mono text-gray-400">{row.source}</td>
                      <td className="py-2 pr-2 text-gray-200">{row.ref}</td>
                      <td className="py-2 pr-2 text-gray-400">{row.date}</td>
                      <td className="py-2 pr-2 text-gray-500">{row.documentType}</td>
                      <td className="py-2 pr-2">{row.debit || '—'}</td>
                      <td className="py-2 pr-2">{row.credit || '—'}</td>
                      <td className="py-2 pr-2">
                        {row.included ? (
                          <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-800">yes</Badge>
                        ) : (
                          <Badge className="bg-amber-900/40 text-amber-300 border-amber-800">no</Badge>
                        )}
                      </td>
                      <td className="py-2 text-gray-400 max-w-md">{row.reason}</td>
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
