import React, { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { RepairActionPanel } from '@/app/components/admin/developer-center/RepairActionPanel';
import { useRepairQueue } from '@/app/components/admin/developer-center/RepairQueueContext';
import type { OpeningBalanceGapRow } from '@/app/lib/openingBalanceDiagnostics';
import type { RepairQueueItem } from '@/app/lib/developerRepairActions';
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

function repairActionForRow(row: OpeningBalanceGapRow): string | null {
  if (row.status === 'missing_je') return 'opening.create_missing_je';
  if (row.status === 'amount_mismatch') return 'opening.create_adjustment_je';
  if (row.status === 'orphan_je') return 'opening.orphan_je_review';
  return null;
}

export function OpeningBalanceToolsTab({ companyId, initialQuery = '' }: Props) {
  const { sendToRepairQueue } = useRepairQueue();
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<OpeningBalanceDiagnosticsSnapshot | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reviewNote, setReviewNote] = useState('');
  const [activeRepair, setActiveRepair] = useState<RepairQueueItem | null>(null);

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

  const queueRowRepair = (row: OpeningBalanceGapRow) => {
    const actionId = repairActionForRow(row);
    if (!actionId) return;
    const params: Record<string, unknown> = {
      contactId: row.entityId,
      entityType: row.entityType,
      effectiveDate,
    };
    if (actionId === 'opening.orphan_je_review') {
      if (!reviewNote.trim()) {
        toast.error('Enter a review note for orphan JE');
        return;
      }
      params.reviewNote = reviewNote.trim();
    }
    const item: Omit<RepairQueueItem, 'queueId'> = {
      actionId,
      sourceTab: 'opening',
      params,
      detectedReason: row.reason,
      severity: actionId === 'opening.create_adjustment_je' ? 'high' : 'medium',
      title: row.entityName,
    };
    sendToRepairQueue(item);
    setActiveRepair({ ...item, queueId: `ob-${row.rowId}` });
    toast.success('Sent to repair queue');
  };

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
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Effective date (apply)</label>
          <Input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="mt-1 bg-gray-950 border-gray-800 w-[150px]"
          />
        </div>
        <Button type="button" size="sm" onClick={run} disabled={loading}>
          <Search className={`w-4 h-4 mr-1 ${loading ? 'animate-pulse' : ''}`} />
          Run preview
        </Button>
        <span className="text-xs text-violet-400/90 ml-auto">Phase F — confirm-gated apply for eligible gaps</span>
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
                    <th className="py-2 pr-2">Reason</th>
                    <th className="py-2">Repair</th>
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
                      <td className="py-2 pr-2 text-gray-400 max-w-xs">{row.reason}</td>
                      <td className="py-2">
                        {repairActionForRow(row) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => queueRowRepair(row)}
                          >
                            Send to queue
                          </Button>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {gaps.some((r) => r.status === 'orphan_je') && (
        <div className="max-w-md">
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Orphan JE review note</label>
          <Input
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Admin review note (required for orphan apply)"
            className="mt-1 bg-gray-950 border-gray-800 text-sm"
          />
        </div>
      )}

      {activeRepair && (
        <RepairActionPanel
          companyId={companyId}
          item={activeRepair}
          onApplied={() => void run()}
        />
      )}
    </div>
  );
}
