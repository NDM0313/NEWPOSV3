import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import type { UnmappedJournalRow } from '@/app/services/arApReconciliationCenterService';
import { unmappedLineItemKey, upsertArApItemFixStatus } from '@/app/services/arApReconciliationCenterService';
import {
  applyRelinkContactForTrace,
  searchPartyContactsForRelink,
  type PartyCandidate,
} from '@/app/services/arApRepairWorkflowService';
import { loadUnmappedTrace } from '@/app/services/arApReconciliationTraceService';
import { diagnoseUnmappedLine } from '@/app/lib/arApReconciliationDiagnostics';
import {
  canSaveRelinkContact,
  isJournalTraceOnlyRelinkContext,
  relinkSaveButtonLabel,
} from '@/app/lib/arApRelinkApply';
import { cn } from '@/app/components/ui/utils';
import { FalsePositiveBadge, RiskBadge } from './ArApRepairBadges';
import { useSupabase } from '@/app/context/SupabaseContext';

function ContactPickButton(props: {
  candidate: PartyCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const { candidate: c, selected, onSelect } = props;
  return (
    <button
      key={c.contact_id}
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-lg border p-2.5 text-xs transition-colors',
        selected ? 'border-blue-500 bg-blue-950/40' : 'border-gray-800 bg-gray-900/50 hover:border-gray-600'
      )}
    >
      <span className="text-white font-medium">{c.name}</span>
      <span className="text-gray-500 block mt-0.5">
        {[c.code, c.phone, c.account_code].filter(Boolean).join(' · ') || '—'}
      </span>
      <span className="text-[10px] text-gray-600 block">{c.suggested_from}</span>
    </button>
  );
}

export function RelinkDryRunWizard(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: UnmappedJournalRow | null;
  companyId: string;
  canApplyRelinkMapping?: boolean;
  onSaved?: () => void;
}) {
  const { formatCurrency } = useFormatCurrency();
  const { user } = useSupabase();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PartyCandidate[]>([]);
  const [results, setResults] = useState<PartyCandidate[]>([]);
  const [selected, setSelected] = useState<PartyCandidate | null>(null);
  const [trace, setTrace] = useState<Awaited<ReturnType<typeof loadUnmappedTrace>> | null>(null);

  useEffect(() => {
    if (!props.open || !props.row) {
      setSuggestions([]);
      setResults([]);
      setSelected(null);
      setTrace(null);
      setSearchQuery('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadUnmappedTrace(props.row),
      searchPartyContactsForRelink(props.row, props.companyId, {
        linkedContactId: null,
        limit: 500,
      }),
    ])
      .then(([t, searchOut]) => {
        if (cancelled) return;
        setTrace(t);
        setSuggestions(searchOut.suggestions);
        setResults(searchOut.results);
        if (searchOut.suggestions.length === 1) setSelected(searchOut.suggestions[0]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.open, props.row, props.companyId]);

  useEffect(() => {
    if (!props.open || !props.row) return;
    const handle = window.setTimeout(() => {
      setSearching(true);
      searchPartyContactsForRelink(props.row!, props.companyId, {
        query: searchQuery,
        linkedContactId: trace?.lineAccount?.linked_contact_id ?? null,
        limit: 500,
      })
        .then((out) => {
          setSuggestions(out.suggestions);
          setResults(out.results);
        })
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchQuery, props.open, props.row, props.companyId, trace?.lineAccount?.linked_contact_id]);

  const saveDisabledReason = useMemo(() => {
    if (!selected) return 'Select a contact to save the link.';
    if (!props.canApplyRelinkMapping) return 'You do not have permission to save contact links.';
    if (!props.row?.journal_entry_id) return 'Missing journal entry id.';
    return null;
  }, [selected, props.canApplyRelinkMapping, props.row?.journal_entry_id]);

  if (!props.row) return null;

  const diag = diagnoseUnmappedLine(props.row, trace?.payment ?? undefined, trace?.lineAccount?.linked_contact_id);
  const traceOnly = isJournalTraceOnlyRelinkContext(trace?.journal ?? null);
  const saveEnabled = canSaveRelinkContact({
    selectedContactId: selected?.contact_id,
    canApplyRelinkMapping: !!props.canApplyRelinkMapping,
    journalEntryId: props.row.journal_entry_id,
  });
  const saveLabel = relinkSaveButtonLabel(traceOnly);

  const handleSave = async () => {
    if (!selected || !saveEnabled) return;
    setSaving(true);
    try {
      const result = await applyRelinkContactForTrace({
        companyId: props.companyId,
        journalEntryId: props.row.journal_entry_id,
        journalLineId: props.row.journal_line_id,
        partyContactId: selected.contact_id,
        suggestedFrom: selected.suggested_from,
        entryNo: trace?.journal?.entry_no || props.row.entry_no,
        beforeContactName: trace?.lineAccount?.linked_contact_name,
        afterContactName: selected.name,
        traceOnly,
        notes: traceOnly
          ? 'Phase 2A trace-only contact mapping (void/reversal row — GL unchanged)'
          : 'Phase 2A contact mapping (GL unchanged)',
        appliedByUserId: user?.id ?? null,
      });
      if (!result.ok) {
        toast.error(result.error || 'Could not save link');
        return;
      }
      await upsertArApItemFixStatus(
        props.companyId,
        'unmapped_line',
        unmappedLineItemKey(props.row),
        'resolved'
      );
      if (result.alreadyMapped) {
        toast.success('Contact link already saved — marked resolved');
      } else if (result.auditWarning) {
        toast.success(traceOnly ? 'Contact link saved for trace' : 'Contact link saved', {
          description: `Audit log unavailable: ${result.auditWarning.slice(0, 80)}`,
        });
      } else {
        toast.success(traceOnly ? 'Contact link saved for trace' : 'Contact link saved');
      }
      props.onSaved?.();
      props.onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white w-[min(1050px,calc(100vw-2rem))] max-h-[80vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle>Fix Link</DialogTitle>
          <DialogDescription className="text-gray-400">
            Maps a contact to this journal line for traceability. GL debit/credit amounts and account balances are
            unchanged.
            {traceOnly ? ' This row is voided or a reversal — saving is for audit trace only.' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4 text-sm min-h-0">
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto my-6" />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <RiskBadge level={diag.riskLevel} />
                {diag.isLikelyFalsePositive && <FalsePositiveBadge />}
                {traceOnly && (
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded border border-amber-500/40 text-amber-200 bg-amber-950/30">
                    Trace only
                  </span>
                )}
              </div>

              <dl className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">JE</dt>
                  <dd className="font-mono text-blue-300">{trace?.journal?.entry_no || props.row.entry_no}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Target account</dt>
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
              </dl>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, contact code, phone, or account code…"
                  className="pl-9 bg-gray-900 border-gray-700"
                />
                {searching ? (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-500" />
                ) : null}
              </div>

              {suggestions.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase text-gray-500 font-semibold mb-2">Suggested matches</p>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {suggestions.map((c) => (
                      <ContactPickButton
                        key={`s-${c.contact_id}`}
                        candidate={c}
                        selected={selected?.contact_id === c.contact_id}
                        onSelect={() => setSelected(c)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] uppercase text-gray-500 font-semibold mb-2">
                  All contacts {results.length ? `(${results.length})` : ''}
                </p>
                <div className="space-y-2 max-h-[min(320px,40vh)] overflow-y-auto pr-1 border border-gray-800/80 rounded-lg p-2 bg-gray-900/30">
                  {results.length === 0 ? (
                    <p className="text-gray-500 text-xs p-2">No contacts match your search.</p>
                  ) : (
                    results.map((c) => (
                      <ContactPickButton
                        key={`r-${c.contact_id}`}
                        candidate={c}
                        selected={selected?.contact_id === c.contact_id}
                        onSelect={() => setSelected(c)}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 text-xs space-y-2">
                <p className="text-gray-500 uppercase text-[10px] font-semibold">Selection preview</p>
                <p>
                  <span className="text-gray-400">Selected contact:</span>{' '}
                  {selected ? selected.name : '— none —'}
                </p>
                <p>
                  <span className="text-gray-400">Target account:</span> {props.row.account_code} · {props.row.account_name}
                </p>
                <p>
                  <span className="text-gray-400">What will change:</span> contact mapping metadata (journal_party_contact_mapping)
                </p>
                <p className="text-emerald-300/90">
                  <span className="text-gray-400">What will never change:</span> GL amounts, debit/credit lines, posted balances
                </p>
                {saveDisabledReason && !saveEnabled ? (
                  <p className="text-amber-300/90">{saveDisabledReason}</p>
                ) : null}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-gray-800 shrink-0 gap-2">
          <Button variant="outline" className="border-gray-700" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className={saveEnabled ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-gray-700 cursor-not-allowed opacity-60'}
            disabled={!saveEnabled || saving}
            title={saveDisabledReason ?? undefined}
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
