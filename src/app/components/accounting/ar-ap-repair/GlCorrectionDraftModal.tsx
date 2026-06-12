import React, { useCallback, useState } from 'react';
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
  knownOrphanDefectById,
  type GlCorrectionDraftDryRun,
} from '@/app/lib/glCorrectionDraftRepair';
import { isValidRepairConfirmPhrase } from '@/app/lib/repairQueueDryRun';
import { actionRequiresGlCorrectionRpc, resolveRepairApplyBlockReasons } from '@/app/lib/developerRepairApplyGate';
import { canApplyDeveloperRepair } from '@/app/lib/developerAccountingAccess';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defectId: string;
  onQueue?: () => void;
}

export function GlCorrectionDraftModal({ open, onOpenChange, defectId, onQueue }: Props) {
  const { userRole } = useSupabase();
  const [preview, setPreview] = useState<GlCorrectionDraftDryRun | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [loading, setLoading] = useState(false);

  const canApply = canApplyDeveloperRepair(userRole);
  const glCorrectionRpcAvailable = false;

  const runDryRun = useCallback(() => {
    const defect = knownOrphanDefectById(defectId);
    if (!defect) {
      toast.error(`Unknown defect: ${defectId}`);
      return;
    }
    setLoading(true);
    try {
      const p = buildGlCorrectionDraftDryRun(defect);
      setPreview(p);
      toast.success('GL correction dry-run ready');
    } finally {
      setLoading(false);
    }
  }, [defectId]);

  React.useEffect(() => {
    if (open && !preview) runDryRun();
  }, [open, preview, runDryRun]);

  React.useEffect(() => {
    if (!open) {
      setPreview(null);
      setConfirmPhrase('');
    }
  }, [open]);

  const applyGate = resolveRepairApplyBlockReasons({
    canApply,
    dryRun: preview
      ? { ok: preview.ok, dryRunHash: preview.dryRunHash, before: preview.before, afterPreview: preview.afterPreview }
      : null,
    confirmPhrase,
    expectedPhrase: GL_CORRECTION_CONFIRM_PHRASE,
    applying: false,
    actionRequiresGlCorrectionRpc: actionRequiresGlCorrectionRpc('gl.create_correction_draft'),
    glCorrectionRpcAvailable,
  });

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
              <Badge variant="outline" className="border-amber-600 text-amber-300">
                Apply blocked until RPC migration
              </Badge>
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
              <p className="text-[11px] text-gray-500 mt-1">{preview.originalWrongRows[1]?.note}</p>
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

            <div className="rounded border border-amber-800/50 bg-amber-950/30 p-3 flex gap-2 text-amber-200/90 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <div>
                <p className="font-medium">Apply requires migration</p>
                <p className="text-gray-400 mt-1">{preview.blockedApplyReason}</p>
                <p className="text-gray-500 mt-1 font-mono text-[10px]">
                  RPC: create_gl_correction_journal(company_id, lines_json, dry_run_hash, confirm_phrase)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500">Confirm phrase (required when apply is enabled)</label>
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

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="border-gray-600" onClick={() => runDryRun()} disabled={loading}>
            Re-run dry-run
          </Button>
          {onQueue ? (
            <Button type="button" variant="outline" className="border-violet-600 text-violet-200" onClick={onQueue}>
              Send to repair queue
            </Button>
          ) : null}
          <Button type="button" disabled className="opacity-50">
            Apply (RPC pending)
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
