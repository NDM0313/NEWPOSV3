'use client';

import { useState, useCallback } from 'react';
import type { AccountingEntry } from '@/app/context/AccountingContext';
import { useAccounting } from '@/app/context/AccountingContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSubmitLock } from '@/app/context/LoadingContext';
import { openJournalSourceDocumentFromEntry } from '@/app/lib/openJournalSourceDocument';
import type { RoznamchaRow } from '@/app/services/roznamchaService';
import { roznamchaRowDetailReference } from '@/app/lib/roznamchaTransactionActions';

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

  const clearTransactionDetail = useCallback(() => {
    setTransactionReference(null);
    setTransactionJournalEntryIdHint(null);
    setSelectedGroupEntries(null);
    setTransactionDetailAutoEdit(false);
    setTransactionDetailAutoOpenTrace(false);
    setTransactionDetailScrollToAudit(false);
  }, []);

  const runJournalMutation = useCallback(
    (label: string, task: () => Promise<void>) => {
      void run(label, task);
    },
    [run],
  );

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
      runJournalMutation('Cancelling payment...', async () => {
        const msg = isMultiMemberChain
          ? 'Cancel this payment entirely? This voids the original posting plus every edit in the chain. Cannot be undone.'
          : 'Cancel this payment? This posts offsetting entries and removes it from live reports.';
        if (!window.confirm(msg)) return;
        await accounting.createReversalEntry(entryId);
      });
    },
    [accounting, runJournalMutation],
  );

  const handleJournalCancelEntry = useCallback(
    (entryId: string) => {
      runJournalMutation('Cancelling entry...', async () => {
        if (
          !window.confirm(
            'Cancel this journal entry? This posts offsetting entries and removes it from live reports.',
          )
        ) {
          return;
        }
        await accounting.createReversalEntry(entryId);
      });
    },
    [accounting, runJournalMutation],
  );

  const handleJournalCancelOrphan = useCallback(
    (entryId: string, paymentIdOverride?: string | null) => {
      if (!companyId) return;
      runJournalMutation('Hiding orphan receipt...', async () => {
        const entry = accounting.entries.find((e) => e.id === entryId);
        const paymentId =
          paymentIdOverride ?? entry?.metadata?.paymentId ?? null;
        if (!paymentId) throw new Error('Orphan receipt has no linked payment id.');
        if (
          !window.confirm(
            'Hide this failed receipt attempt from normal reports? The payment record and audit history are kept; no GL lines were posted.',
          )
        ) {
          return;
        }
        const { cancelOrphanManualReceipt } = await import('@/app/services/orphanReceiptService');
        await cancelOrphanManualReceipt({ companyId, paymentId });
        await accounting.refreshEntries?.();
      });
    },
    [accounting, companyId, runJournalMutation],
  );

  return {
    busy,
    transactionReference,
    transactionJournalEntryIdHint,
    selectedGroupEntries,
    transactionDetailAutoEdit,
    transactionDetailAutoOpenTrace,
    transactionDetailScrollToAudit,
    clearTransactionDetail,
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
