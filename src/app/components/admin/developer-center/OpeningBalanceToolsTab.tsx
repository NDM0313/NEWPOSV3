import React, { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import {
  loadOpeningBalanceDiagnostics,
  type OpeningBalanceDiagnosticsSnapshot,
} from '@/app/services/accountingDeveloperCenterService';

interface Props {
  companyId: string;
  initialQuery?: string;
}

function statusBadge(status: string) {
  if (status === 'synced') return <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-800">synced</Badge>;
  if (status === 'missing_je') return <Badge className="bg-red-900/40 text-red-300 border-red-800">missing_je</Badge>;
  if (status === 'amount_mismatch') return <Badge className="bg-amber-900/40 text-amber-300 border-amber-800">mismatch</Badge>;
  if (status === 'orphan_je') return <Badge className="bg-violet-900/40 text-violet-300 border-violet-800">orphan_je</Badge>;
  return <Badge className="bg-slate-800 text-slate-400 border-slate-700">{status}</Badge>;
}

export function OpeningBalanceToolsTab({ companyId, initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<OpeningBalanceDiagnosticsSnapshot | null>(null);

  const run = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setSnapshot(await loadOpeningBalanceDiagnostics(companyId, query));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Opening balance diagnostic failed');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, query]);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => {
    if (companyId) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const gaps = snapshot?.rows.filter((r) => r.status !== 'synced' && r.status !== 'no_opening') ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Contact filter (q)</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Customer name or contact UUID"
            className="mt-1 bg-gray-950 border-gray-800"
          />
        </div>
        <Button type="button" size="sm" onClick={run} disabled={loading}>
          <Search className={`w-4 h-4 mr-1 ${loading ? 'animate-pulse' : ''}`} />
          Run preview
        </Button>
        <span className="text-xs text-violet-400/90 ml-auto">Preview-only — Phase E (apply via Integrity Lab)</span>
      </div>

      {snapshot && (
        <Card className="border-gray-800 bg-gray-900/40">
          <CardHeader>
            <CardTitle className="text-base">Opening balance gaps ({gaps.length})</CardTitle>
            <CardDescription>
              Scanned {snapshot.scannedContacts} contacts · {snapshot.rows.length} legs shown
              {snapshot.query ? ` · Filter: ${snapshot.query}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {snapshot.rows.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No opening balance legs match filter.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="py-2 pr-2">Entity</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Operational</th>
                    <th className="py-2 pr-2">JE</th>
                    <th className="py-2 pr-2">JE amt</th>
                    <th className="py-2 pr-2">Gap</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.rows.map((row) => (
                    <tr key={row.rowId} className="border-b border-gray-800/60 align-top">
                      <td className="py-2 pr-2 text-gray-200">{row.entityName}</td>
                      <td className="py-2 pr-2 font-mono text-gray-500">{row.entityType}</td>
                      <td className="py-2 pr-2">{row.operationalOpening}</td>
                      <td className="py-2 pr-2 text-gray-400">{row.jeEntryNo || '—'}</td>
                      <td className="py-2 pr-2">{row.jeAmount ?? '—'}</td>
                      <td className="py-2 pr-2">{row.gap}</td>
                      <td className="py-2 pr-2">{statusBadge(row.status)}</td>
                      <td className="py-2 text-gray-400 max-w-xs">{row.reason}</td>
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
