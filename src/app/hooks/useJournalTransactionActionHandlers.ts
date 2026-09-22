'use client';

import { useState, useCallback } from 'react';
import type { AccountingEntry } from '@/app/context/AccountingContext';
import { useAccounting } from '@/app/context/AccountingContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSubmitLock } from '@/app/context/LoadingContext';
import { openJournalSourceDocumentFromEntry } from '@/app/lib/openJournalSourceDocument';
import { manualJournalCancelConfirmMessage } from '@/app/lib/manualJournalCancelPolicy';
import type { RoznamchaRow } from '@/app/services/roznamchaService';
import { roznamchaRowDetailReference } from '@/app/lib/roznamchaTransactionActions';

export type JournalPendingConfirm =
  | {
      kind: 'cancel_entry';
      entryId: string;
      title: string;
      message: string;
      busyLabel: string;
    }
  | {
      kind: 'cancel_payment';
      entryId: string;
      title: string;
      message: string;
      busyLabel: string;
    }
  | {
      kind: 'cancel_orphan';
      entryId: string;
      paymentId: string;
      title: string;
      message: string;
      busyLabel: string;
    };

export function useJournalTransactionActionHandlers() {
  const { companyId } = useSupabase();
  const accounting = useAccounting();
  const { openDrawer, setCurrentView } = useNavigation();
  const { run, busy } = useSubmitLock();

  const [transactionReference, setTransactionReference] = useState<string | null>(null);
  const [transactionJournalEntryIdHint, setTransactionJournalEntryIdHint] = useState<string | null>(null);
  const [selectedGroupEntries, setSelectedGroupEntries] = useState<AccountingEntry[] | null>(null);
  const [transactionDetailAutoEdit, setTransactionDetailAutoEdit] = useState(false);
  const [transactionDetailAutoOpenTrace, setTransactionDetailAutoOpenTrace] = useState(false);
  const [transactionDetailScrollToAudit, setTransactionDetailScrollToAudit] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<JournalPendingConfirm | null>(null);

  const clearTransactionDetail = useCallback(() => {
    setTransactionReference(null);
    setTransactionJournalEntryIdHint(null);
    setSelectedGroupEntries(null);
    setTransactionDetailAutoEdit(false);
    setTransactionDetailAutoOpenTrace(false);
    setTransactionDetailScrollToAudit(false);
  }, []);

  const dismissPendingConfirm = useCallback(() => {
    setPendingConfirm(null);
  }, []);

  const runJournalMutation = useCallback(
    (label: string, task: () => Promise<void>) => {
      void run(label, task);
    },
    [run],
  );

  const confirmPendingJournalAction = useCallback(() => {
    if (!pendingConfirm || busy) return;
    const action = pendingConfirm;
    setPendingConfirm(null);

    if (action.kind === 'cancel_entry') {
      runJournalMutation(action.busyLabel, async () => {
        await accounting.createReversalEntry(action.entryId);
      });
      return;
    }

    if (action.kind === 'cancel_payment') {
      runJournalMutation(action.busyLabel, async () => {
        await accounting.createReversalEntry(action.entryId);
      });
      return;
    }

    if (!companyId) return;
    runJournalMutation(action.busyLabel, async () => {
      const { cancelOrphanManualReceipt } = await import('@/app/services/orphanReceiptService');
      await cancelOrphanManualReceipt({ companyId, paymentId: action.paymentId });
      await accounting.refreshEntries?.();
    });
  }, [accounting, busy, companyId, pendingConfirm, runJournalMutation]);

  const handleOpenJournalSourceDocument = useCallback(
    async (entry: AccountingEntry) => {
      await openJournalSourceDocumentFromEntry(entry, { openDrawer, setCurrentView });
    },
    [openDrawer, setCurrentView],
  );

  const openJournalEntryDetail = useCallback(
    (
      reference: string,
      journalEntryIdHint?: string | null,
      groupEntries?: AccountingEntry[] | null,
      opts?: { autoEdit?: boolean; autoTrace?: boolean; scrollAudit?: boolean },
    ) => {
      if (busy) return;
      setSelectedGroupEntries(groupEntries ?? null);
      setTransactionDetailAutoEdit(!!opts?.autoEdit);
      setTransactionDetailAutoOpenTrace(!!opts?.autoTrace);
      setTransactionDetailScrollToAudit(!!opts?.scrollAudit);
      setTransactionJournalEntryIdHint(journalEntryIdHint ?? null);
      setTransactionReference(reference);
    },
    [busy],
  );

  const openFromRoznamchaRow = useCallback(
    (row: RoznamchaRow, opts?: { autoEdit?: boolean; autoTrace?: boolean; scrollAudit?: boolean }) => {
      if (busy) return;
      const { reference, journalEntryIdHint } = roznamchaRowDetailReference(row);
      openJournalEntryDetail(reference, journalEntryIdHint, null, opts);
    },
    [busy, openJournalEntryDetail],
  );

  const openJournalEntryDetailFromEntry = useCallback(
    (
      entry: AccountingEntry,
      groupEntries: AccountingEntry[] | null,
      opts?: { autoEdit?: boolean; autoTrace?: boolean; scrollAudit?: boolean },
    ) => {
      openJournalEntryDetail(entry.id, entry.id, groupEntries, opts);
    },
    [openJournalEntryDetail],
  );

  const handleJournalUndoLastChange = useCallback(
    (paymentId: string) => {
      runJournalMutation('Undoing edit...', async () => {
        if (
          !window.confirm(
            'Undo the last edit on this payment? This voids the latest adjustment and restores the previous state.',
          )
        ) {
          return;
        }
        await accounting.undoLastPaymentMutation(paymentId);
      });
    },
    [accounting, runJournalMutation],
  );

  const handleJournalCancelPayment = useCallback(
    (entryId: string, isMultiMemberChain: boolean) => {
      if (busy) return;
      setPendingConfirm({
        kind: 'cancel_payment',
        entryId,
        title: 'Cancel payment?',
        message: isMultiMemberChain
          ? 'Cancel this payment entirely? This voids the original posting plus every edit in the chain. Cannot be undone.'
          : 'Cancel this payment? This posts offsetting entries and removes it from live reports.',
        busyLabel: 'Cancelling payment...',
      });
    },
    [busy],
  );

  const handleJournalCancelEntry = useCallback(
    (entryId: string) => {
      if (busy) return;
      setPendingConfirm({
        kind: 'cancel_entry',
        entryId,
        title: 'Cancel entry?',
        message: manualJournalCancelConfirmMessage(false),
        busyLabel: 'Cancelling entry...',
      });
    },
    [busy],
  );

  const handleJournalCancelOrphan = useCallback(
    (entryId: string, paymentIdOverride?: string | null) => {
      if (!companyId || busy) return;
      const entry = accounting.entries.find((e) => e.id === entryId);
      const paymentId = paymentIdOverride ?? entry?.metadata?.paymentId ?? null;
      if (!paymentId) {
        console.error('[useJournalTransactionActionHandlers] Orphan receipt has no linked payment id.');
        return;
      }
      setPendingConfirm({
        kind: 'cancel_orphan',
        entryId,
        paymentId,
        title: 'Hide orphan receipt?',
        message:
          'Hide this failed receipt attempt from normal reports? The payment record and audit history are kept; no GL lines were posted.',
        busyLabel: 'Hiding orphan receipt...',
      });
    },
    [accounting.entries, busy, companyId],
  );

  return {
    busy,
    transactionReference,
    transactionJournalEntryIdHint,
    selectedGroupEntries,
    transactionDetailAutoEdit,
    transactionDetailAutoOpenTrace,
    transactionDetailScrollToAudit,
    pendingConfirm,
    clearTransactionDetail,
    dismissPendingConfirm,
    confirmPendingJournalAction,
    setTransactionDetailAutoEdit,
    setTransactionDetailAutoOpenTrace,
    setTransactionDetailScrollToAudit,
    runJournalMutation,
    handleOpenJournalSourceDocument,
    openJournalEntryDetail,
    openJournalEntryDetailFromEntry,
    openFromRoznamchaRow,
    handleJournalUndoLastChange,
    handleJournalCancelPayment,
    handleJournalCancelEntry,
    handleJournalCancelOrphan,
  };
}
