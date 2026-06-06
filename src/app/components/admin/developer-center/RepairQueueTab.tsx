import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import { RepairActionPanel } from '@/app/components/admin/developer-center/RepairActionPanel';
import {
  RepairSystemStatusPanel,
  type DeveloperRepairSystemStatus,
} from '@/app/components/admin/developer-center/RepairSystemStatusPanel';
import { useRepairQueue } from '@/app/components/admin/developer-center/RepairQueueContext';
import {
  getDeveloperRepairAction,
  type RepairQueueItem,
} from '@/app/lib/developerRepairActions';
import {
  loadRepairQueueSnapshot,
  type RepairQueueSnapshot,
} from '@/app/services/accountingDeveloperCenterService';

interface Props {
  companyId: string;
}

export function RepairQueueTab({ companyId }: Props) {
  const { userRole } = useSupabase();
  const { items, sendToRepairQueue, removeFromQueue } = useRepairQueue();
  const [loading, setLoading] = useState(false);
  const [statusRefreshToken, setStatusRefreshToken] = useState(0);
  const [systemStatus, setSystemStatus] = useState<DeveloperRepairSystemStatus | null>(null);
  const [snapshot, setSnapshot] = useState<RepairQueueSnapshot | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setStatusRefreshToken((t) => t + 1);
    try {
      setSnapshot(await loadRepairQueueSnapshot(companyId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Repair queue load failed');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) void load();
  }, [companyId, load]);

  const outOfSync = snapshot?.numberingRows.filter((r) => r.status === 'out_of_sync') ?? [];

  const queueSequenceSync = (documentType: string, label: string) => {
    sendToRepairQueue({
      actionId: 'numbering.sync_sequence_to_effective_max',
      sourceTab: 'repair',
      params: { documentType },
      detectedReason: `${label} sequence out of sync`,
      severity: 'low',
      title: `Sync ${label} sequence`,
    });
    toast.success('Added to repair queue — run dry-run below');
  };

  return (
    <div className="space-y-4">
      <RepairSystemStatusPanel
        companyId={companyId}
        userRole={userRole}
        refreshToken={statusRefreshToken}
        onStatusLoaded={setSystemStatus}
      />

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh queue
        </Button>
        <span className="text-xs text-amber-400/90 flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" />
          Phase F — dry-run required before every apply · audit logged
        </span>
      </div>

      {items.length > 0 && (
        <Card className="border-violet-900/40 bg-violet-950/10">
          <CardHeader>
            <CardTitle className="text-base">Repair queue ({items.length})</CardTitle>
            <CardDescription>Confirm-gated repairs from trace tabs and numbering analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item: RepairQueueItem) => (
              <RepairActionPanel
                key={item.queueId}
                companyId={companyId}
                item={item}
                systemStatus={systemStatus}
                onRemove={() => removeFromQueue(item.queueId)}
                onApplied={load}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {snapshot && (
        <>
          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-base">Integrity Lab issues ({snapshot.issues.length})</CardTitle>
              <CardDescription>Read-only previews — apply via Developer Integrity Lab unless queued below.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto max-h-64">
              {snapshot.issuePreviews.length === 0 ? (
                <p className="text-sm text-gray-500">No open issues.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="py-2 pr-2">Rule</th>
                      <th className="py-2 pr-2">Before</th>
                      <th className="py-2">After (preview)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.issuePreviews.slice(0, 20).map((p, i) => (
                      <tr key={i} className="border-b border-gray-800/60">
                        <td className="py-2 pr-2 text-gray-300">{p.title}</td>
                        <td className="py-2 pr-2 text-gray-500 max-w-xs">{p.beforeSummary}</td>
                        <td className="py-2 text-gray-400 max-w-xs">{p.afterSummary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-base">Numbering dry-run ({outOfSync.length} out of sync)</CardTitle>
              <CardDescription>
                Click a row to send to repair queue. Action: {getDeveloperRepairAction('numbering.sync_sequence_to_effective_max')?.id}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Seq last</th>
                    <th className="py-2 pr-2">DB max</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.numberingRows.map((row) => (
                    <tr key={row.documentType} className="border-b border-gray-800/60">
                      <td className="py-2 pr-2 text-gray-200">{row.label}</td>
                      <td className="py-2 pr-2">{row.sequenceLast}</td>
                      <td className="py-2 pr-2">{row.databaseMax}</td>
                      <td className="py-2 pr-2">
                        {row.status === 'ok' ? (
                          <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-800">ok</Badge>
                        ) : (
                          <Badge className="bg-amber-900/40 text-amber-300 border-amber-800">out_of_sync</Badge>
                        )}
                      </td>
                      <td className="py-2">
                        {row.status === 'out_of_sync' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => queueSequenceSync(row.documentType, row.label)}
                          >
                            Send to queue
                          </Button>
                        ) : (
                          <span className="text-gray-500">{row.previewAction}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {items.length === 0 && (
        <p className="text-sm text-gray-500">
          Queue is empty. Send repairs from COA Health, trace tabs, or numbering table above.
        </p>
      )}
    </div>
  );
}
