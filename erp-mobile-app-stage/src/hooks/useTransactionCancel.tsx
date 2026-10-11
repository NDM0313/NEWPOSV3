import { useCallback, useState } from 'react';
import {
  canCancelTransactionRow,
  cancelTransactionWithReversal,
  getCancelEligibility,
  resolveJournalEntryIdFromPayment,
  type CancelActionLabel,
  type CancelEligibility,
} from '../api/transactionCancel';
import type { TransactionRow } from '../api/transactions';
import { ConfirmActionSheet } from '../components/common/ConfirmActionSheet';
import { dispatchMobileAccountingInvalidated } from '../lib/dataInvalidationBus';
import { SOURCE_CONTROLLED_REFERENCE_TYPES } from '../lib/journalEntryEditPolicy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Client heuristic for Accounts / Day Book journal rows (server re-checks on confirm). */
export function canCancelJournalRow(opts: {
  journalEntryId?: string | null;
  paymentId?: string | null;
  referenceType?: string | null;
}): { show: boolean; label: CancelActionLabel } {
  const rt = String(opts.referenceType || '').toLowerCase().trim();
  if (rt === 'correction_reversal') {
    return { show: false, label: 'Cancel Entry' };
  }
  const jeId = String(opts.journalEntryId || '').trim();
  if (!jeId || !UUID_RE.test(jeId)) {
    return { show: false, label: 'Cancel Entry' };
  }
  const paymentId = String(opts.paymentId || '').trim();
  if (!paymentId && SOURCE_CONTROLLED_REFERENCE_TYPES.has(rt)) {
    return { show: false, label: 'Cancel Entry' };
  }
  return {
    show: true,
    label: paymentId && UUID_RE.test(paymentId) ? 'Cancel Payment' : 'Cancel Entry',
  };
}

export interface UseTransactionCancelOptions {
  companyId: string | null | undefined;
  branchId?: string | null;
  /** Called after a successful cancel (list refresh is caller-owned). */
  onSuccess?: () => void;
}

export function useTransactionCancel(opts: UseTransactionCancelOptions) {
  const { companyId, branchId, onSuccess } = opts;
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<CancelEligibility | null>(null);

  const dismissCancel = useCallback(() => {
    if (cancelBusy) return;
    setPendingCancel(null);
    setCancelError(null);
  }, [cancelBusy]);

  const beginCancelByJournalEntryId = useCallback(
    async (journalEntryId: string) => {
      if (!companyId) return;
      const jeId = String(journalEntryId || '').trim();
      if (!jeId) {
        setCancelError('No journal entry linked to this transaction.');
        return;
      }
      setCancelError(null);
      setCancelBusy(true);
      try {
        const eligibility = await getCancelEligibility(companyId, jeId);
        if (!eligibility.allowed) {
          setCancelError(eligibility.reason || 'Cancel not allowed for this transaction.');
          return;
        }
        setPendingCancel(eligibility);
      } finally {
        setCancelBusy(false);
      }
    },
    [companyId],
  );

  const beginCancelForTransactionRow = useCallback(
    async (tx: TransactionRow) => {
      if (!companyId) return;
      const hint = canCancelTransactionRow(tx);
      if (!hint.show) return;
      setCancelError(null);
      setCancelBusy(true);
      try {
        let jeId = hint.journalEntryId;
        if (!jeId) {
          const payId = String(tx.paymentId || tx.id || '').trim();
          if (payId) jeId = await resolveJournalEntryIdFromPayment(companyId, payId);
        }
        if (!jeId) {
          setCancelError('No journal entry linked to this transaction.');
          return;
        }
        const eligibility = await getCancelEligibility(companyId, jeId);
        if (!eligibility.allowed) {
          setCancelError(eligibility.reason || 'Cancel not allowed for this transaction.');
          return;
        }
        setPendingCancel(eligibility);
      } finally {
        setCancelBusy(false);
      }
    },
    [companyId],
  );

  const executeCancel = useCallback(async () => {
    if (!pendingCancel || !companyId) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const result = await cancelTransactionWithReversal({
        companyId,
        branchId: branchId ?? null,
        journalEntryId: pendingCancel.journalEntryId,
      });
      if (!result.ok) {
        setCancelError(result.error || 'Cancel failed.');
        return;
      }
      setPendingCancel(null);
      dispatchMobileAccountingInvalidated({
        companyId,
        branchId: branchId ?? null,
        reason: 'transaction-cancelled',
      });
      onSuccess?.();
    } finally {
      setCancelBusy(false);
    }
  }, [pendingCancel, companyId, branchId, onSuccess]);

  const CancelConfirmPortal = (
    <ConfirmActionSheet
      open={!!pendingCancel}
      title={pendingCancel?.confirmTitle ?? 'Cancel?'}
      description={pendingCancel?.confirmDescription ?? ''}
      confirmLabel={pendingCancel?.confirmLabel ?? 'Yes, Cancel'}
      cancelLabel="No"
      busy={cancelBusy}
      error={cancelError}
      onCancel={dismissCancel}
      onConfirm={() => void executeCancel()}
    />
  );

  const CancelErrorBanner =
    cancelError && !pendingCancel ? (
      <div className="fixed left-4 right-4 bottom-36 z-30 p-3 rounded-xl bg-[#7F1D1D] border border-[#EF4444] text-sm text-white shadow-lg">
        {cancelError}
        <button type="button" className="ml-3 underline text-xs" onClick={() => setCancelError(null)}>
          Dismiss
        </button>
      </div>
    ) : null;

  return {
    cancelBusy,
    cancelError,
    pendingCancel,
    setCancelError,
    dismissCancel,
    beginCancelByJournalEntryId,
    beginCancelForTransactionRow,
    executeCancel,
    CancelConfirmPortal,
    CancelErrorBanner,
    rowCancelHint: canCancelTransactionRow,
    journalCancelHint: canCancelJournalRow,
  };
}
