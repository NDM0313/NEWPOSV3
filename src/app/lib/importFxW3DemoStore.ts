/**
 * In-memory Import FX W3 Demo store — no Supabase, no journals, no RPCs.
 * Refresh resets unless optional sessionStorage is enabled by the caller.
 */

import {
  allocateAdvancesFifo,
  buildAdvanceJournalPreview,
  buildUsdAcquisitionJournalPreview,
  computeUsdCarryingPkr,
  splitFundingAmounts,
  type ImportFxW3FundingType,
} from '@/app/lib/importFxCaseW3Helpers';

export const DEMO_CASE_NO = 'DEMO-IMPORT-FX-0001';
export const DEMO_AGENT_NAME = 'Demo RMB Agent';
export const DEMO_STORAGE_KEY = 'import_fx_w3_demo_v1';

export type DemoEventStatus = 'SIMULATED' | 'REVERSED';

export type DemoAdvanceEvent = {
  kind: 'ADVANCE';
  id: string;
  eventNo: string;
  status: DemoEventStatus;
  postingDate: string;
  amountPkr: number;
  paymentSourceLabel: string;
  reference: string;
  notes: string;
  remainingUnappliedPkr: number;
  journalPreviewRef: string;
  createdAt: string;
  postsJournal: false;
};

export type DemoUsdEvent = {
  kind: 'USD_ACQUISITION';
  id: string;
  eventNo: string;
  status: DemoEventStatus;
  postingDate: string;
  usdQty: number;
  pkrPerUsd: number;
  carryingPkr: number;
  fundingType: ImportFxW3FundingType;
  advanceAppliedPkr: number;
  agentApCreatedPkr: number;
  walletLabel: string;
  reference: string;
  notes: string;
  journalPreviewRef: string;
  createdAt: string;
  postsJournal: false;
  applications: { advanceId: string; appliedPkr: number }[];
};

export type DemoEvent = DemoAdvanceEvent | DemoUsdEvent;

export type DemoReceipt = {
  eventNo: string;
  journalPreviewRef: string;
  amountPkr: number;
  clearingBalancePkr: number;
  timestamp: string;
  message: string;
};

export type ImportFxW3DemoState = {
  caseNo: string;
  agentName: string;
  arrangementConfirmed: true;
  accountingStatus: 'NOT_POSTED';
  assignment: 'Waiting Agent';
  plannedUsd: number;
  expectedCny: number;
  fundingIntention: 'CREDIT';
  pkrPerUsd: number;
  expectedPkrCost: number;
  advances: DemoAdvanceEvent[];
  acquisitions: DemoUsdEvent[];
  history: DemoEvent[];
  walletUsdQty: number;
  agentApPreviewPkr: number;
  lastReceipt: DemoReceipt | null;
  draftAdvance: {
    postingDate: string;
    paymentSourceLabel: string;
    amountPkr: string;
    reference: string;
    notes: string;
  };
  busy: boolean;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createInitialImportFxW3DemoState(): ImportFxW3DemoState {
  return {
    caseNo: DEMO_CASE_NO,
    agentName: DEMO_AGENT_NAME,
    arrangementConfirmed: true,
    accountingStatus: 'NOT_POSTED',
    assignment: 'Waiting Agent',
    plannedUsd: 15_000,
    expectedCny: 101_241,
    fundingIntention: 'CREDIT',
    pkrPerUsd: 287.5,
    expectedPkrCost: 4_312_500,
    advances: [],
    acquisitions: [],
    history: [],
    walletUsdQty: 0,
    agentApPreviewPkr: 0,
    lastReceipt: null,
    draftAdvance: {
      postingDate: todayIsoDate(),
      paymentSourceLabel: 'Demo Bank/Cash',
      amountPkr: '',
      reference: '',
      notes: '',
    },
    busy: false,
  };
}

export function availableDemoAdvancePkr(state: ImportFxW3DemoState): number {
  return Math.round(
    state.advances
      .filter((a) => a.status === 'SIMULATED')
      .reduce((s, a) => s + a.remainingUnappliedPkr, 0) * 100
  ) / 100;
}

export function previewAdvanceDemo(state: ImportFxW3DemoState, amountPkr: number) {
  return buildAdvanceJournalPreview({
    clearingLabel: 'Agent FX Advance / Settlement Clearing',
    paymentSourceLabel: state.draftAdvance.paymentSourceLabel || 'Demo Bank/Cash',
    amountPkr,
  });
}

export function previewUsdDemo(
  fundingType: ImportFxW3FundingType,
  usdQty: number,
  pkrPerUsd: number,
  advanceAppliedOverride?: number | null
) {
  const carryingPkr = computeUsdCarryingPkr(usdQty, pkrPerUsd);
  const split = splitFundingAmounts(fundingType, carryingPkr, advanceAppliedOverride);
  const preview = buildUsdAcquisitionJournalPreview({
    walletLabel: 'Demo USD TT Wallet',
    clearingLabel: 'Demo Agent FX Advance Clearing',
    agentApLabel: 'Demo Agent Payable',
    carryingPkr,
    advanceAppliedPkr: split.advanceAppliedPkr,
    agentApCreatedPkr: split.agentApCreatedPkr,
  });
  return { carryingPkr, ...split, preview };
}

export type DemoActionResult =
  | { ok: true; state: ImportFxW3DemoState; receipt?: DemoReceipt }
  | { ok: false; state: ImportFxW3DemoState; error: string; code?: string };

function withBusy(state: ImportFxW3DemoState, busy: boolean): ImportFxW3DemoState {
  return { ...state, busy };
}

export function saveDemoAdvanceDraft(
  state: ImportFxW3DemoState,
  draft: ImportFxW3DemoState['draftAdvance']
): ImportFxW3DemoState {
  return { ...state, draftAdvance: { ...draft } };
}

export function simulatePostAdvance(state: ImportFxW3DemoState): DemoActionResult {
  if (state.busy) {
    return { ok: false, state, error: 'Simulation already in progress.', code: 'DEMO_BUSY' };
  }
  const amount = Number(state.draftAdvance.amountPkr);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, state, error: 'Enter a positive PKR advance amount.', code: 'INVALID_AMOUNT' };
  }
  let next = withBusy(state, true);
  const eventNo = `DEMO-ADV-${String(next.history.length + 1).padStart(4, '0')}`;
  const id = uid('demo-adv');
  const createdAt = new Date().toISOString();
  const journalPreviewRef = `DEMO-JE-PREVIEW-${eventNo}`;
  const row: DemoAdvanceEvent = {
    kind: 'ADVANCE',
    id,
    eventNo,
    status: 'SIMULATED',
    postingDate: next.draftAdvance.postingDate || todayIsoDate(),
    amountPkr: Math.round(amount * 100) / 100,
    paymentSourceLabel: next.draftAdvance.paymentSourceLabel || 'Demo Bank/Cash',
    reference: next.draftAdvance.reference || '',
    notes: next.draftAdvance.notes || '',
    remainingUnappliedPkr: Math.round(amount * 100) / 100,
    journalPreviewRef,
    createdAt,
    postsJournal: false,
  };
  const receipt: DemoReceipt = {
    eventNo,
    journalPreviewRef,
    amountPkr: row.amountPkr,
    clearingBalancePkr: availableDemoAdvancePkr(next) + row.amountPkr,
    timestamp: createdAt,
    message: 'Demo OK — Event History only; accounting NOT posted',
  };
  next = {
    ...next,
    busy: false,
    advances: [...next.advances, row],
    history: [...next.history, row],
    lastReceipt: receipt,
    accountingStatus: 'NOT_POSTED',
    draftAdvance: { ...next.draftAdvance, amountPkr: '', reference: '', notes: '' },
  };
  return { ok: true, state: next, receipt };
}

export function simulatePostUsdAcquisition(
  state: ImportFxW3DemoState,
  args: {
    postingDate: string;
    usdQty: number;
    pkrPerUsd: number;
    fundingType: ImportFxW3FundingType;
    advanceAppliedPkr?: number | null;
    reference?: string;
    notes?: string;
  }
): DemoActionResult {
  if (state.busy) {
    return { ok: false, state, error: 'Simulation already in progress.', code: 'DEMO_BUSY' };
  }
  const carryingPkr = computeUsdCarryingPkr(args.usdQty, args.pkrPerUsd);
  if (carryingPkr <= 0) {
    return { ok: false, state, error: 'USD quantity and PKR/USD must be positive.', code: 'INVALID_USD' };
  }
  let next = withBusy(state, true);
  const split = splitFundingAmounts(args.fundingType, carryingPkr, args.advanceAppliedPkr);
  const avail = availableDemoAdvancePkr(next);
  if (split.advanceAppliedPkr > avail + 1e-9) {
    return {
      ok: false,
      state: withBusy(state, false),
      error: `Insufficient demo advance (need ${split.advanceAppliedPkr}, available ${avail}).`,
      code: 'INSUFFICIENT_ADVANCE',
    };
  }
  const preview = buildUsdAcquisitionJournalPreview({
    walletLabel: 'Demo USD TT Wallet',
    clearingLabel: 'Demo Agent FX Advance Clearing',
    agentApLabel: 'Demo Agent Payable',
    carryingPkr,
    advanceAppliedPkr: split.advanceAppliedPkr,
    agentApCreatedPkr: split.agentApCreatedPkr,
  });
  if (!preview.balanced) {
    return {
      ok: false,
      state: withBusy(state, false),
      error: 'Debit must equal total credits.',
      code: 'UNBALANCED',
    };
  }

  const fifoRows = next.advances
    .filter((a) => a.status === 'SIMULATED' && a.remainingUnappliedPkr > 0)
    .map((a) => ({
      id: a.id,
      remaining_unapplied_pkr: a.remainingUnappliedPkr,
      posted_at: a.createdAt,
    }));
  const applications = allocateAdvancesFifo(fifoRows, split.advanceAppliedPkr);
  const appliedSum = Math.round(applications.reduce((s, a) => s + a.applied_pkr, 0) * 100) / 100;
  if (Math.round(appliedSum * 100) / 100 !== Math.round(split.advanceAppliedPkr * 100) / 100) {
    return {
      ok: false,
      state: withBusy(state, false),
      error: 'Insufficient demo advance for FIFO application.',
      code: 'INSUFFICIENT_ADVANCE',
    };
  }

  const eventNo = `DEMO-USD-${String(next.history.filter((h) => h.kind === 'USD_ACQUISITION').length + 1).padStart(4, '0')}`;
  const id = uid('demo-usd');
  const createdAt = new Date().toISOString();
  const journalPreviewRef = `DEMO-JE-PREVIEW-${eventNo}`;
  const row: DemoUsdEvent = {
    kind: 'USD_ACQUISITION',
    id,
    eventNo,
    status: 'SIMULATED',
    postingDate: args.postingDate || todayIsoDate(),
    usdQty: args.usdQty,
    pkrPerUsd: args.pkrPerUsd,
    carryingPkr,
    fundingType: args.fundingType,
    advanceAppliedPkr: split.advanceAppliedPkr,
    agentApCreatedPkr: split.agentApCreatedPkr,
    walletLabel: 'Demo USD TT Wallet',
    reference: args.reference || '',
    notes: args.notes || '',
    journalPreviewRef,
    createdAt,
    postsJournal: false,
    applications: applications.map((a) => ({ advanceId: a.advance_id, appliedPkr: a.applied_pkr })),
  };

  const advances = next.advances.map((a) => {
    const hit = applications.find((x) => x.advance_id === a.id);
    if (!hit) return a;
    return {
      ...a,
      remainingUnappliedPkr: Math.round((a.remainingUnappliedPkr - hit.applied_pkr) * 100) / 100,
    };
  });

  const receipt: DemoReceipt = {
    eventNo,
    journalPreviewRef,
    amountPkr: carryingPkr,
    clearingBalancePkr: availableDemoAdvancePkr({ ...next, advances }),
    timestamp: createdAt,
    message: 'Demo OK — Event History only; accounting NOT posted',
  };

  next = {
    ...next,
    busy: false,
    advances,
    acquisitions: [...next.acquisitions, row],
    history: [...next.history, row],
    walletUsdQty: Math.round((next.walletUsdQty + args.usdQty) * 100) / 100,
    agentApPreviewPkr: Math.round((next.agentApPreviewPkr + split.agentApCreatedPkr) * 100) / 100,
    lastReceipt: receipt,
    accountingStatus: 'NOT_POSTED',
  };
  return { ok: true, state: next, receipt };
}

export function simulateReverseAdvance(state: ImportFxW3DemoState, advanceId: string): DemoActionResult {
  if (state.busy) {
    return { ok: false, state, error: 'Simulation already in progress.', code: 'DEMO_BUSY' };
  }
  const row = state.advances.find((a) => a.id === advanceId);
  if (!row || row.status !== 'SIMULATED') {
    return { ok: false, state, error: 'Advance not found or already reversed.', code: 'NOT_FOUND' };
  }
  if (row.remainingUnappliedPkr + 1e-9 < row.amountPkr) {
    return {
      ok: false,
      state,
      error: 'Advance reversal blocked after demo application.',
      code: 'ADVANCE_APPLIED',
    };
  }
  const advances = state.advances.map((a) =>
    a.id === advanceId ? { ...a, status: 'REVERSED' as const, remainingUnappliedPkr: 0 } : a
  );
  const history = state.history.map((h) =>
    h.kind === 'ADVANCE' && h.id === advanceId
      ? { ...h, status: 'REVERSED' as const, remainingUnappliedPkr: 0 }
      : h
  );
  return {
    ok: true,
    state: {
      ...state,
      advances,
      history,
      accountingStatus: 'NOT_POSTED',
      lastReceipt: {
        eventNo: `${row.eventNo}-REV`,
        journalPreviewRef: `DEMO-JE-REV-${row.eventNo}`,
        amountPkr: row.amountPkr,
        clearingBalancePkr: availableDemoAdvancePkr({ ...state, advances }),
        timestamp: new Date().toISOString(),
        message: 'Demo OK — Event History only; accounting NOT posted',
      },
    },
  };
}

export function simulateReverseUsdAcquisition(
  state: ImportFxW3DemoState,
  acquisitionId: string
): DemoActionResult {
  if (state.busy) {
    return { ok: false, state, error: 'Simulation already in progress.', code: 'DEMO_BUSY' };
  }
  const row = state.acquisitions.find((a) => a.id === acquisitionId);
  if (!row || row.status !== 'SIMULATED') {
    return { ok: false, state, error: 'Acquisition not found or already reversed.', code: 'NOT_FOUND' };
  }

  const advances = state.advances.map((a) => {
    const hit = row.applications.find((x) => x.advanceId === a.id);
    if (!hit || a.status !== 'SIMULATED') return a;
    return {
      ...a,
      remainingUnappliedPkr: Math.round((a.remainingUnappliedPkr + hit.appliedPkr) * 100) / 100,
    };
  });
  const acquisitions = state.acquisitions.map((a) =>
    a.id === acquisitionId ? { ...a, status: 'REVERSED' as const } : a
  );
  const history = state.history.map((h) =>
    h.kind === 'USD_ACQUISITION' && h.id === acquisitionId
      ? { ...h, status: 'REVERSED' as const }
      : h
  );

  return {
    ok: true,
    state: {
      ...state,
      advances,
      acquisitions,
      history,
      walletUsdQty: Math.round((state.walletUsdQty - row.usdQty) * 100) / 100,
      agentApPreviewPkr: Math.round((state.agentApPreviewPkr - row.agentApCreatedPkr) * 100) / 100,
      accountingStatus: 'NOT_POSTED',
      lastReceipt: {
        eventNo: `${row.eventNo}-REV`,
        journalPreviewRef: `DEMO-JE-REV-${row.eventNo}`,
        amountPkr: row.carryingPkr,
        clearingBalancePkr: availableDemoAdvancePkr({ ...state, advances }),
        timestamp: new Date().toISOString(),
        message: 'Demo OK — Event History only; accounting NOT posted',
      },
    },
  };
}

/** Serialize for optional sessionStorage (still local-only; never server). */
export function serializeDemoState(state: ImportFxW3DemoState): string {
  return JSON.stringify(state);
}

export function deserializeDemoState(raw: string | null): ImportFxW3DemoState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ImportFxW3DemoState;
    if (parsed?.caseNo !== DEMO_CASE_NO) return null;
    return { ...createInitialImportFxW3DemoState(), ...parsed, busy: false };
  } catch {
    return null;
  }
}

/** Confirms this module never references supabase client / RPC call sites. */
export const DEMO_STORE_HAS_NO_NETWORK = true as const;
