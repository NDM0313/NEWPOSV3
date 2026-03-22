import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/app/components/ui/utils';
import type { UnmappedJournalRow, UnpostedDocumentRow } from '@/app/services/arApReconciliationCenterService';
import {
  validateAndPostUnpostedDocument,
  fetchJournalDetailForLab,
  executeReverseRepostWizard,
  inferReverseRepostStrategy,
  suggestPartyContactsForUnmappedLine,
  saveJournalPartyContactMapping,
  type JournalDetailForLab,
  type PartyCandidate,
  type ReverseRepostStrategy,
} from '@/app/services/arApRepairWorkflowService';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

export function UnpostedRepairDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: UnpostedDocumentRow | null;
  companyId: string;
  branchId: string | null | undefined;
  canPost: boolean;
  onSuccess: () => void;
}) {
  const { formatCurrency } = useFormatCurrency();
  const [strictBranch, setStrictBranch] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!props.open) setStrictBranch(false);
  }, [props.open]);

  const handlePost = async () => {
    if (!props.row || !props.canPost) return;
    setPosting(true);
    try {
      const res = await validateAndPostUnpostedDocument({
        row: props.row,
        contextCompanyId: props.companyId,
        contextBranchId: props.branchId,
        strictBranch,
      });
      if (!res.ok) {
        toast.error(res.error || 'Posting failed');
        return;
      }
      toast.success('Journal posted', { description: res.journalEntryId ? `JE ${res.journalEntryId.slice(0, 8)}…` : '' });
      props.onOpenChange(false);
      props.onSuccess();
    } finally {
      setPosting(false);
    }
  };

  if (!props.row) return null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Create missing posting</DialogTitle>
          <DialogDescription className="text-gray-400">
            Validates document then calls the canonical document posting engine (same path as final sale/purchase flows).
            Does not silently change existing journals.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 space-y-1">
            <p>
              <span className="text-gray-500">Type:</span> <span className="font-mono">{props.row.source_type}</span>
            </p>
            <p>
              <span className="text-gray-500">Document:</span> {props.row.document_no}
            </p>
            <p>
              <span className="text-gray-500">Contact:</span> {props.row.contact_name || '—'}
            </p>
            <p>
              <span className="text-gray-500">Amount (open):</span> {formatCurrency(Number(props.row.amount) || 0)}
            </p>
            <p>
              <span className="text-gray-500">Company:</span> {props.row.company_id.slice(0, 8)}…
            </p>
            <p>
              <span className="text-gray-500">Branch:</span> {props.row.branch_id?.slice(0, 8) || '—'}…
            </p>
          </div>
          <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={strictBranch}
              onChange={(e) => setStrictBranch(e.target.checked)}
              className="rounded border-gray-600"
            />
            Require branch to match current filter (recommended if you filter by branch)
          </label>
          {!props.canPost && (
            <p className="text-amber-400 text-xs">You do not have permission to post accounting entries.</p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="border-gray-700" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-500" disabled={!props.canPost || posting} onClick={() => void handlePost()}>
            {posting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Post document to GL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function JournalRepairWizardDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  journalEntryId: string | null;
  companyId: string;
  canPost: boolean;
  onSuccess: () => void;
}) {
  const { formatCurrency } = useFormatCurrency();
  const [step, setStep] = useState<1 | 2>(1);
  const [detail, setDetail] = useState<JournalDetailForLab | null>(null);
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState<ReverseRepostStrategy>('void_only');
  const [voidReason, setVoidReason] = useState('');
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (!props.open || !props.journalEntryId) {
      setDetail(null);
      setStep(1);
      setVoidReason('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchJournalDetailForLab(props.journalEntryId)
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          const inferred = inferReverseRepostStrategy(d);
          setStrategy(inferred || 'void_only');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.open, props.journalEntryId]);

  const runExecute = async () => {
    if (!props.journalEntryId || !props.canPost) return;
    if (strategy === 'void_only' && !voidReason.trim()) {
      toast.error('Enter a void reason (audit trail).');
      return;
    }
    setExecuting(true);
    try {
      const res = await executeReverseRepostWizard({
        journalEntryId: props.journalEntryId,
        companyId: props.companyId,
        strategy,
        voidReason: voidReason.trim() || 'ar_ap_reconciliation_void',
      });
      if (!res.ok) {
        toast.error(res.error || 'Failed');
        return;
      }
      toast.success(
        strategy === 'void_only' ? 'Journal voided (not deleted)' : 'Document journals rebuilt',
        { description: res.newJournalId ? `New JE ${res.newJournalId.slice(0, 8)}…` : undefined }
      );
      props.onOpenChange(false);
      props.onSuccess();
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Journal repair wizard</DialogTitle>
          <DialogDescription className="text-gray-400">
            Step 1: Review entry. Step 2: Explicit reverse/repost — voids canonical document journals before reposting, or voids this entry only.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : !detail ? (
          <p className="text-gray-500 text-sm">Could not load journal.</p>
        ) : (
          <>
            {step === 1 && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p>
                    <span className="text-gray-500">Entry</span> <span className="font-mono text-blue-300">{detail.entry_no}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Date</span> {detail.entry_date}
                  </p>
                  <p className="col-span-2">
                    <span className="text-gray-500">Reference</span>{' '}
                    <span className="font-mono">{detail.reference_type || '—'}</span> {detail.reference_id || ''}
                  </p>
                  <p className="col-span-2">
                    <span className="text-gray-500">Branch</span> {detail.branch_id?.slice(0, 8) || '—'}…
                  </p>
                  <p className="col-span-2">
                    <span className="text-gray-500">Created by</span> {detail.created_by?.slice(0, 8) || '—'}…
                  </p>
                </div>
                <div className="rounded-lg border border-gray-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-900 text-gray-500">
                      <tr>
                        <th className="text-left p-2">Account</th>
                        <th className="text-right p-2">Dr</th>
                        <th className="text-right p-2">Cr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((l) => (
                        <tr key={l.id} className="border-t border-gray-800">
                          <td className="p-2">
                            {l.account_name}{' '}
                            <span className="text-gray-600">{l.account_code}</span>
                          </td>
                          <td className="p-2 text-right tabular-nums">{formatCurrency(Number(l.debit) || 0)}</td>
                          <td className="p-2 text-right tabular-nums">{formatCurrency(Number(l.credit) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="outline" className="border-gray-700 w-full" onClick={() => setStep(2)} disabled={detail.is_void}>
                  Continue to reverse / repost…
                </Button>
                {detail.is_void && <p className="text-amber-400 text-xs">This entry is already void.</p>}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 text-sm">
                <p className="text-gray-400 text-xs">
                  Sale/purchase document path: voids active <strong className="text-gray-300">canonical document</strong> journals for that
                  document, then posts a fresh document JE. Other journals: void this entry only (requires reason).
                </p>
                <div className="space-y-2">
                  <Label className="text-gray-300">Strategy</Label>
                  <select
                    className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-sm"
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as ReverseRepostStrategy)}
                  >
                    {inferReverseRepostStrategy(detail) === 'rebuild_sale' && (
                      <option value="rebuild_sale">Rebuild from sale document (void canonical + repost)</option>
                    )}
                    {inferReverseRepostStrategy(detail) === 'rebuild_purchase' && (
                      <option value="rebuild_purchase">Rebuild from purchase document (void canonical + repost)</option>
                    )}
                    <option value="void_only">Void this journal entry only</option>
                  </select>
                </div>
                {strategy === 'void_only' && (
                  <div className="space-y-2">
                    <Label className="text-gray-300">Void reason (required)</Label>
                    <Input
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder="e.g. duplicate posting / wrong account"
                      className="bg-gray-900 border-gray-700"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="border-gray-700" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    className="bg-amber-600 hover:bg-amber-500"
                    disabled={!props.canPost || executing || detail.is_void}
                    onClick={() => void runExecute()}
                  >
                    {executing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Confirm
                  </Button>
                </div>
                {!props.canPost && <p className="text-amber-400 text-xs">No permission to void/rebuild journals.</p>}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RelinkContactDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: UnmappedJournalRow | null;
  companyId: string;
  onSuccess: () => void;
}) {
  const [candidates, setCandidates] = useState<PartyCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PartyCandidate | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!props.open || !props.row) {
      setCandidates([]);
      setSelected(null);
      setNotes('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    suggestPartyContactsForUnmappedLine(props.row, props.companyId)
      .then((c) => {
        if (!cancelled) setCandidates(c);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.open, props.row, props.companyId]);

  const save = async () => {
    if (!props.row || !selected) {
      toast.error('Select a contact');
      return;
    }
    setSaving(true);
    try {
      const res = await saveJournalPartyContactMapping({
        companyId: props.companyId,
        journalEntryId: props.row.journal_entry_id,
        journalLineId: props.row.journal_line_id,
        partyContactId: selected.contact_id,
        suggestedFrom: selected.suggested_from,
        notes,
      });
      if (!res.ok) {
        toast.error(res.error || 'Save failed');
        return;
      }
      toast.success('Mapping saved (audit table). party_contact_id on lines is a future rollout.');
      props.onOpenChange(false);
      props.onSuccess();
    } finally {
      setSaving(false);
    }
  };

  if (!props.row) return null;

  const mappingIncomplete =
    props.row.contact_mapping_status === 'reference_whitelist_no_party_on_line' ||
    props.row.contact_mapping_status === 'unclassified_reference';

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Relink contact (audit)</DialogTitle>
          <DialogDescription className="text-gray-400">
            For mapping-incomplete journals only. Writes to <code className="text-gray-500">journal_party_contact_mapping</code> for audit;
            GL lines are unchanged until party_contact_id is implemented.
          </DialogDescription>
        </DialogHeader>
        {!mappingIncomplete && (
          <p className="text-amber-400 text-xs">
            This line is not flagged as “whitelist without party on line”. Relink is best-effort only.
          </p>
        )}
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto my-4" />
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {candidates.length === 0 ? (
              <p className="text-gray-500 text-sm">No candidates — check reference_id or add contacts.</p>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.contact_id}
                  type="button"
                  onClick={() => setSelected(c)}
                  className={cn(
                    'w-full text-left rounded-lg border p-2 text-sm transition-colors',
                    selected?.contact_id === c.contact_id
                      ? 'border-blue-500 bg-blue-950/40'
                      : 'border-gray-800 bg-gray-900/50 hover:bg-gray-800/50'
                  )}
                >
                  <span className="text-white font-medium">{c.name}</span>
                  <span className="text-gray-500 text-xs block">{c.suggested_from}</span>
                </button>
              ))
            )}
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-gray-400 text-xs">Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-gray-900 border-gray-700" />
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-gray-700" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={saving || !selected} onClick={() => void save()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
