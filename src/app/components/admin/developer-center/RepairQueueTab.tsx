import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import { canonRole } from '@/app/lib/developerAccountingAccess';
import {
  SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE,
  isValidRepairConfirmPhrase,
} from '@/app/lib/repairQueueDryRun';
import {
  applySafeSequenceSync,
  loadRepairQueueSnapshot,
  type RepairQueueSnapshot,
} from '@/app/services/accountingDeveloperCenterService';

interface Props {
  companyId: string;
}

const SUPER_ROLES = new Set(['super admin', 'superadmin', 'super_admin', 'developer']);

export function RepairQueueTab({ companyId }: Props) {
  const { userRole } = useSupabase();
  const canApply = SUPER_ROLES.has(canonRole(userRole));
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<RepairQueueSnapshot | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
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

  const applySequenceSync = async () => {
    if (!companyId || !selectedDocType) return;
    if (!canApply) {
      toast.error('Sequence sync requires super-admin or developer role');
      return;
    }
    if (!isValidRepairConfirmPhrase(confirmPhrase, SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE)) {
      toast.error(`Type confirm phrase: ${SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE}`);
      return;
    }
    setApplying(true);
    try {
      const res = await applySafeSequenceSync(companyId, selectedDocType);
      if (res.success) {
        toast.success(res.message);
        setConfirmPhrase('');
        await load();
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const outOfSync = snapshot?.numberingRows.filter((r) => r.status === 'out_of_sync') ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh queue
        </Button>
        <span className="text-xs text-amber-400/90 flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" />
          Phase D dry-run ┬╖ Phase E confirm-gated apply (sequence sync only)
        </span>
      </div>

      {snapshot && (
        <>
          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-base">Integrity Lab issues ({snapshot.issues.length})</CardTitle>
              <CardDescription>Read-only previews ΓÇö apply via Developer Integrity Lab unless Phase E action below.</CardDescription>
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
              <CardDescription>Preview from numberingMaintenanceService.analyze ΓÇö never decreases counters.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Seq last</th>
                    <th className="py-2 pr-2">DB max</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Preview action</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.numberingRows.map((row) => (
                    <tr
                      key={row.documentType}
                      className={`border-b border-gray-800/60 cursor-pointer ${selectedDocType === row.documentType ? 'bg-violet-950/30' : ''}`}
                      onClick={() => row.status === 'out_of_sync' && setSelectedDocType(row.documentType)}
                    >
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
                      <td className="py-2 text-gray-400">{row.previewAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {selectedDocType && outOfSync.some((r) => r.documentType === selectedDocType) && (
            <Card className="border-amber-900/40 bg-amber-950/10">
              <CardHeader>
                <CardTitle className="text-base">Phase E ΓÇö Confirm sequence sync</CardTitle>
                <CardDescription>
                  Selected: {selectedDocType}. Requires super-admin/developer and typed confirm phrase.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[240px]">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500">Confirm phrase</label>
                  <Input
                    value={confirmPhrase}
                    onChange={(e) => setConfirmPhrase(e.target.value)}
                    placeholder={SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE}
                    className="mt-1 bg-gray-950 border-gray-800 font-mono text-xs"
                    disabled={!canApply}
                  />
                </div>
                <Button type="button" size="sm" onClick={applySequenceSync} disabled={!canApply || applying}>
                  Apply sequence sync
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
