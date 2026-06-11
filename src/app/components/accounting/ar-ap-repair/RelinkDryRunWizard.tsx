import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import type { UnmappedJournalRow } from '@/app/services/arApReconciliationCenterService';
import {
  suggestPartyContactsForUnmappedLine,
  type PartyCandidate,
} from '@/app/services/arApRepairWorkflowService';
import { loadUnmappedTrace } from '@/app/services/arApReconciliationTraceService';
import { diagnoseUnmappedLine } from '@/app/lib/arApReconciliationDiagnostics';
import { cn } from '@/app/components/ui/utils';
import { FalsePositiveBadge, RiskBadge } from './ArApRepairBadges';

export function RelinkDryRunWizard(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: UnmappedJournalRow | null;
  companyId: string;
}) {
  const { formatCurrency } = useFormatCurrency();
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<PartyCandidate[]>([]);
  const [selected, setSelected] = useState<PartyCandidate | null>(null);
  const [trace, setTrace] = useState<Awaited<ReturnType<typeof loadUnmappedTrace>> | null>(null);

  useEffect(() => {
    if (!props.open || !props.row) {
      setCandidates([]);
      setSelected(null);
      setTrace(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadUnmappedTrace(props.row),
      suggestPartyContactsForUnmappedLine(props.row, props.companyId),
    ])
      .then(([t, c]) => {
        if (cancelled) return;
        setTrace(t);
        setCandidates(c);
        if (c.length === 1) setSelected(c[0]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.open, props.row, props.companyId]);

  if (!props.row) return null;

  const diag = diagnoseUnmappedLine(props.row, trace?.payment ?? undefined, trace?.lineAccount?.linked_contact_id);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relink contact dry-run</DialogTitle>
          <DialogDescription className="text-gray-400">
            Preview only — Phase 2 does not save mappings or change GL lines.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto my-6" />
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <RiskBadge level={diag.riskLevel} />
              {diag.isLikelyFalsePositive && <FalsePositiveBadge />}
            </div>

            {diag.isLikelyFalsePositive && diag.falsePositiveReason && (
              <p className="text-cyan-200/90 text-xs rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-2">
                {diag.falsePositiveReason}
              </p>
            )}

            <dl className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">JE</dt>
                <dd className="font-mono text-blue-300">{trace?.journal?.entry_no || props.row.entry_no}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Payment ref</dt>
                <dd>{trace?.payment?.reference_number || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Current account</dt>
                <dd>
                  {props.row.account_name} ({props.row.account_code})
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Line amount</dt>
                <dd>
                  Dr {formatCurrency(Number(props.row.debit) || 0)} / Cr {formatCurrency(Number(props.row.credit) || 0)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Current linked contact</dt>
                <dd>{trace?.lineAccount?.linked_contact_name || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Payment contact</dt>
                <dd>{trace?.payment?.contact_name || '—'}</dd>
              </div>
            </dl>

            <p className="text-[10px] uppercase text-gray-500 font-semibold">Suggested contact (preview selection)</p>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {candidates.length === 0 ? (
                <p className="text-gray-500 text-xs">No candidates from reference graph.</p>
              ) : (
                candidates.map((c) => (
                  <button
                    key={c.contact_id}
                    type="button"
                    onClick={() => setSelected(c)}
                    className={cn(
                      'w-full text-left rounded-lg border p-2 text-xs transition-colors',
                      selected?.contact_id === c.contact_id
                        ? 'border-blue-500 bg-blue-950/40'
                        : 'border-gray-800 bg-gray-900/50'
                    )}
                  >
                    <span className="text-white font-medium">{c.name}</span>
                    <span className="text-gray-500 block">{c.suggested_from}</span>
                  </button>
                ))
              )}
            </div>

            {selected && (
              <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2 text-xs">
                <p className="text-gray-500 uppercase text-[10px] font-semibold mb-1">Before → After (mapping intent)</p>
                <p>
                  <span className="text-gray-400">Before:</span> {trace?.lineAccount?.linked_contact_name || 'Unmapped'}{' '}
                  on {props.row.account_code}
                </p>
                <p>
                  <span className="text-gray-400">After (Phase 3 audit only):</span> {selected.name} → journal_party_contact_mapping
                </p>
                <p className="text-amber-400/90 mt-2">
                  Warning: current relink is audit-only until Phase 3 apply. GL journal lines are not updated in Phase 2.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="border-gray-700" onClick={() => props.onOpenChange(false)}>
            Close
          </Button>
          <Button className="bg-gray-700 cursor-not-allowed opacity-60" disabled title="Phase 3">
            Save mapping (Phase 3)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
