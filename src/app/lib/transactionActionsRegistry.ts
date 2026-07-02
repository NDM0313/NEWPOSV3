/**
 * Batch A — canonical transaction action registry for Accounting surfaces.
 * Delegates policy to transactionActionRules + unifiedTransactionEdit + journalEntryEditPolicy.
 * No new mutation paths; labels and availability only.
 */

import {
  buildTransactionActionRowFromAccountingEntry,
  getTransactionActions as getRulesTransactionActions,
  isSourceControlledAccountingDocument,
  resolveEditActionLabel,
  type GetTransactionActionsOptions,
  type TransactionAction,
  type TransactionActionContext,
  type TransactionActionId,
  type TransactionActionRowInput,
} from '@/app/lib/transactionActionRules';
import {
  resolveUnifiedJournalEdit,
  type UnifiedJournalEditResolution,
} from '@/app/lib/unifiedTransactionEdit';
import { journalReversalBlockedReason } from '@/app/lib/journalEntryEditPolicy';
import {
  HISTORICAL_PREFIX,
  stripPaymentChainHistoricalPrefix,
} from '@/app/lib/paymentChainHistorical';

export type {
  TransactionActionContext,
  TransactionActionRowInput,
  GetTransactionActionsOptions,
  TransactionActionSeverity,
} from '@/app/lib/transactionActionRules';

export {
  buildTransactionActionRowFromAccountingEntry,
  isSourceControlledAccountingDocument,
  isTransactionActionPanelEnabled,
  isStudioSourceDocumentReferenceType,
} from '@/app/lib/transactionActionRules';

/** Registry action ids — superset of rules ids for explicit edit variants. */
export type RegistryActionId =
  | TransactionActionId
  | 'edit_accounts'
  | 'edit_payment'
  | 'edit_entry'
  | 'edit_transfer'
  | 'reverse_entry';

export interface RegistryTransactionAction extends Omit<TransactionAction, 'id'> {
  id: RegistryActionId;
  /** Underlying handler id for existing mutation handlers. */
  handlerId: TransactionActionId | 'edit_accounts';
}

export interface StatementLedgerRowInput {
  journal_entry_id?: string | null;
  je_reference_type?: string | null;
  je_reference_id?: string | null;
  payment_id?: string | null;
  description?: string | null;
  je_action_fingerprint?: string | null;
  payment_voided_at?: string | null;
}

/** Inline GL grid edit — blocked for source-controlled reference types (matches TransactionDetailModal). */
export function editAccountsBlockedReason(referenceType: string | null | undefined): string | null {
  const rt = String(referenceType || '').toLowerCase().trim();
  if (rt.startsWith('sale') || rt.startsWith('purchase')) {
    return 'Sale/purchase postings are source-controlled — edit amounts in Sales or Purchases, not journal lines.';
  }
  if (rt === 'shipment') {
    return 'Shipment postings are source-controlled.';
  }
  if (rt.startsWith('opening_balance')) {
    return 'Opening balance postings are source-controlled.';
  }
  if (rt === 'commission_batch') {
    return 'Commission batch postings are source-controlled.';
  }
  if (rt === 'stock_adjustment') {
    return 'Stock adjustment postings are source-controlled.';
  }
  return null;
}

export function allowsEditAccounts(row: TransactionActionRowInput): boolean {
  if (row.is_void === true) return false;
  return editAccountsBlockedReason(row.reference_type) === null;
}

export function buildTransactionActionRowFromStatementEntry(
  entry: StatementLedgerRowInput
): TransactionActionRowInput {
  const fingerprint = String(entry.je_action_fingerprint || '');
  const paymentChainHistorical = fingerprint.startsWith(HISTORICAL_PREFIX);
  return {
    id: entry.journal_entry_id || undefined,
    reference_type: entry.je_reference_type,
    reference_id: entry.je_reference_id,
    payment_id: entry.payment_id,
    is_void: entry.payment_voided_at ? true : undefined,
    payment_chain_is_historical: paymentChainHistorical ? true : undefined,
    action_fingerprint: entry.je_action_fingerprint ?? undefined,
    description: entry.description ?? undefined,
  };
}

/** Sync PF-14 historical block from statement row fingerprint (no async chain fetch). */
export function syncPaymentChainBlockFromFingerprint(
  fingerprint?: string | null
): string | null {
  const fp = String(fingerprint || '');
  if (!fp.startsWith(HISTORICAL_PREFIX)) return null;
  return (
    stripPaymentChainHistoricalPrefix(fp) ||
    'This payment line is historical (a later edit or transfer exists). Use the latest journal row for this receipt to edit or reverse.'
  );
}

function refineEditAction(
  action: TransactionAction,
  resolution: UnifiedJournalEditResolution
): RegistryTransactionAction {
  const base = {
    ...action,
    disabled: action.disabled,
    disabledReason: action.disabledReason,
    severity: action.severity,
    title: action.title,
  };
  if (action.disabled) {
    return { ...base, id: 'edit', handlerId: 'edit' };
  }
  switch (resolution.kind) {
    case 'payment_editor':
      return { ...base, id: 'edit_payment', label: 'Edit Payment', handlerId: 'edit' };
    case 'manual_journal_editor':
      return { ...base, id: 'edit_entry', label: 'Edit Entry', handlerId: 'edit' };
    case 'transfer_editor':
      return { ...base, id: 'edit_transfer', label: 'Edit Transfer', handlerId: 'edit' };
    default:
      return { ...base, id: 'edit', handlerId: 'edit' };
  }
}

function normalizeDestructiveLabels(
  action: TransactionAction,
  context: TransactionActionContext
): RegistryTransactionAction {
  if (action.id === 'cancel_entry' && context !== 'expense_page') {
    return {
      ...action,
      id: 'reverse_entry',
      label: 'Reverse Entry',
      handlerId: 'cancel_entry',
    };
  }
  if (action.id === 'undo_last_change') {
    return { ...action, label: 'Undo Last Edit', handlerId: 'undo_last_change' };
  }
  return { ...action, handlerId: action.id };
}

/**
 * Primary entry: resolve labels and availability for a row on a given surface.
 */
export function getTransactionActions(
  row: TransactionActionRowInput,
  context: TransactionActionContext,
  options: GetTransactionActionsOptions = {}
): RegistryTransactionAction[] {
  const opts: GetTransactionActionsOptions = { ...options };
  if (context === 'statement' && opts.includeViewAction === undefined) {
    opts.includeViewAction = true;
  }

  const resolution = resolveUnifiedJournalEdit(row, row.payment_obj);
  const base = getRulesTransactionActions(row, context, opts);

  const out: RegistryTransactionAction[] = [];
  for (const action of base) {
    if (action.id === 'edit') {
      out.push(refineEditAction(action, resolution));
      continue;
    }
    out.push(normalizeDestructiveLabels(action, context));
  }

  if (
    context === 'detail_modal' &&
    allowsEditAccounts(row) &&
    !opts.paymentChainBlockReason &&
    row.is_void !== true
  ) {
    out.push({
      id: 'edit_accounts',
      label: 'Edit Accounts',
      severity: 'default',
      title: 'Change account codes or debit/credit on journal lines',
      handlerId: 'edit_accounts',
    });
  }

  if (context === 'statement' && opts.includeViewAction !== false && !out.some((a) => a.id === 'view')) {
    out.unshift({
      id: 'view',
      label: 'View',
      severity: 'secondary',
      handlerId: 'view',
    });
  }

  return out;
}

/** Account Statements row actions (View + Edit variants when journal_entry_id exists). */
export function getStatementRowActions(
  entry: StatementLedgerRowInput,
  options: GetTransactionActionsOptions = {}
): RegistryTransactionAction[] {
  if (!entry.journal_entry_id) return [];
  const chainBlock = syncPaymentChainBlockFromFingerprint(entry.je_action_fingerprint);
  const row = buildTransactionActionRowFromStatementEntry(entry);
  return getTransactionActions(row, 'statement', {
    ...options,
    includeViewAction: true,
    paymentChainBlockReason: options.paymentChainBlockReason ?? chainBlock,
  });
}

/** Label for statement row Edit button (View opens detail without auto-edit). */
export function getStatementRowEditLabel(entry: StatementLedgerRowInput): string | null {
  if (!entry.journal_entry_id) return null;
  if (entry.payment_voided_at) return null;
  const chainBlock = syncPaymentChainBlockFromFingerprint(entry.je_action_fingerprint);
  if (chainBlock) return null;
  const row = buildTransactionActionRowFromStatementEntry(entry);
  if (isSourceControlledAccountingDocument(row) && !row.payment_id) return null;
  const resolution = resolveUnifiedJournalEdit(row);
  if (resolution.kind === 'blocked' || resolution.kind === 'noop' || resolution.kind === 'document_editor') {
    return null;
  }
  return resolveEditActionLabel(row);
}

/** Map registry action id to handler id for existing mutation handlers. */
export function registryActionHandlerId(
  action: Pick<RegistryTransactionAction, 'id' | 'handlerId'>
): TransactionActionId | 'edit_accounts' {
  return action.handlerId;
}

/** Reason statement row Edit should be hidden (for tooltips / audit). */
export function statementRowEditDisabledReason(entry: StatementLedgerRowInput): string | null {
  if (!entry.journal_entry_id) return 'No journal entry — view only';
  const chainBlock = syncPaymentChainBlockFromFingerprint(entry.je_action_fingerprint);
  if (chainBlock) return chainBlock;
  const row = buildTransactionActionRowFromStatementEntry(entry);
  const resolution = resolveUnifiedJournalEdit(row);
  if (resolution.kind === 'blocked') return resolution.reason;
  if (resolution.kind === 'noop') return resolution.reason;
  if (isSourceControlledAccountingDocument(row) && !row.payment_id) {
    return 'Source-controlled document — open source record to edit';
  }
  const reversal = journalReversalBlockedReason(row);
  if (reversal && !row.payment_id) return reversal;
  return null;
}
