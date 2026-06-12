/**
 * Hybrid repair panel — admin-only manual + auto-fix for AR/AP Reconciliation Center.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Play, Search, Wrench, Zap } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import type { ArApReconciliationAccess } from '@/app/lib/arApReconciliationAccess';
import { GL_CORRECTION_CONFIRM_PHRASE } from '@/app/lib/glCorrectionDraftRepair';
import { hybridIdToOrphanDefectId } from '@/app/lib/arControlOrphanRepair';
import {
  applyHybridRepairCandidate,
  dryRunHybridRepairCandidate,
  filterAutoApplyCandidates,
  getHybridAutoFixEnabled,
  listHybridRepairCandidates,
  runBatchHybridRepair,
  setHybridAutoFixEnabled,
  type HybridRepairBatchProgress,
  type HybridRepairCandidate,
} from '@/app/services/hybridRepairEngineService';
import type { HybridRepairBatchResult } from '@/app/lib/hybridRepairEngineLogic';
import { HybridJeTraceDialog } from './HybridJeTraceDialog';

type Props = {
  companyId: string | null;
  branchId: string | null | undefined;
  asOfDate: string;
  access: ArApReconciliationAccess;
  onRefresh: () => void;
  onOpenGlCorrectionDraft: (defectId: string) => void;
};

function categoryLabel(cat: HybridRepairCandidate['category']): string {
  switch (cat) {
    case 'orphan_ar_gl_correction':
      return 'Orphan AR JV';
    case 'expense_payment_sync':
      return 'Expense sync';
    case 'control_unmapped_diagnostic':
      return '1100 diagnostic';
    default:
      return cat;
  }
}

function riskBadgeClass(risk: HybridRepairCandidate['riskLevel']): string {
  switch (risk) {
    case 'high':
      return 'bg-red-900/40 text-red-300 border-red-800';
    case 'medium':
      return 'bg-amber-900/40 text-amber-200 border-amber-800';
    default:
      return 'bg-emerald-900/40 text-emerald-300 border-emerald-800';
  }
}

function CandidateTable({
  rows,
  applyingId,
  access,
  formatCurrency,
  onFixDraft,
  onApprovePost,
  onTraceJe,
}: {
  rows: HybridRepairCandidate[];
  applyingId: string | null;
  access: ArApReconciliationAccess;
  formatCurrency: (n: number) => string;
  onFixDraft: (row: HybridRepairCandidate) => void;
  onApprovePost: (row: HybridRepairCandidate) => void;
  onTraceJe: (row: HybridRepairCandidate) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800 bg-gray-900/50">
            <th className="text-left py-2 px-3">Category</th>
            <th className="text-left py-2 px-3">Issue</th>
            <th className="text-right py-2 px-3">Amount</th>
            <th className="text-left py-2 px-3">Risk</th>
            <th className="text-right py-2 px-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const journalEntryId = String(row.params.journalEntryId || '');
            const entryNo = String(row.params.entryNo || '');
            const canTrace = Boolean(journalEntryId);

            return (
              <tr key={row.id} className="border-b border-gray-800/80 hover:bg-gray-900/30">
                <td className="py-2 px-3 text-gray-400">{categoryLabel(row.category)}</td>
                <td className="py-2 px-3">
                  <div className="text-gray-200">{row.title}</div>
                  {row.description ? <div className="text-gray-500 mt-0.5">{row.description}</div> : null}
                  {entryNo ? (
                    <div className="text-gray-600 mt-0.5 font-mono text-[10px]">Source: {entryNo}</div>
                  ) : null}
                  {row.blockedReason ? (
                    <div className="text-amber-400/90 mt-0.5">{row.blockedReason}</div>
                  ) : null}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-300">{formatCurrency(row.amount)}</td>
                <td className="py-2 px-3">
                  <Badge className={cn('text-[10px]', riskBadgeClass(row.riskLevel))}>{row.riskLevel}</Badge>
                </td>
                <td className="py-2 px-3 text-right">
                  <div className="flex justify-end gap-1 flex-wrap">
                    {canTrace ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] border-gray-700"
                        onClick={() => onTraceJe(row)}
                      >
                        <Search className="w-3 h-3 mr-1" />
                        Trace JE
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] border-gray-700"
                      onClick={() => onFixDraft(row)}
                    >
                      Fix Entry (Draft)
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-[11px] bg-emerald-700 hover:bg-emerald-600"
                      disabled={
                        !row.canManualApply ||
                        applyingId === row.id ||
                        (row.category === 'orphan_ar_gl_correction' && !access.canApplyGlRepair)
                      }
                      onClick={() => void onApprovePost(row)}
                    >
                      {applyingId === row.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Approve & Post'
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function HybridRepairPanel({
  companyId,
  branchId,
  asOfDate,
  access,
  onRefresh,
  onOpenGlCorrectionDraft,
}: Props) {
  const { userId, userRole } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [autoFix, setAutoFix] = useState(() => getHybridAutoFixEnabled());
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<HybridRepairCandidate[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<HybridRepairBatchProgress | null>(null);
  const [batchResult, setBatchResult] = useState<HybridRepairBatchResult | null>(null);
  const [glConfirmOpen, setGlConfirmOpen] = useState<HybridRepairCandidate | null>(null);
  const [glConfirmPhrase, setGlConfirmPhrase] = useState('');
  const [pendingDryRunHash, setPendingDryRunHash] = useState<string | null>(null);
  const [traceJe, setTraceJe] = useState<{ journalEntryId: string; entryNo?: string } | null>(null);

  const repairCtx = {
    companyId: companyId || '',
    userId,
    userRole,
  };

  const loadCandidates = useCallback(async () => {
    if (!companyId) {
      setCandidates([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await listHybridRepairCandidates(companyId, branchId, asOfDate);
      setCandidates(rows);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, asOfDate]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const diagnosticRows = useMemo(
    () => candidates.filter((c) => c.diagnosticOnly),
    [candidates]
  );
  const applyableRows = useMemo(
    () => candidates.filter((c) => !c.diagnosticOnly),
    [candidates]
  );
  const autoEligible = filterAutoApplyCandidates(candidates);
  const applyableCount = applyableRows.filter((c) => c.canManualApply).length;
  const rentalPendingCount = applyableRows.filter((r) => r.title.includes('Rental 1100 leakage')).length;
  const [diagExplainOpen, setDiagExplainOpen] = useState(false);

  const mainDiagnostic = diagnosticRows.find((r) => r.id === 'control-unmapped:1100');
  const diagnosticResidual = mainDiagnostic?.amount ?? 0;
  const rentalRepairTotal = applyableRows
    .filter((r) => r.title.includes('Rental 1100 leakage'))
    .reduce((s, r) => s + Math.abs(r.amount), 0);
  const batchEligibleTotal = autoEligible.reduce((s, r) => s + Math.abs(r.amount), 0);
  const diagnosticSnapshot = mainDiagnostic?.params?.diagnostic as
    | { glAccountBalance?: number | null; partyAttributedGlSum?: number | null }
    | undefined;

  const onToggleAutoFix = (checked: boolean) => {
    setAutoFix(checked);
    setHybridAutoFixEnabled(checked);
  };

  const handleFixDraft = (row: HybridRepairCandidate) => {
    if (row.category === 'orphan_ar_gl_correction') {
      const defectId = hybridIdToOrphanDefectId(row.id);
      if (defectId) onOpenGlCorrectionDraft(defectId);
      return;
    }
    toast.message('Dry-run preview', { description: row.description || row.title });
  };

  const handleTraceJe = (row: HybridRepairCandidate) => {
    const journalEntryId = String(row.params.journalEntryId || '');
    if (!journalEntryId) {
      toast.message('No source journal linked', { description: row.title });
      return;
    }
    setTraceJe({ journalEntryId, entryNo: String(row.params.entryNo || '') });
  };

  const handleApprovePost = async (row: HybridRepairCandidate) => {
    if (!companyId || row.diagnosticOnly || !row.canManualApply) return;

    const dry = await dryRunHybridRepairCandidate(row, repairCtx);
    if (!dry.ok || !dry.dryRunHash) {
      toast.error(dry.blockedReason || 'Dry-run failed');
      return;
    }

    if (row.category === 'orphan_ar_gl_correction') {
      setPendingDryRunHash(dry.dryRunHash);
      setGlConfirmOpen(row);
      setGlConfirmPhrase('');
      return;
    }

    setApplyingId(row.id);
    try {
      const res = await applyHybridRepairCandidate(row, repairCtx, { dryRunHash: dry.dryRunHash });
      if (res.ok) {
        toast.success(res.message || 'Repair applied');
        onRefresh();
        void loadCandidates();
      } else {
        toast.error(res.error || 'Apply failed');
      }
    } finally {
      setApplyingId(null);
    }
  };

  const confirmGlApply = async () => {
    if (!glConfirmOpen || !pendingDryRunHash) return;
    setApplyingId(glConfirmOpen.id);
    try {
      const res = await applyHybridRepairCandidate(glConfirmOpen, repairCtx, {
        dryRunHash: pendingDryRunHash,
        confirmPhrase: glConfirmPhrase,
      });
      if (res.ok) {
        toast.success(res.message || 'GL correction posted');
        setGlConfirmOpen(null);
        onRefresh();
        void loadCandidates();
      } else {
        toast.error(res.error || 'Apply failed');
      }
    } finally {
      setApplyingId(null);
    }
  };

  const runBatch = async () => {
    if (!companyId) return;
    setBatchRunning(true);
    setBatchProgress(null);
    setBatchResult(null);
    try {
      const result = await runBatchHybridRepair(candidates, repairCtx, {
        onProgress: (p) => {
          setBatchProgress(p);
          if (p.total > 3) {
            toast.message(`Applying repairs… ${p.done}/${p.total}`, {
              id: 'hybrid-batch-progress',
              duration: 2000,
            });
          }
        },
      });
      setBatchResult(result);
      setBatchOpen(false);
      const parts = [
        result.applied.length ? `${result.applied.length} applied` : null,
        result.skipped.length ? `${result.skipped.length} skipped` : null,
        result.errors.length ? `${result.errors.length} errors` : null,
      ].filter(Boolean);
      toast.success('Batch reconciliation fix complete', {
        description: parts.join(' · ') || 'Nothing to apply',
      });
      onRefresh();
      void loadCandidates();
    } finally {
      setBatchRunning(false);
      setBatchProgress(null);
      toast.dismiss('hybrid-batch-progress');
    }
  };

  if (!access.canUseHybridRepair) return null;

  return (
    <div id="hybrid-repair-panel" className="rounded-xl border border-violet-500/35 bg-violet-950/20 p-4 space-y-4 scroll-mt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Wrench className="w-5 h-5 text-violet-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-violet-100">Hybrid Repair (Admin Only)</h3>
            <p className="text-xs text-gray-400 mt-0.5 max-w-2xl">
              Safe repairs: additive GL correction JVs (orphan AR + rental 1100 leakage per line) and expense payment
              sync. The top 1100 residual row is a summary only — fix each rental leakage row below (or use Auto-Fix).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoFix}
              onChange={(e) => onToggleAutoFix(e.target.checked)}
              className="rounded border-gray-600"
            />
            Enable Auto-Fix
          </label>
          {autoFix ? (
            <Button
              size="sm"
              className="gap-1.5 bg-violet-600 hover:bg-violet-500"
              disabled={autoEligible.length === 0 || batchRunning}
              onClick={() => setBatchOpen(true)}
            >
              <Zap className="w-3.5 h-3.5" />
              Run Full Reconciliation Fix ({autoEligible.length})
            </Button>
          ) : null}
          <Button size="sm" variant="outline" className="border-gray-700" onClick={() => void loadCandidates()}>
            Refresh
          </Button>
        </div>
      </div>

      {!access.canApplyGlRepair && (
        <p className="text-[11px] text-amber-300/90">
          GL correction apply blocked — deploy migration{' '}
          <code className="text-amber-200">20260618140000_hybrid_repair_gl_correction_targets.sql</code> on database.
          Expense sync may still be available.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-xs text-gray-500 py-2">No repair candidates detected for current company scope.</p>
      ) : (
        <div className="space-y-4">
          {diagnosticRows.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-amber-200/90 uppercase tracking-wide">
                  COA diagnostic (not directly fixable)
                </p>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-violet-300"
                    onClick={() =>
                      document.getElementById('receivables-variance-breakdown')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }
                  >
                    Open variance breakdown
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-slate-300"
                    onClick={() =>
                      document.getElementById('unposted-queue-1a')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }
                  >
                    Open unposted orders
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 text-xs space-y-2">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left text-amber-100 font-medium"
                  onClick={() => setDiagExplainOpen((v) => !v)}
                >
                  <span>Why ~{formatCurrency(diagnosticResidual)} diagnostic vs actionable repairs?</span>
                  <span className="text-gray-500">{diagExplainOpen ? '▾' : '▸'}</span>
                </button>
                {diagExplainOpen ? (
                  <div className="text-gray-400 space-y-1.5 leading-relaxed">
                    <p>
                      <strong className="text-gray-300">Control 1100 header TB:</strong>{' '}
                      {diagnosticSnapshot?.glAccountBalance != null
                        ? formatCurrency(diagnosticSnapshot.glAccountBalance)
                        : '—'}
                    </p>
                    <p>
                      <strong className="text-gray-300">Party-attributed subtree sum:</strong>{' '}
                      {diagnosticSnapshot?.partyAttributedGlSum != null
                        ? formatCurrency(diagnosticSnapshot.partyAttributedGlSum)
                        : '—'}
                    </p>
                    <p>
                      <strong className="text-gray-300">Rental 1100 repair eligible (below):</strong>{' '}
                      {formatCurrency(rentalRepairTotal)} ({rentalPendingCount} rows)
                    </p>
                    <p>
                      <strong className="text-gray-300">Batch auto-fix eligible total:</strong>{' '}
                      {formatCurrency(batchEligibleTotal)}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      The diagnostic residual is structural (control id vs AR-CUS subtree). Rental GL corrections fix
                      per-line leakage — they do not zero this summary row. Use receivables variance breakdown for the
                      ~50k Operational vs GL gap.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="overflow-x-auto rounded-lg border border-amber-900/40 bg-amber-950/10">
                <table className="w-full text-xs">
                  <tbody>
                    {diagnosticRows.map((row) => (
                      <tr key={row.id} className="border-b border-amber-900/30 last:border-0">
                        <td className="py-2 px-3 text-gray-300 max-w-xl">
                          <div>{row.title}</div>
                          {row.description ? <div className="text-gray-500 mt-0.5">{row.description}</div> : null}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-amber-100 whitespace-nowrap">
                          {formatCurrency(row.amount)}
                        </td>
                        <td
                          className="py-2 px-3 text-right text-[10px] text-gray-500 max-w-[220px]"
                          title="This row measures control 1100 header vs subtree — not a per-line repair target."
                        >
                          {rentalPendingCount > 0
                            ? `Summary only — ${rentalPendingCount} rental repair${rentalPendingCount !== 1 ? 's' : ''} below`
                            : 'COA diagnostic only — all rental leakage corrections applied. Use variance breakdown for ~50k gap.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div id="hybrid-repair-applyable" className="space-y-2 scroll-mt-4">
            <p className="text-[11px] font-medium text-violet-200/90 uppercase tracking-wide">
              Applyable repairs ({applyableCount})
            </p>
            {applyableRows.length === 0 ? (
              <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-3 text-xs text-emerald-100/90">
                No per-line GL repairs pending. If variance remains, finalize order-stage sales (Section 1a) or review
                queue 2c metadata.
              </div>
            ) : (
              <CandidateTable
                rows={applyableRows}
                applyingId={applyingId}
                access={access}
                formatCurrency={formatCurrency}
                onFixDraft={handleFixDraft}
                onApprovePost={handleApprovePost}
                onTraceJe={handleTraceJe}
              />
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-500">
        {applyableCount} applyable · {autoEligible.length} auto-fix eligible · Use Trace JE on rental rows before
        posting
      </p>

      <Dialog open={batchOpen} onOpenChange={(o) => !batchRunning && setBatchOpen(o)}>
        <DialogContent className="bg-[#0B0F19] border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Run Full Reconciliation Fix</DialogTitle>
            <DialogDescription className="text-gray-400">
              Applies {autoEligible.length} safe repair(s) sequentially. Diagnostic summary rows are skipped.
            </DialogDescription>
          </DialogHeader>
          {batchRunning && batchProgress ? (
            <p className="text-xs text-violet-300">
              Progress: {batchProgress.done}/{batchProgress.total} — {batchProgress.title}
            </p>
          ) : null}
          <ul className="text-xs text-gray-300 max-h-48 overflow-y-auto space-y-1 border border-gray-800 rounded p-2">
            {autoEligible.length > 20 ? (
              <li>
                • {autoEligible.length} corrections totaling{' '}
                {formatCurrency(autoEligible.reduce((s, c) => s + c.amount, 0))} (rental 1100 leakage + orphan AR +
                expense sync)
              </li>
            ) : (
              autoEligible.map((c) => <li key={c.id}>• {c.title}</li>)
            )}
          </ul>
          <DialogFooter>
            <Button variant="outline" className="border-gray-700" disabled={batchRunning} onClick={() => setBatchOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-violet-600 gap-1.5" disabled={batchRunning} onClick={() => void runBatch()}>
              {batchRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Apply {autoEligible.length} repair(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!batchResult} onOpenChange={(o) => !o && setBatchResult(null)}>
        <DialogContent className="bg-[#0B0F19] border-gray-800 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Batch repair summary</DialogTitle>
            <DialogDescription className="text-gray-400">
              {batchResult
                ? `${batchResult.applied.length} applied · ${batchResult.skipped.length} skipped · ${batchResult.errors.length} errors`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {batchResult?.errors.length ? (
            <div className="space-y-1 text-xs text-red-300 border border-red-900/50 rounded p-2 max-h-40 overflow-y-auto">
              <p className="font-medium text-red-200">Errors</p>
              {batchResult.errors.map((e) => (
                <p key={e.id}>
                  {e.id}: {e.error}
                </p>
              ))}
            </div>
          ) : null}
          {batchResult?.skipped.length ? (
            <div className="space-y-1 text-xs text-gray-400 border border-gray-800 rounded p-2 max-h-32 overflow-y-auto">
              <p className="font-medium text-gray-300">Skipped ({batchResult.skipped.length})</p>
              {batchResult.skipped.slice(0, 15).map((s) => (
                <p key={s.id}>
                  {s.id}: {s.reason}
                </p>
              ))}
              {batchResult.skipped.length > 15 ? <p>…and {batchResult.skipped.length - 15} more</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button className="bg-violet-600" onClick={() => setBatchResult(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!glConfirmOpen} onOpenChange={(o) => !o && setGlConfirmOpen(null)}>
        <DialogContent className="bg-[#0B0F19] border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Approve GL Correction</DialogTitle>
            <DialogDescription className="text-gray-400">
              Posts additive journal voucher only. Type confirm phrase exactly.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-gray-300">{glConfirmOpen?.title}</p>
          <Input
            placeholder={GL_CORRECTION_CONFIRM_PHRASE}
            value={glConfirmPhrase}
            onChange={(e) => setGlConfirmPhrase(e.target.value)}
            className="bg-gray-900 border-gray-700"
          />
          <DialogFooter>
            <Button variant="outline" className="border-gray-700" onClick={() => setGlConfirmOpen(null)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-700"
              disabled={glConfirmPhrase.trim() !== GL_CORRECTION_CONFIRM_PHRASE || applyingId != null}
              onClick={() => void confirmGlApply()}
            >
              Post correction JV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HybridJeTraceDialog
        open={!!traceJe}
        onOpenChange={(o) => !o && setTraceJe(null)}
        journalEntryId={traceJe?.journalEntryId ?? null}
        entryNo={traceJe?.entryNo}
      />
    </div>
  );
}
