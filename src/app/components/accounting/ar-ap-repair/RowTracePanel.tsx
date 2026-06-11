import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import type { ManualAdjustmentRow, UnmappedJournalRow, UnpostedDocumentRow } from '@/app/services/arApReconciliationCenterService';
import {
  diagnoseUnmappedLine,
  diagnoseUnpostedRow,
  manualRowRisk,
  type ArApRiskLevel,
} from '@/app/lib/arApReconciliationDiagnostics';
import {
  loadUnmappedTrace,
  loadUnpostedTrace,
  type UnmappedTraceBundle,
  type UnpostedTraceBundle,
} from '@/app/services/arApReconciliationTraceService';
import { fetchJournalDetailForLab, type JournalDetailForLab } from '@/app/services/arApRepairWorkflowService';
import { FalsePositiveBadge, PostabilityBadge, RiskBadge } from './ArApRepairBadges';

export type TraceTarget =
  | { kind: 'unposted'; row: UnpostedDocumentRow }
  | { kind: 'unmapped'; row: UnmappedJournalRow }
  | { kind: 'manual'; row: ManualAdjustmentRow };

export function RowTracePanel(props: {
  open: boolean;
  onClose: () => void;
  target: TraceTarget | null;
  companyId: string;
}) {
  const { formatCurrency } = useFormatCurrency();
  const [loading, setLoading] = useState(false);
  const [unposted, setUnposted] = useState<UnpostedTraceBundle | null>(null);
  const [unmapped, setUnmapped] = useState<UnmappedTraceBundle | null>(null);
  const [manualJe, setManualJe] = useState<JournalDetailForLab | null>(null);

  useEffect(() => {
    if (!props.open || !props.target) {
      setUnposted(null);
      setUnmapped(null);
      setManualJe(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      if (props.target!.kind === 'unposted') {
        const b = await loadUnpostedTrace(props.target!.row);
        if (!cancelled) setUnposted(b);
      } else if (props.target!.kind === 'unmapped') {
        const b = await loadUnmappedTrace(props.target!.row);
        if (!cancelled) setUnmapped(b);
      } else {
        const j = await fetchJournalDetailForLab(props.target!.row.journal_entry_id);
        if (!cancelled) setManualJe(j);
      }
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [props.open, props.target]);

  if (!props.open) return null;

  let risk: ArApRiskLevel = 'medium';
  let queueReason = '';
  let suggested = '';
  let showFp = false;

  if (props.target?.kind === 'unposted' && unposted) {
    const d = diagnoseUnpostedRow(unposted.row, unposted.enrichment?.status);
    risk = d.riskLevel;
    queueReason = d.queueReason;
    suggested = d.suggestedAction;
  } else if (props.target?.kind === 'unmapped' && unmapped) {
    const d = diagnoseUnmappedLine(unmapped.row, unmapped.payment ?? undefined, unmapped.lineAccount?.linked_contact_id);
    risk = d.riskLevel;
    queueReason = d.queueReason;
    suggested = d.suggestedAction;
    showFp = d.isLikelyFalsePositive;
  } else if (props.target?.kind === 'manual') {
    risk = manualRowRisk(props.target.row);
    queueReason = props.target.row.description || props.target.row.detection_kind || 'Manual/suspense JE';
    suggested = 'Review in journal wizard (Phase 2: queue only).';
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close trace" onClick={props.onClose} />
      <aside className="relative w-full max-w-md bg-gray-950 border-l border-gray-800 shadow-xl overflow-y-auto max-h-full">
        <div className="sticky top-0 bg-gray-950/95 border-b border-gray-800 p-4 flex items-start justify-between gap-2 z-10">
          <div>
            <h2 className="text-lg font-semibold text-white">Row trace</h2>
            <p className="text-xs text-gray-500">Read-only — Phase 2</p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 text-gray-400" onClick={props.onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <RiskBadge level={risk} />
                {showFp && <FalsePositiveBadge />}
                {unposted && (
                  <PostabilityBadge
                    label={diagnoseUnpostedRow(unposted.row, unposted.enrichment?.status).label}
                    isNonFinal={diagnoseUnpostedRow(unposted.row, unposted.enrichment?.status).isNonFinal}
                  />
                )}
              </div>

              <Section title="Why in queue">{queueReason}</Section>
              <Section title="Suggested fix">{suggested}</Section>

              {unposted && (
                <>
                  <Section title="Source document">
                    <KV k="No" v={unposted.row.document_no || '—'} />
                    <KV k="Status" v={unposted.enrichment?.status || '—'} />
                    <KV k="Contact" v={unposted.row.contact_name || '—'} />
                    <KV k="Branch" v={unposted.enrichment?.branch_name || '—'} />
                  </Section>
                  <Section title="Linked JEs">
                    {(unposted.linkedJournals || []).length === 0 ? (
                      <p className="text-gray-500 text-xs">None</p>
                    ) : (
                      unposted.linkedJournals.map((j) => (
                        <p key={j.id} className="text-xs font-mono">
                          {j.entry_no} {j.is_void ? '(void)' : ''}
                        </p>
                      ))
                    )}
                  </Section>
                </>
              )}

              {unmapped && (
                <>
                  <Section title="Payment">
                    {unmapped.payment ? (
                      <>
                        <KV k="Ref" v={unmapped.payment.reference_number || '—'} />
                        <KV k="Amount" v={formatCurrency(unmapped.payment.amount)} />
                        <KV k="Contact" v={unmapped.payment.contact_name || '—'} />
                        <KV k="Pay ref type" v={unmapped.payment.reference_type || '—'} />
                      </>
                    ) : (
                      <p className="text-gray-500 text-xs">No payment linked</p>
                    )}
                  </Section>
                  <Section title="JE header">
                    {unmapped.journal ? (
                      <>
                        <KV k="Entry" v={unmapped.journal.entry_no || '—'} />
                        <KV k="JE ref type" v={unmapped.journal.reference_type || '—'} />
                        <KV k="Branch" v={unmapped.journal.branch_id?.slice(0, 8) || '—'} />
                      </>
                    ) : (
                      <p className="text-gray-500 text-xs">Could not load JE</p>
                    )}
                  </Section>
                  <Section title="Account / contact mapping">
                    <KV
                      k="Account"
                      v={`${unmapped.row.account_name} (${unmapped.row.account_code})`}
                    />
                    <KV k="Linked contact" v={unmapped.lineAccount?.linked_contact_name || '—'} />
                  </Section>
                  {unmapped.journal?.lines?.length ? (
                    <Section title="JE lines">
                      <table className="w-full text-[10px]">
                        <thead className="text-gray-500">
                          <tr>
                            <th className="text-left p-1">Account</th>
                            <th className="text-right p-1">Dr</th>
                            <th className="text-right p-1">Cr</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unmapped.journal.lines.map((l) => (
                            <tr key={l.id} className="border-t border-gray-800">
                              <td className="p-1">{l.account_code}</td>
                              <td className="p-1 text-right">{formatCurrency(Number(l.debit) || 0)}</td>
                              <td className="p-1 text-right">{formatCurrency(Number(l.credit) || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Section>
                  ) : null}
                </>
              )}

              {manualJe && (
                <Section title="Manual JE lines">
                  <KV k="Entry" v={manualJe.entry_no || '—'} />
                  {manualJe.lines.map((l) => (
                    <p key={l.id} className="text-xs">
                      {l.account_code}: Dr {formatCurrency(Number(l.debit) || 0)} Cr{' '}
                      {formatCurrency(Number(l.credit) || 0)}
                    </p>
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">{props.title}</p>
      <div className="text-xs text-gray-300 space-y-0.5">{props.children}</div>
    </div>
  );
}

function KV(props: { k: string; v: string }) {
  return (
    <p>
      <span className="text-gray-500">{props.k}:</span> {props.v}
    </p>
  );
}
