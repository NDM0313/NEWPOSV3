/**
 * Repair progress strip — AR/AP Reconciliation Center (plan 2D).
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Wrench } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { fetchGlCorrectionResolveSnapshot } from '@/app/lib/glCorrectionResolveStatus';
import { listHybridRepairCandidates } from '@/app/services/hybridRepairEngineService';

type Props = {
  companyId: string | null;
  branchId: string | null | undefined;
  asOfDate: string;
  glCorrectionRpcAvailable: boolean;
  varianceReceivables: number | null;
  refreshToken?: number;
  onScrollToHybrid?: () => void;
  onScrollToVariance?: () => void;
};

type StepState = 'done' | 'active' | 'pending' | 'warn';

function Step({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: StepState;
}) {
  const Icon =
    state === 'done' ? CheckCircle2 : state === 'active' ? Wrench : Circle;
  return (
    <div className="flex gap-2 min-w-0">
      <Icon
        className={cn(
          'w-4 h-4 shrink-0 mt-0.5',
          state === 'done' && 'text-emerald-400',
          state === 'active' && 'text-violet-400',
          state === 'warn' && 'text-amber-400',
          state === 'pending' && 'text-muted-foreground'
        )}
      />
      <div className="min-w-0">
        <p className={cn('text-xs font-medium', state === 'pending' ? 'text-muted-foreground' : 'text-gray-200')}>
          {label}
        </p>
        <p className="text-[10px] text-muted-foreground leading-snug">{detail}</p>
      </div>
    </div>
  );
}

export function ArApRepairProgressStrip({
  companyId,
  branchId,
  asOfDate,
  glCorrectionRpcAvailable,
  varianceReceivables,
  refreshToken = 0,
  onScrollToHybrid,
  onScrollToVariance,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [openApplyableCount, setOpenApplyableCount] = useState<number | null>(null);
  const [resolveSnapshot, setResolveSnapshot] = useState<Awaited<
    ReturnType<typeof fetchGlCorrectionResolveSnapshot>
  > | null>(null);

  useEffect(() => {
    if (!companyId) {
      setOpenApplyableCount(null);
      setResolveSnapshot(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [candidates, snap] = await Promise.all([
        listHybridRepairCandidates(companyId, branchId, asOfDate),
        fetchGlCorrectionResolveSnapshot(companyId, branchId),
      ]);
      if (cancelled) return;
      const applyable = candidates.filter((c) => !c.diagnosticOnly && c.canManualApply).length;
      setOpenApplyableCount(applyable);
      setResolveSnapshot(snap);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, asOfDate, refreshToken]);

  const varianceAbs = Math.abs(varianceReceivables ?? 0);
  const glRepairsClear = (resolveSnapshot?.openGlCorrectionCount ?? 1) === 0;
  const varianceOk = varianceAbs < 1.01 || (glRepairsClear && varianceAbs <= 1.5);
  const orderAdvanceVariance = glRepairsClear && varianceAbs >= 100;

  const step1: StepState = glCorrectionRpcAvailable ? 'done' : 'warn';
  const step2: StepState =
    openApplyableCount == null
      ? 'pending'
      : openApplyableCount === 0
        ? 'done'
        : 'active';
  const step3: StepState = step2 === 'done' && openApplyableCount === 0 ? 'done' : step2 === 'active' ? 'active' : 'pending';
  const step4: StepState = varianceOk ? 'done' : orderAdvanceVariance ? 'warn' : 'active';

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-950/15 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-violet-100">Repair progress</h3>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> : null}
        </div>
        <div className="flex flex-wrap gap-2 text-[10px]">
          {onScrollToHybrid && (openApplyableCount ?? 0) > 0 ? (
            <button
              type="button"
              className="text-violet-300 hover:text-violet-200 underline"
              onClick={onScrollToHybrid}
            >
              Hybrid Repair ({openApplyableCount})
            </button>
          ) : null}
          {onScrollToVariance ? (
            <button
              type="button"
              className="text-amber-300/90 hover:text-amber-200 underline"
              onClick={onScrollToVariance}
            >
              Variance breakdown
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Step
          label="1. RPC ready"
          detail={
            glCorrectionRpcAvailable
              ? 'create_gl_correction_journal deployed'
              : 'Apply migration 20260617120000 on database'
          }
          state={step1}
        />
        <Step
          label="2. Open GL defects"
          detail={
            openApplyableCount == null
              ? 'Loading…'
              : openApplyableCount === 0
                ? resolveSnapshot?.hqSlApplied
                  ? `HQ-SL resolved${resolveSnapshot.hqSlEntryNo ? ` (${resolveSnapshot.hqSlEntryNo})` : ''}; 0 rental leaks`
                  : 'No applyable orphan/rental rows'
                : `${openApplyableCount} repair(s) in Hybrid panel`
          }
          state={step2}
        />
        <Step
          label="3. Apply fixes"
          detail={
            openApplyableCount === 0
              ? 'Nothing to apply — use Hybrid if new defects appear'
              : 'Dry-run → confirm APPLY GL CORRECTION'
          }
          state={step3}
        />
        <Step
          label="4. Verify parity"
          detail={
            varianceOk
              ? 'Variance reconciled (or documented Rs 1 residual)'
              : orderAdvanceVariance
                ? `Rs ${varianceAbs.toLocaleString()} — mostly order advances; finalize unposted sales (section 1a)`
                : `Variance ${varianceAbs.toLocaleString()} — review breakdown buckets`
          }
          state={step4}
        />
      </div>
    </div>
  );
}
