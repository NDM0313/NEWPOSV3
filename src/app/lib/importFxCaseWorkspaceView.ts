/**
 * Import FX W2 ARRANGEMENT workspace view-model (test-only logic + UI copy).
 * No Supabase, no production data, never posts journals.
 */

import {
  IMPORT_FX_STAGE_ORDER,
  W2_MONEY_STAGE_BLOCKED_COPY,
  type ImportFxFundingMode,
  type ImportFxStageCode,
} from './importFxCaseHelpers';
import { validateW21ArrangementPlanning } from './importFxCaseW21Helpers';
import { isPostW3MoneyStageBlocked } from './importFxCaseW3Helpers';

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

/** Overlay shell — AddEntryV2-aligned blur backdrop; z-50 so Cases/Context sheets stack above. */
export const W2_WORKSPACE_SHELL_CLASS =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200';

/** Dialog card — matches AddEntryV2 Supplier Payment chrome. */
export const W2_WORKSPACE_PANEL_CLASS =
  'bg-card border border-border/80 rounded-2xl shadow-2xl shadow-black/40 w-full max-w-[700px] max-h-[92vh] min-w-0 overflow-hidden flex flex-col ring-1 ring-white/5 animate-in zoom-in-95 duration-200 my-6';

/** @deprecated Guided shell no longer uses a permanent multi-column grid. Kept for older tests. */
export const W2_WORKSPACE_GRID_CLASS =
  'flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden';

export const W2_GUIDED_BODY_CLASS =
  'flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden';

export const W2_GUIDED_MAIN_CLASS =
  'flex-1 min-h-0 overflow-y-auto p-5 space-y-4 min-w-0';

export const W2_GUIDED_FOOTER_CLASS =
  'shrink-0 border-t border-border/80 px-4 py-3 flex flex-wrap items-center gap-2 min-w-0 bg-muted/20';

export const W2_ACTION_BAR_CLASS =
  'flex flex-col xs:flex-row sm:flex-row flex-wrap gap-2 w-full min-w-0';

export type W2BusyAction = 'save' | 'confirm' | 'create' | 'cancel' | 'link' | 'attach' | null;

export type W2WorkspaceMode = 'new-draft' | 'edit-draft' | 'confirmed' | 'read-only';

/** Arrangement sub-steps inside the Arrange stage (guided UA). */
export type ArrangementGuidedStep = 1 | 2 | 3 | 4 | 5;

export const ARRANGEMENT_GUIDED_STEPS: {
  step: ArrangementGuidedStep;
  title: string;
  why: string;
}[] = [
  {
    step: 1,
    title: 'Parties',
    why: 'Choose money-exchange agent and optional third party (planning only).',
  },
  {
    step: 2,
    title: 'Funding intention',
    why: 'How you expect to fund later — Advance, Credit, or Mixed. Not a payment.',
  },
  {
    step: 3,
    title: 'Planned currency',
    why: 'Expected amounts and indicative rates. Nothing is financially posted here.',
  },
  {
    step: 4,
    title: 'Schedule & references',
    why: 'Expected dates, notes, and planning links only.',
  },
  {
    step: 5,
    title: 'Review & confirm',
    why: 'Check the plan, then save or confirm arrangement. Still Not Posted.',
  },
];

export type GuidedProgressState = 'done' | 'current' | 'upcoming' | 'locked';

export type GuidedProgressItem = {
  code: ImportFxStageCode | 'LATER';
  shortLabel: string;
  state: GuidedProgressState;
  helper: string | null;
};

export function clampArrangementStep(step: number): ArrangementGuidedStep {
  if (step <= 1) return 1;
  if (step >= 5) return 5;
  return step as ArrangementGuidedStep;
}

export function arrangementStepMeta(step: ArrangementGuidedStep) {
  return ARRANGEMENT_GUIDED_STEPS.find((s) => s.step === step) ?? ARRANGEMENT_GUIDED_STEPS[0];
}

/** Soft per-step checks before Next (full confirm validation stays on step 5). */
export function validateArrangementGuidedStep(
  step: ArrangementGuidedStep,
  input: {
    agentId?: string;
    thirdPartyId?: string;
    fundingMode?: string | null;
    plannedUsd?: string;
    expectedCny?: string;
    expectedPkrPerUsd?: string;
    expectedCnyPerUsd?: string;
    expectedFeesPkr?: string;
    expectedAdvanceAmountPkr?: string;
  }
): string[] {
  if (step === 1) {
    const a = String(input.agentId || '').trim();
    const t = String(input.thirdPartyId || '').trim();
    if (a && t && a === t) return ['Agent and third party must be different contacts.'];
    return [];
  }
  if (step === 2) {
    const m = String(input.fundingMode || '').trim().toUpperCase();
    if (!m) return ['Select a funding intention (Advance, Credit, or Mixed).'];
    if (m !== 'ADVANCE' && m !== 'CREDIT' && m !== 'MIXED') {
      return ['Select a funding intention (Advance, Credit, or Mixed).'];
    }
    return [];
  }
  if (step === 3) {
    return validateArrangementPlanning({
      plannedUsd: input.plannedUsd,
      expectedCny: input.expectedCny,
      expectedPkrPerUsd: input.expectedPkrPerUsd,
      expectedCnyPerUsd: input.expectedCnyPerUsd,
      expectedFeesPkr: input.expectedFeesPkr,
      expectedAdvanceAmountPkr: input.expectedAdvanceAmountPkr,
      fundingMode: input.fundingMode,
      requireAgentIfNeeded: false,
    });
  }
  // Steps 4–5: dates optional; step 5 uses full validate on Confirm.
  return [];
}

export function guidedProgressItems(params: {
  activeStage: ImportFxStageCode;
  arrangementLocked: boolean;
}): GuidedProgressItem[] {
  const active = params.activeStage;
  const arrangeDone = params.arrangementLocked;

  const stateFor = (code: ImportFxStageCode): GuidedProgressState => {
    if (code === 'ARRANGEMENT') {
      if (active === 'ARRANGEMENT') return 'current';
      return arrangeDone ? 'done' : 'upcoming';
    }
    if (code === 'ADVANCE') {
      if (!arrangeDone) return 'locked';
      if (active === 'ADVANCE') return 'current';
      if (active === 'ARRANGEMENT') return 'upcoming';
      // On USD or later: advance may be skipped — treat as done for progress chrome.
      return 'done';
    }
    if (code === 'USD_ACQUISITION') {
      if (!arrangeDone) return 'locked';
      if (active === 'USD_ACQUISITION') return 'current';
      if (active === 'ARRANGEMENT' || active === 'ADVANCE') return 'upcoming';
      return 'done';
    }
    return 'locked';
  };

  const laterActive = isPostW3MoneyStageBlocked(active);

  return [
    {
      code: 'ARRANGEMENT',
      shortLabel: 'Arrange',
      state: stateFor('ARRANGEMENT'),
      helper: null,
    },
    {
      code: 'ADVANCE',
      shortLabel: 'Advance',
      state: stateFor('ADVANCE'),
      helper: arrangeDone ? null : 'Confirm arrangement first',
    },
    {
      code: 'USD_ACQUISITION',
      shortLabel: 'Buy USD',
      state: stateFor('USD_ACQUISITION'),
      helper: arrangeDone ? null : 'Confirm arrangement first',
    },
    {
      code: 'LATER',
      shortLabel: 'Later',
      state: laterActive ? 'current' : 'locked',
      helper: W2_MONEY_STAGE_BLOCKED_COPY,
    },
  ];
}

export function guidedTaskCopy(params: {
  activeStage: ImportFxStageCode;
  arrangementStep: ArrangementGuidedStep;
  arrangementLocked: boolean;
}): { title: string; why: string; nextAction: string } {
  if (params.activeStage === 'ARRANGEMENT') {
    const meta = arrangementStepMeta(params.arrangementStep);
    const nextAction = params.arrangementLocked
      ? 'Arrangement confirmed — open Advance or Buy USD when ready.'
      : params.arrangementStep < 5
        ? `Next: ${arrangementStepMeta(clampArrangementStep(params.arrangementStep + 1)).title}`
        : 'Review the plan, then Confirm Arrangement (still Not Posted).';
    return { title: meta.title, why: meta.why, nextAction };
  }
  if (params.activeStage === 'ADVANCE') {
    return {
      title: 'Agent advance',
      why: 'Post PKR advance to the money-exchange agent when you are ready. Optional before buying USD.',
      nextAction: 'Enter amount, preview journal, then Confirm & Post — or skip to Buy USD.',
    };
  }
  if (params.activeStage === 'USD_ACQUISITION') {
    return {
      title: 'Buy USD',
      why: 'Acquire USD against advance and/or agent credit. Preview journal before Confirm & Post.',
      nextAction: 'Complete USD acquisition when funded, or return later.',
    };
  }
  return {
    title: 'Later stages',
    why: 'China transfer, conversion, pool, and allocation ship in later waves.',
    nextAction: W2_MONEY_STAGE_BLOCKED_COPY,
  };
}

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

/** Local calendar YYYY-MM-DD (no UTC shift). */
export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add whole days to an ISO date string; returns '' if invalid. */
export function addDaysIso(isoDate: string, days: number): string {
  const raw = String(isoDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const [ys, ms, ds] = raw.split('-').map((x) => Number(x));
  if (!ys || !ms || !ds) return '';
  const dt = new Date(ys, ms - 1, ds);
  if (Number.isNaN(dt.getTime())) return '';
  dt.setDate(dt.getDate() + days);
  return todayIsoDate(dt);
}

export type ScheduleCascadeDates = {
  arrangement: string;
  advance: string;
  usd: string;
  completion: string;
};

/** Default cascade from arrangement anchor: +0 / +3 / +7 / +14. */
export function buildScheduleCascade(arrangeIso: string): ScheduleCascadeDates | null {
  const arrangement = String(arrangeIso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrangement)) return null;
  const advance = addDaysIso(arrangement, 3);
  const usd = addDaysIso(arrangement, 7);
  const completion = addDaysIso(arrangement, 14);
  if (!advance || !usd || !completion) return null;
  return { arrangement, advance, usd, completion };
}

export type ScheduleQuickPlanId = 'today' | 'this_week' | 'clear';

export const SCHEDULE_QUICK_PLANS: {
  id: ScheduleQuickPlanId;
  label: string;
  /** Offsets from today for arrange / advance / usd / completion. Null plan = clear. */
  offsets: [number, number, number, number] | null;
}[] = [
  { id: 'today', label: 'Today', offsets: [0, 3, 7, 14] },
  { id: 'this_week', label: 'This week', offsets: [0, 2, 5, 7] },
  { id: 'clear', label: 'Clear dates', offsets: null },
];

export function applyScheduleQuickPlan(
  planId: ScheduleQuickPlanId,
  now: Date = new Date()
): ScheduleCascadeDates | null {
  const plan = SCHEDULE_QUICK_PLANS.find((p) => p.id === planId);
  if (!plan) return null;
  if (!plan.offsets) {
    return { arrangement: '', advance: '', usd: '', completion: '' };
  }
  const base = todayIsoDate(now);
  const arrangement = addDaysIso(base, plan.offsets[0]);
  const advance = addDaysIso(base, plan.offsets[1]);
  const usd = addDaysIso(base, plan.offsets[2]);
  const completion = addDaysIso(base, plan.offsets[3]);
  return { arrangement, advance, usd, completion };
}

export type ScheduleFieldKey = 'arrangement' | 'advance' | 'usd' | 'completion';

export const SCHEDULE_FIELD_CHIPS: {
  id: 'today' | 'plus3' | 'plus7' | 'same_arrange';
  label: string;
}[] = [
  { id: 'today', label: 'Today' },
  { id: 'plus3', label: '+3d' },
  { id: 'plus7', label: '+7d' },
  { id: 'same_arrange', label: 'Same as arrange' },
];

export function resolveScheduleFieldChip(params: {
  chipId: (typeof SCHEDULE_FIELD_CHIPS)[number]['id'];
  field: ScheduleFieldKey;
  arrangeIso: string;
  now?: Date;
}): string {
  const now = params.now ?? new Date();
  const today = todayIsoDate(now);
  if (params.chipId === 'today') return today;
  if (params.chipId === 'plus3') return addDaysIso(today, 3);
  if (params.chipId === 'plus7') return addDaysIso(today, 7);
  if (params.chipId === 'same_arrange') {
    if (params.field === 'arrangement') return today;
    return String(params.arrangeIso || '').trim() || today;
  }
  return '';
}

/** When arrangement changes: fill empty downstream fields, or all if cascade mode. */
export function cascadeFromArrangementChange(params: {
  arrangeIso: string;
  current: ScheduleCascadeDates;
  /** When true, always overwrite advance/usd/completion from cascade. */
  forceCascade: boolean;
}): ScheduleCascadeDates {
  const built = buildScheduleCascade(params.arrangeIso);
  if (!built) {
    return { ...params.current, arrangement: params.arrangeIso };
  }
  if (params.forceCascade) return built;
  return {
    arrangement: built.arrangement,
    advance: params.current.advance.trim() ? params.current.advance : built.advance,
    usd: params.current.usd.trim() ? params.current.usd : built.usd,
    completion: params.current.completion.trim() ? params.current.completion : built.completion,
  };
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
  arrangementType?: string | null;
  fundingMode?: string | null;
  /** W2.1: require agent when confirming agent-dependent arrangement types. */
  requireAgentIfNeeded?: boolean;
}): string[] {
  return validateW21ArrangementPlanning({
    arrangementType: input.arrangementType,
    agentId: input.agentId,
    thirdPartyId: input.thirdPartyId,
    fundingMode: input.fundingMode,
    plannedUsd: input.plannedUsd,
    expectedCny: input.expectedCny,
    expectedPkrPerUsd: input.expectedPkrPerUsd,
    expectedCnyPerUsd: input.expectedCnyPerUsd,
    expectedFeesPkr: input.expectedFeesPkr,
    expectedAdvanceAmountPkr: input.expectedAdvanceAmountPkr,
    requireAgentIfNeeded: input.requireAgentIfNeeded === true,
  });
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
  /** Guided UA: only arrangement stage owns draft/confirm CTAs. */
  activeStage?: ImportFxStageCode | null;
  /** Guided UA: Confirm Arrangement only on review step (5). */
  arrangementStep?: ArrangementGuidedStep | null;
}): {
  showCreateDraft: boolean;
  showSaveDraft: boolean;
  showConfirmArrangement: boolean;
  showCancelUnposted: boolean;
  showResumeHint: boolean;
  showArrangementNav: boolean;
  fieldsLocked: boolean;
  actionsDisabled: boolean;
  saveDraftBusy: boolean;
  confirmBusy: boolean;
} {
  const cancelled = params.operationalStatus === 'CANCELLED';
  const notPosted = !params.accountingStatus || params.accountingStatus === 'NOT_POSTED';
  const fieldsLocked = params.mode === 'read-only' || params.mode === 'confirmed' || cancelled;
  const onArrangement =
    params.activeStage == null || params.activeStage === 'ARRANGEMENT';
  const onReview =
    params.arrangementStep == null || params.arrangementStep === 5;
  return {
    showCreateDraft: params.mode === 'new-draft' && onArrangement,
    showSaveDraft: params.mode === 'edit-draft' && onArrangement,
    showConfirmArrangement: params.mode === 'edit-draft' && onArrangement && onReview,
    showCancelUnposted:
      onArrangement &&
      onReview &&
      (params.mode === 'edit-draft' || params.mode === 'confirmed') &&
      notPosted &&
      !cancelled,
    showResumeHint: params.mode === 'edit-draft' && onArrangement,
    showArrangementNav: onArrangement && params.mode !== 'new-draft',
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
    // W3 unlocks ADVANCE + USD_ACQUISITION; W4+ stay blocked (copy still references W3+ until W4 ships).
    const disabled = isPostW3MoneyStageBlocked(s.code);
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
