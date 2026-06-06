import React, { useCallback, useState } from 'react';
import { ShieldAlert, Play, CheckCircle2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import { canApplyDeveloperRepair } from '@/app/lib/developerAccountingAccess';
import {
  getDeveloperRepairAction,
  resolveConfirmPhrase,
  type RepairQueueItem,
} from '@/app/lib/developerRepairActions';
import { isValidRepairConfirmPhrase } from '@/app/lib/repairQueueDryRun';
import {
  applyDeveloperRepair,
  runDeveloperRepairDryRun,
  type DryRunResult,
} from '@/app/services/developerRepairService';

interface Props {
  companyId: string;
  item: RepairQueueItem;
  onRemove?: () => void;
  onApplied?: () => void;
}

function riskBadge(level: string) {
  if (level === 'high') return <Badge className="bg-red-900/40 text-red-300 border-red-800">high</Badge>;
  if (level === 'medium') return <Badge className="bg-amber-900/40 text-amber-300 border-amber-800">medium</Badge>;
  return <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-800">low</Badge>;
}

export function RepairActionPanel({ companyId, item, onRemove, onApplied }: Props) {
  const { userId, userRole } = useSupabase();
  const canApply = canApplyDeveloperRepair(userRole);
  const action = getDeveloperRepairAction(item.actionId);

  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const expectedPhrase = action ? resolveConfirmPhrase(action, item.params) : '';

  const runDryRun = useCallback(async () => {
    if (!action) {
      toast.error(`Unknown action: ${item.actionId}`);
      return;
    }
    setRunning(true);
    setAuditId(null);
    setResultMessage(null);
    try {
      const res = await runDeveloperRepairDryRun(item.actionId, item.params, {
        companyId,
        userId,
        userRole,
      });
      setDryRun(res);
      if (!res.ok) toast.warning(res.blockedReason || 'Dry-run blocked');
      else toast.success('Dry-run ready');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dry-run failed');
      setDryRun(null);
    } finally {
      setRunning(false);
    }
  }, [action, item.actionId, item.params, companyId, userId, userRole]);

  const apply = async () => {
    if (!action || !dryRun?.ok) {
      toast.error('Run dry-run first');
      return;
    }
    if (!canApply) {
      toast.error('Apply requires super-admin or developer role');
      return;
    }
    if (!isValidRepairConfirmPhrase(confirmPhrase, expectedPhrase)) {
      toast.error(`Type confirm phrase: ${expectedPhrase}`);
      return;
    }
    setApplying(true);
    try {
      const res = await applyDeveloperRepair(
        item.actionId,
        item.params,
        dryRun.dryRunHash,
        confirmPhrase,
        { companyId, userId, userRole }
      );
      if (res.ok) {
        toast.success(res.message || 'Repair applied');
        setResultMessage(res.message || 'Applied');
        setAuditId(res.auditId ?? null);
        setConfirmPhrase('');
        onApplied?.();
      } else {
        toast.error(res.error || 'Apply failed');
        setResultMessage(res.error || 'Failed');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  if (!action) {
    return (
      <Card className="border-red-900/40 bg-red-950/10">
        <CardContent className="py-4 text-sm text-red-300">Unknown repair action: {item.actionId}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-800 bg-gray-900/40">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {item.title || action.title}
              {riskBadge(action.riskLevel)}
            </CardTitle>
            <CardDescription className="mt-1">
              {item.detectedReason} · Source: {item.sourceTab} · {action.id}
            </CardDescription>
          </div>
          {onRemove && (
            <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <p className="text-gray-400">{action.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded border border-gray-800 bg-gray-950/60 p-2">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Before snapshot</div>
            <pre className="text-[10px] text-gray-400 whitespace-pre-wrap break-all max-h-40 overflow-auto">
              {dryRun ? JSON.stringify(dryRun.before, null, 2) : 'Run dry-run to load'}
            </pre>
          </div>
          <div className="rounded border border-gray-800 bg-gray-950/60 p-2">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">After preview</div>
            <pre className="text-[10px] text-gray-400 whitespace-pre-wrap break-all max-h-40 overflow-auto">
              {dryRun ? JSON.stringify(dryRun.afterPreview, null, 2) : 'Run dry-run to load'}
            </pre>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <Button type="button" size="sm" variant="outline" onClick={runDryRun} disabled={running}>
            <Play className="w-3 h-3 mr-1" />
            Dry-run
          </Button>
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] uppercase tracking-wider text-gray-500">Confirm phrase</label>
            <Input
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={expectedPhrase}
              className="mt-1 bg-gray-950 border-gray-800 font-mono text-xs"
              disabled={!canApply || !dryRun?.ok}
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={apply}
            disabled={!canApply || !dryRun?.ok || applying}
          >
            Apply repair
          </Button>
        </div>

        {!canApply && (
          <p className="text-amber-400/90 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            Apply disabled — super-admin or developer only
          </p>
        )}

        {dryRun && !dryRun.ok && (
          <p className="text-amber-400">{dryRun.blockedReason || 'Not safe to apply'}</p>
        )}

        {resultMessage && (
          <p className="text-gray-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {resultMessage}
            {auditId && <span className="text-gray-500 ml-2">Audit: {auditId}</span>}
          </p>
        )}

        <details className="text-gray-500">
          <summary className="cursor-pointer">What changes / never changes</summary>
          <ul className="list-disc ml-4 mt-1 space-y-0.5">
            {action.whatItChanges.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="mt-2 text-gray-600">Never: {action.whatItNeverChanges.join('; ')}</p>
          <p className="mt-1 text-gray-600">Rollback: {action.rollbackNote}</p>
        </details>
      </CardContent>
    </Card>
  );
}
