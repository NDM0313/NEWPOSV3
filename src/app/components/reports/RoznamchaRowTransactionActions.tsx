'use client';

import React, { useMemo } from 'react';
import type { RoznamchaRow } from '@/app/services/roznamchaService';
import { getJournalEntrySourceDocumentOpenTarget } from '@/app/lib/journalEntryEditPolicy';
import {
  buildSyntheticAccountingEntryFromRoznamchaRow,
  buildTransactionActionRowFromRoznamchaRow,
} from '@/app/lib/roznamchaTransactionActions';
import {
  getTransactionActions,
  type TransactionActionId,
} from '@/app/lib/transactionActionRules';
import { TransactionActionPanel } from '@/app/components/accounting/TransactionActionPanel';

export interface RoznamchaRowTransactionActionsProps {
  row: RoznamchaRow;
  busy: boolean;
  allowUnifiedEdit: boolean;
  lockPaymentChainReverse?: boolean;
  onView: () => void;
  onEdit: () => void;
  onOpenSourceDocument: () => void;
  onUndoLastChange: (paymentId: string) => void;
  onCancelPayment: (journalEntryId: string) => void;
  onCancelOrphan?: (journalEntryId: string, paymentId?: string | null) => void;
  onCancelEntry: (journalEntryId: string) => void;
  onViewTrace: () => void;
  onViewAudit: () => void;
}

export function RoznamchaRowTransactionActions({
  row,
  busy,
  allowUnifiedEdit,
  lockPaymentChainReverse = false,
  onView,
  onEdit,
  onOpenSourceDocument,
  onUndoLastChange,
  onCancelPayment,
  onCancelOrphan,
  onCancelEntry,
  onViewTrace,
  onViewAudit,
}: RoznamchaRowTransactionActionsProps) {
  const syntheticEntry = useMemo(() => buildSyntheticAccountingEntryFromRoznamchaRow(row), [row]);
  const actionRow = useMemo(() => buildTransactionActionRowFromRoznamchaRow(row), [row]);
  const sourceOpen = getJournalEntrySourceDocumentOpenTarget(syntheticEntry);

  const actions = useMemo(
    () =>
      getTransactionActions(actionRow, 'journal', {
        allowUnifiedEdit,
        sourceOpenTarget: sourceOpen,
        lockPaymentChainReverse,
      }),
    [actionRow, allowUnifiedEdit, sourceOpen, lockPaymentChainReverse],
  );

  const journalEntryId = row.sourceJournalEntryId ?? syntheticEntry.id;
  const paymentId = row.sourcePaymentId ?? row.paymentIdOnJournal ?? null;

  const handleAction = (actionId: TransactionActionId) => {
    if (busy) return;
    switch (actionId) {
      case 'view':
        onView();
        break;
      case 'edit':
        onEdit();
        break;
      case 'open_source_document':
        onOpenSourceDocument();
        break;
      case 'undo_last_change':
        if (paymentId) onUndoLastChange(String(paymentId));
        break;
      case 'cancel_payment':
        onCancelPayment(journalEntryId);
        break;
      case 'cancel_orphan':
        if (onCancelOrphan) onCancelOrphan(journalEntryId, paymentId);
        else onCancelPayment(journalEntryId);
        break;
      case 'cancel_entry':
        onCancelEntry(journalEntryId);
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

  return (
    <TransactionActionPanel
      actions={actions}
      onAction={handleAction}
      disabled={busy}
      variant="journal"
      layout="dropdown"
    />
  );
}
