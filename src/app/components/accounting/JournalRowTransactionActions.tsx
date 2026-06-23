'use client';

import React, { useMemo } from 'react';
import type { AccountingEntry } from '@/app/context/AccountingContext';
import { getJournalEntrySourceDocumentOpenTarget } from '@/app/lib/journalEntryEditPolicy';
import { buildTransactionActionRowFromAccountingEntry } from '@/app/lib/transactionActionRules';
import { getTransactionActions } from '@/app/lib/transactionActionsRegistry';
import type { TransactionActionId } from '@/app/lib/transactionActionRules';
import { TransactionActionPanel } from '@/app/components/accounting/TransactionActionPanel';

export interface JournalRowTransactionActionsProps {
  entry: AccountingEntry;
  busy: boolean;
  isReversal?: boolean;
  lockPaymentChainReverse?: boolean;
  allowUnifiedEdit: boolean;
  onView: () => void;
  onEdit: () => void;
  onOpenSourceDocument: (entry: AccountingEntry) => void;
  onUndoLastChange: (paymentId: string) => void;
  onCancelPayment: (journalEntryId: string) => void;
  onCancelEntry: (journalEntryId: string) => void;
  onViewTrace: () => void;
  onViewAudit: () => void;
}

export function JournalRowTransactionActions({
  entry,
  busy,
  isReversal = false,
  lockPaymentChainReverse = false,
  allowUnifiedEdit,
  onView,
  onEdit,
  onOpenSourceDocument,
  onUndoLastChange,
  onCancelPayment,
  onCancelEntry,
  onViewTrace,
  onViewAudit,
}: JournalRowTransactionActionsProps) {
  const sourceOpen = getJournalEntrySourceDocumentOpenTarget(entry);
  const row = buildTransactionActionRowFromAccountingEntry(entry);

  const actions = useMemo(
    () =>
      getTransactionActions(row, 'journal', {
        allowUnifiedEdit,
        sourceOpenTarget: sourceOpen,
        lockPaymentChainReverse,
        isReversalRow: isReversal,
      }),
    [row, allowUnifiedEdit, sourceOpen, lockPaymentChainReverse, isReversal]
  );

  const handleAction = (actionId: TransactionActionId | 'edit_accounts') => {
    if (busy) return;
    switch (actionId) {
      case 'view':
        onView();
        break;
      case 'edit':
        onEdit();
        break;
      case 'open_source_document':
        onOpenSourceDocument(entry);
        break;
      case 'undo_last_change': {
        const paymentId = entry.metadata?.paymentId;
        if (paymentId) onUndoLastChange(String(paymentId));
        break;
      }
      case 'cancel_payment':
        onCancelPayment(entry.id);
        break;
      case 'cancel_entry':
        onCancelEntry(entry.id);
        break;
      case 'view_trace':
        onViewTrace();
        break;
      case 'view_audit':
        onViewAudit();
        break;
      default:
        break;
    }
  };

  return <TransactionActionPanel actions={actions} onAction={handleAction} disabled={busy} variant="journal" />;
}
