import { useCallback, useState } from 'react';
import { hardDeleteJournalEntry } from '../api/journalHardDelete';
import { getJournalEntryById } from '../api/accounts';
import {
  MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE,
  MANUAL_JE_HARD_DELETE_LABEL,
  canCompleteDeleteJournalRow,
  isManualJournalHardDeleteEligible,
  isPaymentHardDeleteTarget,
  isValidHardDeleteConfirmPhrase,
  manualJournalHardDeleteBlockedReason,
  manualJournalHardDeleteConfirmMessage,
  type ManualJournalHardDeleteRow,
} from '../lib/manualJournalHardDeletePolicy';
import { ConfirmActionSheet } from '../components/common/ConfirmActionSheet';
import { dispatchMobileAccountingInvalidated } from '../lib/dataInvalidationBus';

export interface UseJournalCompleteDeleteOptions {
  companyId: string | null | undefined;
  branchId?: string | null;
  onSuccess?: () => void;
}

interface PendingHardDelete {
  journalEntryId: string;
  entryNo: string | null;
  isPayment: boolean;
  confirmTitle: string;
  confirmDescription: string;
}

export function useJournalCompleteDelete(opts: UseJournalCompleteDeleteOptions) {
  const { companyId, branchId, onSuccess } = opts;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingHardDelete | null>(null);
  const [typedPhrase, setTypedPhrase] = useState('');

  const dismiss = useCallback(() => {
    if (busy) return;
    setPending(null);
    setTypedPhrase('');
    setError(null);
  }, [busy]);

  const beginCompleteDeleteByJournalEntryId = useCallback(
    async (journalEntryId: string) => {
      if (!companyId) return;
      const jeId = String(journalEntryId || '').trim();
      if (!jeId) {
        setError('No journal entry linked to this transaction.');
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const { data, error: loadErr } = await getJournalEntryById(companyId, jeId);
        if (loadErr || !data) {
          setError(loadErr || 'Journal entry not found.');
          return;
        }
        const row: ManualJournalHardDeleteRow = {
          reference_type: data.reference_type,
          reference_id: data.reference_id,
          payment_id: data.payment_id,
          description: data.description,
        };
        if (!isManualJournalHardDeleteEligible(row)) {
          setError(manualJournalHardDeleteBlockedReason(row) || 'Hard delete not allowed.');
          return;
        }
        const isPayment = isPaymentHardDeleteTarget(row);
        const entryNo = data.entry_no ? String(data.entry_no) : null;
        setTypedPhrase('');
        setPending({
          journalEntryId: jeId,
          entryNo,
          isPayment,
          confirmTitle: `Complete Delete ${entryNo || ''}?`.trim(),
          confirmDescription: manualJournalHardDeleteConfirmMessage(entryNo, { isPayment }),
        });
      } finally {
        setBusy(false);
      }
    },
    [companyId]
  );

  const executeCompleteDelete = useCallback(async () => {
    if (!pending || !companyId) return;
    if (!isValidHardDeleteConfirmPhrase(typedPhrase)) {
      setError(`Type ${MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE} exactly to confirm.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await hardDeleteJournalEntry(companyId, pending.journalEntryId);
      if (!result.success) {
        setError(result.error || 'Hard delete failed.');
        return;
      }
      setPending(null);
      setTypedPhrase('');
      dispatchMobileAccountingInvalidated({
        companyId,
        branchId: branchId ?? null,
        reason: 'transaction-hard-deleted',
      });
      onSuccess?.();
    } finally {
      setBusy(false);
    }
  }, [pending, companyId, branchId, typedPhrase, onSuccess]);

  const phraseOk = isValidHardDeleteConfirmPhrase(typedPhrase);

  const CompleteDeleteConfirmPortal = (
    <ConfirmActionSheet
      open={!!pending}
      title={pending?.confirmTitle ?? 'Complete Delete?'}
      description={pending?.confirmDescription ?? ''}
      confirmLabel="Yes, Hard Delete Forever"
      cancelLabel="No"
      busy={busy}
      error={error}
      requireTypedPhrase={MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE}
      typedPhrase={typedPhrase}
      onTypedPhraseChange={setTypedPhrase}
      confirmDisabled={!phraseOk}
      onCancel={dismiss}
      onConfirm={() => void executeCompleteDelete()}
    />
  );

  const CompleteDeleteErrorBanner =
    error && !pending ? (
      <div className="fixed left-4 right-4 bottom-36 z-30 p-3 rounded-xl bg-[#7F1D1D] border border-[#EF4444] text-sm text-white shadow-lg">
        {error}
        <button type="button" className="ml-3 underline text-xs" onClick={() => setError(null)}>
          Dismiss
        </button>
      </div>
    ) : null;

  return {
    hardDeleteBusy: busy,
    hardDeleteError: error,
    pendingHardDelete: pending,
    setHardDeleteError: setError,
    beginCompleteDeleteByJournalEntryId,
    executeCompleteDelete,
    dismissCompleteDelete: dismiss,
    CompleteDeleteConfirmPortal,
    CompleteDeleteErrorBanner,
    completeDeleteHint: canCompleteDeleteJournalRow,
    COMPLETE_DELETE_LABEL: MANUAL_JE_HARD_DELETE_LABEL,
  };
}
