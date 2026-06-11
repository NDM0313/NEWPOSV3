import React, { useEffect, useMemo, useState } from 'react';
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
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import type { UnpostedDocumentRow } from '@/app/services/arApReconciliationCenterService';
import { validateUnpostedDocumentForPosting } from '@/app/services/arApRepairWorkflowService';
import {
  buildIllustrativePostingLines,
  enrichUnpostedDocument,
  loadUnpostedTrace,
} from '@/app/services/arApReconciliationTraceService';
import { diagnoseUnpostedRow } from '@/app/lib/arApReconciliationDiagnostics';
import { PostabilityBadge, RiskBadge } from './ArApRepairBadges';

const STEPS = ['Document', 'Validation', 'Proposed JE', 'Review'] as const;

export function PostingDryRunWizard(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: UnpostedDocumentRow | null;
  companyId: string;
  branchId: string | null | undefined;
}) {
  const { formatCurrency } = useFormatCurrency();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<Array<{ code: string; message: string }>>([]);
  const [proposedLines, setProposedLines] = useState<ReturnType<typeof buildIllustrativePostingLines>>([]);

  useEffect(() => {
    if (!props.open || !props.row) {
      setStep(0);
      setValidationIssues([]);
      setProposedLines([]);
      setStatus(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const enrichment = await enrichUnpostedDocument(props.row!);
      const validation = await validateUnpostedDocumentForPosting({
        row: props.row!,
        contextCompanyId: props.companyId,
        contextBranchId: props.branchId,
        strictBranch: false,
      });
      if (cancelled) return;
      setStatus(enrichment?.status ?? null);
      setValidationIssues(validation.issues);
      setProposedLines(buildIllustrativePostingLines(props.row!, enrichment));
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [props.open, props.row, props.companyId, props.branchId]);

  const diag = useMemo(
    () => (props.row ? diagnoseUnpostedRow(props.row, status) : null),
    [props.row, status]
  );

  const balanced = useMemo(() => {
    const dr = proposedLines.reduce((s, l) => s + l.debit, 0);
    const cr = proposedLines.reduce((s, l) => s + l.credit, 0);
    return Math.abs(dr - cr) < 0.01;
  }, [proposedLines]);

  if (!props.row) return null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Posting dry-run (preview only)</DialogTitle>
          <DialogDescription className="text-gray-400">
            Phase 2 — apply is disabled. No journal will be created.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 text-[10px] text-gray-500 mb-2">
          {STEPS.map((s, i) => (
            <span key={s} className={i === step ? 'text-blue-400 font-semibold' : ''}>
              {i + 1}. {s}
              {i < STEPS.length - 1 ? ' → ' : ''}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
          <>
            {step === 0 && (
              <div className="space-y-2 text-sm">
                {diag && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    <PostabilityBadge label={diag.label} isNonFinal={diag.isNonFinal} />
                    {diag.riskLevel && <RiskBadge level={diag.riskLevel} />}
                  </div>
                )}
                <p>
                  <span className="text-gray-500">Document:</span> {props.row.document_no}
                </p>
                <p>
                  <span className="text-gray-500">Contact:</span> {props.row.contact_name}
                </p>
                <p>
                  <span className="text-gray-500">Status:</span> {status || '—'}
                </p>
                <p>
                  <span className="text-gray-500">Open amount:</span> {formatCurrency(Number(props.row.amount) || 0)}
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3 text-sm">
                {diag?.isNonFinal ? (
                  <div className="rounded-lg border border-slate-600/50 bg-slate-900/40 p-3 flex gap-2">
                    <ShieldAlert className="w-5 h-5 text-slate-400 shrink-0" />
                    <div>
                      <p className="font-medium text-slate-200">Non-final document — no posting required yet</p>
                      <p className="text-xs text-gray-400 mt-1">
                        This document is not final. Posting is blocked until the document is finalized.
                      </p>
                    </div>
                  </div>
                ) : null}
                {validationIssues.length === 0 ? (
                  <p className="text-emerald-400 text-xs">Validation passed (branch strict mode off).</p>
                ) : (
                  <ul className="space-y-1">
                    {validationIssues.map((i) => (
                      <li key={i.code} className="text-amber-200 text-xs">
                        [{i.code}] {i.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2">
                {diag?.isNonFinal || !diag?.isPostable ? (
                  <p className="text-gray-400 text-xs">Proposed JE not shown — document not postable.</p>
                ) : proposedLines.length === 0 ? (
                  <p className="text-gray-400 text-xs">No illustrative lines (zero total).</p>
                ) : (
                  <table className="w-full text-xs border border-gray-800 rounded-lg overflow-hidden">
                    <thead className="bg-gray-900 text-gray-500">
                      <tr>
                        <th className="text-left p-2">Account</th>
                        <th className="text-right p-2">Dr</th>
                        <th className="text-right p-2">Cr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposedLines.map((l, idx) => (
                        <tr key={idx} className="border-t border-gray-800">
                          <td className="p-2">
                            {l.account_label}
                            <span className="block text-gray-600">{l.description}</span>
                          </td>
                          <td className="p-2 text-right tabular-nums">{l.debit ? formatCurrency(l.debit) : '—'}</td>
                          <td className="p-2 text-right tabular-nums">{l.credit ? formatCurrency(l.credit) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {proposedLines.length > 0 && (
                  <p className={balanced ? 'text-emerald-400 text-xs' : 'text-red-400 text-xs'}>
                    Balance check: {balanced ? 'Balanced (illustrative)' : 'Imbalanced — review before Phase 3 apply'}
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-100">
                <p className="font-semibold">Phase 2 — apply disabled</p>
                <p className="mt-1 text-gray-400">
                  Posting to GL will require typed confirmation in Phase 3. No changes were made to journals, payments, or
                  documents.
                </p>
                {diag && <p className="mt-2">{diag.suggestedAction}</p>}
              </div>
            )}
          </>
        )}

        <DialogFooter className="gap-2 flex-wrap justify-between sm:justify-end">
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" className="border-gray-700" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < STEPS.length - 1 && (
              <Button className="bg-blue-600 hover:bg-blue-500" disabled={loading} onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            )}
          </div>
          <Button variant="outline" className="border-gray-700" onClick={() => props.onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
