/**
 * Import FX W2 ARRANGEMENT workspace view-model (test-only logic + UI copy).
 * No Supabase, no production data, never posts journals.
 */

import {
  IMPORT_FX_STAGE_ORDER,
  W2_MONEY_STAGE_BLOCKED_COPY,
  isMoneyStageBlockedInW2,
  type ImportFxFundingMode,
  type ImportFxStageCode,
} from './importFxCaseHelpers';

export const W2_PLANNING_ONLY_NOTICE =
  'Planning only — no payment or accounting entry has been posted.';

export const W2_ACCOUNTING_NOT_POSTED_LABEL = 'Not Posted';

export const W2_FUNDING_INTENTION_OPTIONS: {
  value: ImportFxFundingMode;
  label: string;
  hint: string;
}[] = [
  { value: 'ADVANCE', label: 'Advance planned', hint: 'Intention only — not financially posted' },
  { value: 'CREDIT', label: 'Credit planned', hint: 'Intention only — not financially posted' },
  { value: 'MIXED', label: 'Mixed planned', hint: 'Intention only — not financially posted' },
];

export const W2_FORBIDDEN_MONEY_ACTIONS = [
  'Pay Advance',
  'Buy USD',
  'Convert Currency',
  'Settle Supplier',
] as const;

export const W2_WORKSPACE_SHELL_CLASS =
  'fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-2 sm:p-3 lg:p-4 overflow-hidden';

export const W2_WORKSPACE_PANEL_CLASS =
  'bg-card border border-border rounded-xl w-full max-w-[1440px] max-h-[95vh] min-w-0 overflow-hidden flex flex-col';

export const W2_WORKSPACE_GRID_CLASS =
  'flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 min-w-0 overflow-y-auto lg:overflow-hidden';

export const W2_ACTION_BAR_CLASS =
  'flex flex-col xs:flex-row sm:flex-row flex-wrap gap-2 w-full min-w-0';

export type W2BusyAction = 'save' | 'confirm' | 'create' | 'cancel' | 'link' | 'attach' | null;

export type W2WorkspaceMode = 'new-draft' | 'edit-draft' | 'confirmed' | 'read-only';

export function formatAccountingStatusLabel(status: string | null | undefined): string {
  if (!status || status === 'NOT_POSTED') return W2_ACCOUNTING_NOT_POSTED_LABEL;
  return status.replace(/_/g, ' ');
}

export function formatArrangementStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Draft';
  if (status === 'DRAFT') return 'Draft';
  if (status === 'ARRANGED') return 'Arranged';
  if (status === 'CANCELLED') return 'Cancelled';
  return status.replace(/_/g, ' ');
}

export function isArrangementLocked(params: {
  arrangementConfirmedAt?: string | null;
  arrangementStageStatus?: string | null;
  operationalStatus?: string | null;
}): boolean {
  if (params.arrangementConfirmedAt) return true;
  if (String(params.arrangementStageStatus || '') === 'COMPLETED') return true;
  const ops = String(params.operationalStatus || '');
  return ops === 'ARRANGED' || ops === 'CANCELLED' || ops === 'COMPLETED';
}

export function resolveWorkspaceMode(params: {
  multiCurrencyEnabled: boolean;
  selectedCaseId: string | null;
  arrangementLocked: boolean;
}): W2WorkspaceMode {
  if (!params.multiCurrencyEnabled) return 'read-only';
  if (!params.selectedCaseId) return 'new-draft';
  if (params.arrangementLocked) return 'confirmed';
  return 'edit-draft';
}

export function formatPlannedCurrencyPair(
  source: string | null | undefined,
  settlement: string | null | undefined
): string {
  const from = String(source || '').trim() || '—';
  const to = String(settlement || '').trim() || '—';
  return `${from} → ${to}`;
}

export function formatLastUpdated(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function formatMoneyExchangeOption(contact: {
  id: string;
  name?: string | null;
  code?: string | null;
  phone?: string | null;
  mobile?: string | null;
}): { id: string; name: string; code?: string; phone?: string; searchText: string } {
  const name = String(contact.name || 'Agent').trim();
  const code = String(contact.code || '').trim();
  const phone = String(contact.phone || contact.mobile || '').trim();
  const parts = [name];
  if (code) parts.push(`(${code})`);
  if (phone) parts.push(phone);
  const searchText = [name, code, phone].filter(Boolean).join(' ').toLowerCase();
  return { id: contact.id, name: parts.join(' '), code: code || undefined, phone: phone || undefined, searchText };
}

export function formatPurchasePlanningOption(row: {
  id: string;
  purchaseNumber?: string | null;
  invoiceNumber?: string | null;
  supplierName?: string | null;
  documentCurrency?: string | null;
}): { id: string; name: string; searchText: string } {
  const purchaseNumber = String(row.purchaseNumber || '').trim();
  const invoiceNumber = String(row.invoiceNumber || '').trim();
  const supplierName = String(row.supplierName || '').trim();
  const currency = String(row.documentCurrency || '').trim();
  const title = purchaseNumber || invoiceNumber || row.id.slice(0, 8);
  const name = [title, supplierName, invoiceNumber && invoiceNumber !== title ? `inv ${invoiceNumber}` : null, currency]
    .filter(Boolean)
    .join(' · ');
  const searchText = [title, supplierName, invoiceNumber, purchaseNumber, currency].filter(Boolean).join(' ').toLowerCase();
  return { id: row.id, name, searchText };
}

export function matchesPlanningSearch(
  option: { name?: string; searchText?: string; code?: string; phone?: string },
  query: string
): boolean {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [option.searchText, option.name, option.code, option.phone]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function thirdPartyOptionsExcludingAgent<T extends { id: string }>(
  agents: T[],
  agentId: string
): T[] {
  if (!agentId) return agents;
  return agents.filter((a) => a.id !== agentId);
}

export function validateArrangementPlanning(input: {
  agentId?: string;
  thirdPartyId?: string;
  plannedUsd?: string;
  expectedCny?: string;
  expectedPkrPerUsd?: string;
  expectedCnyPerUsd?: string;
  expectedFeesPkr?: string;
  expectedAdvanceAmountPkr?: string;
}): string[] {
  const errors: string[] = [];
  const agent = String(input.agentId || '').trim();
  const third = String(input.thirdPartyId || '').trim();
  if (agent && third && agent === third) {
    errors.push('Agent and third party must be different contacts.');
  }
  const amounts: Array<[string | undefined, string]> = [
    [input.plannedUsd, 'Expected USD amount'],
    [input.expectedCny, 'Expected CNY amount'],
    [input.expectedPkrPerUsd, 'Indicative PKR per USD rate'],
    [input.expectedCnyPerUsd, 'Indicative CNY per USD rate'],
    [input.expectedFeesPkr, 'Expected fees (PKR)'],
    [input.expectedAdvanceAmountPkr, 'Planned advance amount (PKR)'],
  ];
  for (const [raw, label] of amounts) {
    const t = String(raw || '').trim();
    if (!t) continue;
    const n = Number(t);
    if (!Number.isFinite(n)) {
      errors.push(`${label} must be a number.`);
    } else if (n < 0) {
      errors.push(`${label} cannot be negative.`);
    }
  }
  return errors;
}

export function stripAttachmentStoragePath<T extends Record<string, unknown>>(row: T): Omit<T, 'storage_path'> {
  const { storage_path: _omit, ...rest } = row;
  return rest as Omit<T, 'storage_path'>;
}

export function assertW2MutationDoesNotPost(postsJournal: unknown): void {
  if (postsJournal === true) {
    throw new Error('W2 planning events must keep posts_journal=false');
  }
}

export function workspaceActions(params: {
  mode: W2WorkspaceMode;
  busy: boolean;
  busyAction?: W2BusyAction;
  accountingStatus?: string | null;
  operationalStatus?: string | null;
}): {
  showCreateDraft: boolean;
  showSaveDraft: boolean;
  showConfirmArrangement: boolean;
  showCancelUnposted: boolean;
  showResumeHint: boolean;
  fieldsLocked: boolean;
  actionsDisabled: boolean;
  saveDraftBusy: boolean;
  confirmBusy: boolean;
} {
  const cancelled = params.operationalStatus === 'CANCELLED';
  const notPosted = !params.accountingStatus || params.accountingStatus === 'NOT_POSTED';
  const fieldsLocked = params.mode === 'read-only' || params.mode === 'confirmed' || cancelled;
  return {
    showCreateDraft: params.mode === 'new-draft',
    showSaveDraft: params.mode === 'edit-draft',
    showConfirmArrangement: params.mode === 'edit-draft',
    showCancelUnposted: (params.mode === 'edit-draft' || params.mode === 'confirmed') && notPosted && !cancelled,
    showResumeHint: params.mode === 'edit-draft',
    fieldsLocked,
    actionsDisabled: params.busy || params.mode === 'read-only',
    saveDraftBusy: params.busy && params.busyAction === 'save',
    confirmBusy: params.busy && params.busyAction === 'confirm',
  };
}

export function createExclusiveBusyGuard(): {
  tryStart: () => boolean;
  end: () => void;
  isBusy: () => boolean;
} {
  let locked = false;
  return {
    tryStart: () => {
      if (locked) return false;
      locked = true;
      return true;
    },
    end: () => {
      locked = false;
    },
    isBusy: () => locked,
  };
}

export function moneyStageTimelineItems(): Array<{
  code: ImportFxStageCode;
  label: string;
  disabled: boolean;
  helper: string | null;
}> {
  return IMPORT_FX_STAGE_ORDER.map((s) => {
    const disabled = isMoneyStageBlockedInW2(s.code);
    return {
      code: s.code,
      label: s.label,
      disabled,
      helper: disabled ? W2_MONEY_STAGE_BLOCKED_COPY : null,
    };
  });
}

export function containsForbiddenMoneyActionCopy(source: string): boolean {
  return W2_FORBIDDEN_MONEY_ACTIONS.some((label) => source.includes(label));
}
