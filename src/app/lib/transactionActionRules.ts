/**
 * Unified transaction action visibility for Accounting surfaces (Phase 1).
 * Delegates to journalEntryEditPolicy + unifiedTransactionEdit — no new mutation paths.
 */

import type { AccountingEntry } from '@/app/context/AccountingContext';
import {
  getJournalEntrySourceDocumentOpenTarget,
  journalReversalBlockedReason,
  type SourceDocumentOpenTarget,
} from '@/app/lib/journalEntryEditPolicy';
import { isOrphanReceiptJournalEntry, ORPHAN_RECEIPT_HIDE_HELP } from '@/app/lib/orphanReceiptPolicy';
import {
  inferTransactionKind,
  resolveUnifiedJournalEdit,
  unifiedEditButtonLabel,
  type JournalTransactionLike,
} from '@/app/lib/unifiedTransactionEdit';
import { STALE_REVERSAL_VOID_LABEL } from '@/app/lib/staleCorrectionReversalPolicy';

export type TransactionActionContext =
  | 'journal'
  | 'statement'
  | 'payment_page'
  | 'expense_page'
  | 'trace'
  | 'cash_flow'
  | 'detail_modal';

export type TransactionActionId =
  | 'view'
  | 'edit'
  | 'cancel_payment'
  | 'cancel_entry'
  | 'cancel_orphan'
  | 'void_stale_reversal'
  | 'undo_last_change'
  | 'open_source_document'
  | 'view_trace'
  | 'view_audit';

export type TransactionActionSeverity = 'default' | 'destructive' | 'secondary';

export interface TransactionAction {
  id: TransactionActionId;
  label: string;
  severity: TransactionActionSeverity;
  disabled?: boolean;
  disabledReason?: string | null;
  title?: string;
}

export interface TransactionActionRowInput extends JournalTransactionLike {
  payment_chain_member_count?: number | null;
  payment_obj?: unknown;
  journal_line_count?: number | null;
  is_orphan_receipt?: boolean;
}

const STUDIO_DOCUMENT_REFERENCE_PREFIX = 'studio_';

/** Roll back Phase 1 panel UI only when explicitly disabled. */
export function isTransactionActionPanelEnabled(): boolean {
  return import.meta.env?.VITE_TRANSACTION_ACTION_PANEL !== '0';
}

export function isStudioSourceDocumentReferenceType(referenceType: string | null | undefined): boolean {
  const rt = String(referenceType || '').toLowerCase().trim();
  return rt.startsWith(STUDIO_DOCUMENT_REFERENCE_PREFIX);
}

/** Document-root sale/purchase/rental/studio JEs — no cancel/reverse from Accounting. */
export function isSourceControlledAccountingDocument(row: TransactionActionRowInput): boolean {
  if (row.payment_id) return false;
  const rt = String(row.reference_type || '').toLowerCase().trim();
  if (isStudioSourceDocumentReferenceType(rt)) return true;
  return inferTransactionKind(row, row.payment_obj) === 'document_total';
}

export function buildTransactionActionRowFromAccountingEntry(entry: AccountingEntry): TransactionActionRowInput {
  return {
    reference_type: entry.metadata?.referenceType,
    reference_id: entry.metadata?.referenceId,
    payment_id: entry.metadata?.paymentId,
    is_void: entry.metadata?.journalEntryVoid,
    payment_chain_is_historical: rowBool(entry.metadata?.paymentChainIsHistorical),
    has_active_correction_reversal: entry.metadata?.hasActiveCorrectionReversal,
    payment_chain_member_count: entry.metadata?.paymentChainMemberCount,
    action_fingerprint: (entry.metadata as { actionFingerprint?: string } | undefined)?.actionFingerprint,
    description: entry.description,
    journal_line_count: entry.metadata?.journalLineCount,
    is_orphan_receipt: entry.metadata?.isOrphanReceipt,
  };
}

function rowBool(v: boolean | undefined | null): boolean | undefined {
  return v === true ? true : v === false ? false : undefined;
}

function hasPaymentTraceTarget(row: TransactionActionRowInput): boolean {
  if (row.payment_id) return true;
  const rt = String(row.reference_type || '').toLowerCase().trim();
  return rt === 'payment_adjustment' || rt === 'payment';
}

function normalizeEditLabel(label: string): string {
  if (label === 'Edit payment') return 'Edit Payment';
  if (label === 'Edit journal') return 'Edit Entry';
  if (label === 'Edit transfer') return 'Edit Entry';
  return label;
}

export function resolveEditActionLabel(row: TransactionActionRowInput): string | null {
  const resolution = resolveUnifiedJournalEdit(row, row.payment_obj);
  if (resolution.kind === 'blocked' || resolution.kind === 'noop' || resolution.kind === 'document_editor') {
    return null;
  }
  return normalizeEditLabel(unifiedEditButtonLabel(resolution));
}

export interface GetTransactionActionsOptions {
  allowUnifiedEdit?: boolean;
  sourceOpenTarget?: SourceDocumentOpenTarget | null;
  lockPaymentChainReverse?: boolean;
  paymentChainBlockReason?: string | null;
  isReversalRow?: boolean;
  /** When false, skip journal-only View action (detail modal). */
  includeViewAction?: boolean;
  /** Admin/owner: show Remove from live GL for stale correction_reversal rows. */
  allowStaleReversalVoid?: boolean;
  staleReversalVoidEligible?: boolean;
}

export function getTransactionActions(
  row: TransactionActionRowInput,
  context: TransactionActionContext,
  options: GetTransactionActionsOptions = {}
): TransactionAction[] {
  const actions: TransactionAction[] = [];
  const rt = String(row.reference_type || '').toLowerCase().trim();
  const isCorrectionReversal = rt === 'correction_reversal';
  const isReversalRow = options.isReversalRow === true || isCorrectionReversal;
  const includeView = options.includeViewAction !== false && context === 'journal';

  if (isReversalRow) {
    if (includeView) actions.push({ id: 'view', label: 'View', severity: 'secondary' });
    if (
      isCorrectionReversal &&
      options.allowStaleReversalVoid &&
      options.staleReversalVoidEligible &&
      row.is_void !== true
    ) {
      actions.push({
        id: 'void_stale_reversal',
        label: STALE_REVERSAL_VOID_LABEL,
        severity: 'destructive',
        title: 'Mark reversal void — removes from Cash, Trial Balance, and normal Day Book (audit trail kept)',
      });
    }
    if (hasPaymentTraceTarget(row)) {
      actions.push({ id: 'view_trace', label: 'View Trace', severity: 'secondary' });
    }
    actions.push({ id: 'view_audit', label: 'View Audit', severity: 'secondary' });
    return actions;
  }

  const reversalBlockReason = journalReversalBlockedReason(row, row.payment_obj);
  const isSourceDoc = isSourceControlledAccountingDocument(row);
  const chainPaymentId = row.payment_id ? String(row.payment_id).trim() : '';
  const chainMembers = row.payment_chain_member_count ?? 0;
  const isMultiMemberChain = chainMembers > 1 && !!chainPaymentId;
  const kind = inferTransactionKind(row, row.payment_obj);
  const isPayment = kind === 'payment';
  const lockChain = options.lockPaymentChainReverse === true;
  const chainDisabled = lockChain || !!reversalBlockReason || !!options.paymentChainBlockReason;
  const chainDisabledReason = options.paymentChainBlockReason || reversalBlockReason;

  if (includeView) {
    actions.push({ id: 'view', label: 'View', severity: 'secondary' });
  }

  if (row.is_void === true) {
    if (hasPaymentTraceTarget(row)) {
      actions.push({ id: 'view_trace', label: 'View Trace', severity: 'secondary' });
    }
    actions.push({ id: 'view_audit', label: 'View Audit', severity: 'secondary' });
    return actions;
  }

  if (isSourceDoc) {
    const hasOpenTarget =
      options.sourceOpenTarget !== undefined
        ? options.sourceOpenTarget != null
        : getJournalEntrySourceDocumentOpenTarget({
            id: row.id || '',
            date: '',
            description: row.description || '',
            amount: 0,
            type: 'debit',
            source: '',
            metadata: {
              referenceType: row.reference_type ?? undefined,
              referenceId: row.reference_id ?? undefined,
              paymentId: row.payment_id ?? undefined,
            },
          } as AccountingEntry) != null || isStudioSourceDocumentReferenceType(row.reference_type);

    if (hasOpenTarget) {
      actions.push({
        id: 'open_source_document',
        label: 'Open Source Document',
        severity: 'default',
        title: 'Open sale, purchase, rental, or studio record in its module',
      });
    }
    actions.push({ id: 'view_trace', label: 'View Trace', severity: 'secondary' });
    actions.push({ id: 'view_audit', label: 'View Audit', severity: 'secondary' });
    return actions;
  }

  const allowEdit = options.allowUnifiedEdit !== false;
  const editLabel = allowEdit && !options.paymentChainBlockReason ? resolveEditActionLabel(row) : null;
  if (editLabel) {
    actions.push({
      id: 'edit',
      label: editLabel,
      severity: 'default',
      disabled: !!options.paymentChainBlockReason,
      disabledReason: options.paymentChainBlockReason,
    });
  }

  const isOrphanReceipt =
    row.is_orphan_receipt === true ||
    isOrphanReceiptJournalEntry({
      reference_type: row.reference_type,
      payment_id: row.payment_id,
      is_void: row.is_void,
      journalLineCount: row.journal_line_count ?? undefined,
    });

  if (isOrphanReceipt && row.payment_id) {
    actions.push({
      id: 'cancel_orphan',
      label: 'Delete / Hide orphan',
      severity: 'destructive',
      title: ORPHAN_RECEIPT_HIDE_HELP,
    });
    if (hasPaymentTraceTarget(row)) {
      actions.push({ id: 'view_trace', label: 'View Trace', severity: 'secondary' });
    }
    actions.push({ id: 'view_audit', label: 'View Audit', severity: 'secondary' });
    return actions;
  }

  if (isPayment && !isCorrectionReversal) {
    if (isMultiMemberChain) {
      actions.push({
        id: 'undo_last_change',
        label: 'Undo Last Change',
        severity: 'secondary',
        disabled: chainDisabled,
        disabledReason: chainDisabledReason,
        title: chainDisabledReason || 'Undo the last edit on this payment',
      });
      actions.push({
        id: 'cancel_payment',
        label: 'Cancel Payment',
        severity: 'destructive',
        disabled: chainDisabled,
        disabledReason: chainDisabledReason,
        title: chainDisabledReason || 'Cancel entire payment chain',
      });
    } else if (!reversalBlockReason) {
      actions.push({
        id: 'cancel_payment',
        label: 'Cancel Payment',
        severity: 'destructive',
        disabled: chainDisabled,
        disabledReason: chainDisabledReason,
      });
    }
  } else if (!isPayment && !reversalBlockReason && !isCorrectionReversal) {
    actions.push({
      id: 'cancel_entry',
      label: 'Cancel Entry',
      severity: 'destructive',
      disabled: !!options.paymentChainBlockReason,
      disabledReason: options.paymentChainBlockReason,
    });
  }

  if (hasPaymentTraceTarget(row)) {
    actions.push({ id: 'view_trace', label: 'View Trace', severity: 'secondary' });
  }
  actions.push({ id: 'view_audit', label: 'View Audit', severity: 'secondary' });

  return actions;
}
