import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import {
  buildGlCorrectionDraftDryRun,
  GL_CORRECTION_CONFIRM_PHRASE,
  isRental1100LeakageDefectId,
  knownOrphanDefectById,
  type GlCorrectionDraftDryRun,
} from '@/app/lib/glCorrectionDraftRepair';
import {
  buildOrphanArDraftPreview,
  fetchRentalLeakageDraftPreviewFromServer,
} from '@/app/lib/arControlOrphanRepair';
import { isValidRepairConfirmPhrase } from '@/app/lib/repairQueueDryRun';
import { actionRequiresGlCorrectionRpc, resolveRepairApplyBlockReasons } from '@/app/lib/developerRepairApplyGate';
import { canApplyDeveloperRepair } from '@/app/lib/developerAccountingAccess';
import { applyDeveloperRepair } from '@/app/services/developerRepairService';
import { loadDeveloperRepairSystemStatus } from '@/app/services/developerRepairSystemStatusService';
import { notifyGlCorrectionApplied } from '@/app/lib/glCorrectionResolveStatus';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defectId: string;
  onQueue?: () => void;
  onApplied?: () => void;
  /** When set, overrides role-only check for GL correction apply (RPC probe + admin). */
  canApplyGlRepair?: boolean;
}

export function GlCorrectionDraftModal({ open, onOpenChange, defectId, onQueue, onApplied, canApplyGlRepair }: Props) {
  const { companyId, userId, userRole } = useSupabase();
  const [preview, setPreview] = useState<GlCorrectionDraftDryRun | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [glCorrectionRpcAvailable, setGlCorrectionRpcAvailable] = useState(false);

  const canApplyRole = canApplyGlRepair ?? canApplyDeveloperRepair(userRole);

  useEffect(() => {
    if (!open || !companyId) return;
    void loadDeveloperRepairSystemStatus(companyId, userRole).then((s) => {
      setGlCorrectionRpcAvailable(s.probe.glCorrectionRpcAvailable);
    });
  }, [open, companyId, userRole]);

  const runDryRun = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const known = knownOrphanDefectById(defectId);
      if (known) {
        setPreview(buildGlCorrectionDraftDryRun(known));
        toast.success('GL correction dry-run ready');
        return;
      }
      if (isRental1100LeakageDefectId(defectId)) {
        const serverPreview = await fetchRentalLeakageDraftPreviewFromServer(companyId, defectId);
        if (!serverPreview) {
          toast.error(`Defect not found or already corrected: ${defectId}`);
          setPreview(null);
          return;
        }
        setPreview(serverPreview);
        toast.success('GL correction dry-run ready');
        return;
      }
      const fallback = buildOrphanArDraftPreview(defectId);
      if (!fallback) {
        toast.error(`Unknown defect: ${defectId}`);
        return;
      }
      setPreview(fallback);
      toast.success('GL correction dry-run ready');
    } finally {
      setLoading(false);
    }
  }, [defectId, companyId]);

  useEffect(() => {
    if (open && !preview) runDryRun();
  }, [open, preview, runDryRun]);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setConfirmPhrase('');
    }
  }, [open]);

  const applyGate = resolveRepairApplyBlockReasons({
    canApply: canApplyRole,
    dryRun: preview
      ? { ok: preview.ok, dryRunHash: preview.dryRunHash, before: preview.before, afterPreview: preview.afterPreview }
      : null,
    confirmPhrase,
    expectedPhrase: GL_CORRECTION_CONFIRM_PHRASE,
    applying,
    actionRequiresGlCorrectionRpc: actionRequiresGlCorrectionRpc('gl.create_correction_draft'),
    glCorrectionRpcAvailable,
  });

  const handleApply = async () => {
    if (applyGate.blocked || !preview || !companyId) {
      toast.error(applyGate.reasons[0]?.message || 'Apply blocked');
      return;
    }
    setApplying(true);
    try {
      const res = await applyDeveloperRepair(
        'gl.create_correction_draft',
        { defectId },
        preview.dryRunHash,
        confirmPhrase,
        { companyId, userId, userRole }
      );
      if (res.ok) {
        toast.success(res.message || 'GL correction applied');
        notifyGlCorrectionApplied(companyId);
        onApplied?.();
        onOpenChange(false);
      } else {
        toast.error(res.error || 'Apply failed');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#0B0F19] border-gray-800 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>GL Correction Draft — Dry Run</DialogTitle>
          <DialogDescription className="text-gray-400">
            Preview additive correction JE only. Existing JE rows are never edited or deleted.
          </DialogDescription>
        </DialogHeader>

        {loading && !preview ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : preview ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-red-900/40 text-red-300 border-red-800">{preview.riskLevel} risk</Badge>
              {glCorrectionRpcAvailable ? (
                <Badge variant="outline" className="border-emerald-600 text-emerald-300">
                  Apply enabled (targeted RPC)
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-600 text-amber-300">
                  Apply blocked — migration not applied
                </Badge>
              )}
            </div>

            <div className="rounded border border-rose-800/50 bg-rose-950/25 p-3 text-rose-100/90 text-xs">
              <p className="font-medium">This creates a new correction journal entry. It does not edit history.</p>
              <p className="text-gray-400 mt-1">
                Source journal lines remain unchanged. Broad AR/AP post/reverse/repost stays disabled.
              </p>
            </div>

            <Section title="Original wrong rows (unchanged)">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-1">JE</th>
                    <th className="text-left py-1">Account</th>
                    <th className="text-right py-1">Dr</th>
                    <th className="text-right py-1">Cr</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.originalWrongRows.map((r) => (
                    <tr key={`${r.entryNo}-${r.accountCode}`}>
                      <td className="py-1">{r.entryNo}</td>
                      <td className="py-1">{r.accountCode}</td>
                      <td className="py-1 text-right tabular-nums">{r.debit || '—'}</td>
                      <td className="py-1 text-right tabular-nums">{r.credit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-500 mt-1">{preview.originalWrongRows[0]?.note}</p>
            </Section>

            <Section title="New correction JE preview">
              <p className="text-gray-400 text-xs mb-2">{preview.newCorrectionJePreview.description}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-1">Account</th>
                    <th className="text-right py-1">Dr</th>
                    <th className="text-right py-1">Cr</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.newCorrectionJePreview.lines.map((l) => (
                    <tr key={l.accountCode}>
                      <td className="py-1">{l.accountCode}</td>
                      <td className="py-1 text-right tabular-nums">{l.debit || '—'}</td>
                      <td className="py-1 text-right tabular-nums">{l.credit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-800 font-medium">
                    <td className="py-1">Totals</td>
                    <td className="py-1 text-right">{preview.newCorrectionJePreview.totalDebit}</td>
                    <td className="py-1 text-right">{preview.newCorrectionJePreview.totalCredit}</td>
                  </tr>
                </tfoot>
              </table>
              {preview.newCorrectionJePreview.balanced ? (
                <p className="text-emerald-400 text-xs mt-1">Balanced Dr/Cr</p>
              ) : (
                <p className="text-red-400 text-xs mt-1">Unbalanced — do not apply</p>
              )}
            </Section>

            <Section title="Before / after balances">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <BalanceCell label="Raw GL party AR before" value={preview.balances.rawGlPartyBefore} />
                <BalanceCell label="Raw GL party AR after" value={preview.balances.rawGlPartyAfter} />
                <BalanceCell label="Normal statement before" value={preview.balances.normalStatementBefore} />
                <BalanceCell label="Normal statement after" value={preview.balances.normalStatementAfter} />
              </div>
              <p className="text-[11px] text-gray-500 mt-2">{preview.balances.auditImpact}</p>
            </Section>

            {!glCorrectionRpcAvailable ? (
              <div className="rounded border border-amber-800/50 bg-amber-950/30 p-3 flex gap-2 text-amber-200/90 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-medium">Apply requires migration on database</p>
                  <p className="text-gray-400 mt-1">{preview.blockedApplyReason}</p>
                  <p className="text-gray-500 mt-1 font-mono text-[10px]">
                    migrations/20260618140000_hybrid_repair_gl_correction_targets.sql
                  </p>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs text-gray-500">Confirm phrase</label>
              <Input
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder={GL_CORRECTION_CONFIRM_PHRASE}
                className="bg-gray-950 border-gray-700 font-mono text-sm"
              />
              {!isValidRepairConfirmPhrase(confirmPhrase, GL_CORRECTION_CONFIRM_PHRASE) && confirmPhrase ? (
                <p className="text-xs text-red-400">Phrase must match exactly: {GL_CORRECTION_CONFIRM_PHRASE}</p>
              ) : null}
            </div>

            {applyGate.blocked && applyGate.reasons.length ? (
              <ul className="text-xs text-gray-400 space-y-1">
                {applyGate.reasons.map((r) => (
                  <li key={r.code}>• {r.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Could not load dry-run.</p>
        )}

        {preview ? (
          <p className="text-[11px] text-gray-500 border-t border-gray-800 pt-3">
            <strong className="text-gray-400">Dry-run = preview only.</strong> Click Apply GL Correction + confirm phrase
            to post the correction JE.
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="border-gray-600" onClick={() => runDryRun()} disabled={loading}>
            Re-run dry-run
          </Button>
          {onQueue ? (
            <Button type="button" variant="outline" className="border-violet-600 text-violet-200" onClick={onQueue}>
              Send to repair queue
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={applyGate.blocked || applying}
            className="bg-amber-700 hover:bg-amber-600"
            onClick={() => void handleApply()}
          >
            {applying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Apply GL Correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</h4>
      {children}
    </div>
  );
}

function BalanceCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-800 p-2 bg-gray-950/50">
      <p className="text-gray-500 text-[10px]">{label}</p>
      <p className="tabular-nums text-white">Rs {value.toLocaleString()}</p>
    </div>
  );
}
