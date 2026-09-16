/**
 * In-memory Import FX W3 / W3.1 Demo store — no Supabase, no journals, no RPCs.
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
import {
  operationalStatusLabels,
  validateRoutingAllocation,
  W31_HOLDING_NOT_AP_COPY,
  W31_REQUIRES_W5_COPY,
  W31_ROUTING_LABELS,
  type ImportFxW31RoutingMode,
  type W31DistributionDraftRow,
} from '@/app/lib/importFxCaseW31Helpers';

export const DEMO_CASE_NO = 'DEMO-IMPORT-FX-0001';
export const DEMO_AGENT_NAME = 'Demo RMB Agent';
export const DEMO_STORAGE_KEY = 'import_fx_w3_demo_v1';
export const DEMO_AGENT_CONTACT_ID = 'demo-agent-1';
export const DEMO_SUPPLIER_A_ID = 'demo-supplier-a';
export const DEMO_SUPPLIER_B_ID = 'demo-supplier-b';
export const DEMO_THIRD_PARTY_ID = 'demo-third-party-1';
export const DEMO_WALLET_ID = 'demo-usd-wallet';

export type DemoEventStatus = 'SIMULATED' | 'REVERSED';

export type DemoDistributionLine = {
  recipientContactId: string;
  recipientName: string;
  recipientRole: string;
  purpose: string;
  usdQty: number;
  linkedPurchaseId?: string | null;
  status: 'PLANNED' | 'EXECUTION_BLOCKED';
  blocksSupplierAp: true;
  reviewLabel: string;
};

export type DemoCustodyPosition = {
  id: string;
  acquisitionId: string;
  holderType: 'COMPANY_WALLET' | 'AGENT' | 'THIRD_PARTY';
  holderLabel: string;
  usdQty: number;
  pkrCarrying: number;
  status: 'OPEN' | 'CONSUMED';
};

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
  routingMode: ImportFxW31RoutingMode;
  routingLabel: string;
  holderLabel: string;
  retainedUsd: number;
  distributedUsd: number;
  statusLabels: string[];
  distributionLines: DemoDistributionLine[];
  custodyPositionId: string | null;
  clientOperationId: string;
  downstreamConsumed: boolean;
  supplierApReduced: false;
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
  clientOperationId?: string;
  replayed?: boolean;
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
  custodyPositions: DemoCustodyPosition[];
  clientOps: Record<string, { eventId: string; receipt: DemoReceipt }>;
  history: DemoEvent[];
  walletUsdQty: number;
  agentHeldUsdQty: number;
  thirdPartyHeldUsdQty: number;
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
    plannedUsd: 50_000,
    expectedCny: 101_241,
    fundingIntention: 'CREDIT',
    pkrPerUsd: 287.5,
    expectedPkrCost: 14_375_000,
    advances: [],
    acquisitions: [],
    custodyPositions: [],
    clientOps: {},
    history: [],
    walletUsdQty: 0,
    agentHeldUsdQty: 0,
    thirdPartyHeldUsdQty: 0,
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
  return (
    Math.round(
      state.advances
        .filter((a) => a.status === 'SIMULATED')
        .reduce((s, a) => s + a.remainingUnappliedPkr, 0) * 100
    ) / 100
  );
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
  advanceAppliedOverride?: number | null,
  debitLabel = 'Demo USD TT Wallet / Custody Control'
) {
  const carryingPkr = computeUsdCarryingPkr(usdQty, pkrPerUsd);
  const split = splitFundingAmounts(fundingType, carryingPkr, advanceAppliedOverride);
  const preview = buildUsdAcquisitionJournalPreview({
    walletLabel: debitLabel,
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

function reviewLabelForPurpose(purpose: string, recipientIsSupplier: boolean): string {
  if (purpose === 'SUPPLIER_INVOICE_SETTLEMENT' || purpose === 'SUPPLIER_ADVANCE') {
    return W31_REQUIRES_W5_COPY;
  }
  if (purpose === 'CONVERSION_COUNTERPARTY') return 'Requires W4 Conversion';
  if (recipientIsSupplier && purpose === 'THIRD_PARTY_CUSTODY') return W31_HOLDING_NOT_AP_COPY;
  if (purpose === 'THIRD_PARTY_CUSTODY') return 'Onward custody — not Supplier AP';
  return 'Execution blocked — review required';
}

function mapDistributionLines(
  rows: W31DistributionDraftRow[],
  nameById: Record<string, string>
): DemoDistributionLine[] {
  return rows.map((r) => {
    const isSupplier =
      r.recipient_contact_id === DEMO_SUPPLIER_A_ID ||
      r.recipient_contact_id === DEMO_SUPPLIER_B_ID ||
      String(r.recipient_role || '').toLowerCase() === 'supplier';
    return {
      recipientContactId: r.recipient_contact_id,
      recipientName: nameById[r.recipient_contact_id] || r.recipient_contact_id,
      recipientRole: r.recipient_role || (isSupplier ? 'supplier' : 'contact'),
      purpose: r.purpose,
      usdQty: r.usd_qty,
      linkedPurchaseId: r.linked_purchase_id || null,
      status: 'EXECUTION_BLOCKED',
      blocksSupplierAp: true,
      reviewLabel: reviewLabelForPurpose(r.purpose, isSupplier),
    };
  });
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
    message: 'DEMO — NOT POSTED. No database, journal, payment or supplier settlement was created.',
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

/** Legacy wrapper — company wallet routing. */
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
    clientOperationId?: string;
  }
): DemoActionResult {
  return simulatePostUsdAcquisitionWithRouting(state, {
    ...args,
    routingMode: 'COMPANY_WALLET',
    destinationWalletId: DEMO_WALLET_ID,
    retainedUsd: args.usdQty,
    distributionRows: [],
  });
}

export function simulatePostUsdAcquisitionWithRouting(
  state: ImportFxW3DemoState,
  args: {
    postingDate: string;
    usdQty: number;
    pkrPerUsd: number;
    fundingType: ImportFxW3FundingType;
    advanceAppliedPkr?: number | null;
    reference?: string;
    notes?: string;
    routingMode: ImportFxW31RoutingMode;
    destinationWalletId?: string | null;
    holderContactId?: string | null;
    retainedUsd?: number;
    distributionRows?: W31DistributionDraftRow[];
    clientOperationId?: string;
  }
): DemoActionResult {
  if (state.busy) {
    return { ok: false, state, error: 'Simulation already in progress.', code: 'DEMO_BUSY' };
  }

  const clientOperationId = args.clientOperationId || uid('demo-op');
  const prior = state.clientOps[clientOperationId];
  if (prior) {
    return {
      ok: true,
      state: {
        ...state,
        lastReceipt: { ...prior.receipt, replayed: true },
      },
      receipt: { ...prior.receipt, replayed: true },
    };
  }

  const distributionRows = args.distributionRows || [];
  const retainedDefault =
    args.routingMode === 'DIRECT_DISTRIBUTION'
      ? 0
      : args.routingMode === 'SPLIT_HOLD_AND_DISTRIBUTE'
        ? Number(args.retainedUsd) || 0
        : args.usdQty;
  const alloc = validateRoutingAllocation({
    routingMode: args.routingMode,
    acquiredUsd: args.usdQty,
    retainedUsd: retainedDefault,
    distributionRows,
    destinationWalletId: args.destinationWalletId || null,
    holderContactId: args.holderContactId || null,
    agentContactId: DEMO_AGENT_CONTACT_ID,
  });
  if (!alloc.ok) {
    return { ok: false, state, error: alloc.message, code: alloc.code };
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

  const debitLabel =
    args.routingMode === 'COMPANY_WALLET'
      ? 'Demo USD TT Wallet'
      : 'Demo USD Custody Control (settings-mapped)';
  const preview = buildUsdAcquisitionJournalPreview({
    walletLabel: debitLabel,
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

  const nameById: Record<string, string> = {
    [DEMO_AGENT_CONTACT_ID]: DEMO_AGENT_NAME,
    [DEMO_SUPPLIER_A_ID]: 'Supplier A',
    [DEMO_SUPPLIER_B_ID]: 'Supplier B',
    [DEMO_THIRD_PARTY_ID]: 'China Custodian',
  };

  const distributedUsd =
    Math.round(distributionRows.reduce((s, r) => s + (Number(r.usd_qty) || 0), 0) * 1e6) / 1e6;
  const retainedUsd =
    args.routingMode === 'SPLIT_HOLD_AND_DISTRIBUTE'
      ? Number(args.retainedUsd) || 0
      : args.routingMode === 'DIRECT_DISTRIBUTION'
        ? 0
        : args.usdQty;

  let holderType: DemoCustodyPosition['holderType'] = 'AGENT';
  let holderLabel = DEMO_AGENT_NAME;
  if (args.routingMode === 'COMPANY_WALLET') {
    holderType = 'COMPANY_WALLET';
    holderLabel = 'Demo USD TT Wallet';
  } else if (args.routingMode === 'THIRD_PARTY_CUSTODY') {
    holderType = 'THIRD_PARTY';
    holderLabel = nameById[args.holderContactId || ''] || 'Third Party';
  } else if (args.routingMode === 'SPLIT_HOLD_AND_DISTRIBUTE') {
    if (args.destinationWalletId) {
      holderType = 'COMPANY_WALLET';
      holderLabel = 'Demo USD TT Wallet (retained)';
    } else if (args.holderContactId && args.holderContactId !== DEMO_AGENT_CONTACT_ID) {
      holderType = 'THIRD_PARTY';
      holderLabel = nameById[args.holderContactId] || 'Third Party';
    } else {
      holderType = 'AGENT';
      holderLabel = `${DEMO_AGENT_NAME} (retained)`;
    }
  }

  const eventNo = `DEMO-USD-${String(next.history.filter((h) => h.kind === 'USD_ACQUISITION').length + 1).padStart(4, '0')}`;
  const id = uid('demo-usd');
  const custodyId = retainedUsd > 0 ? uid('demo-custody') : null;
  const createdAt = new Date().toISOString();
  const journalPreviewRef = `DEMO-JE-PREVIEW-${eventNo}`;
  const distributionLines = mapDistributionLines(distributionRows, nameById);
  const statusLabels = operationalStatusLabels({
    routingMode: args.routingMode,
    distributedUsd,
    retainedUsd,
  });

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
    walletLabel: debitLabel,
    routingMode: args.routingMode,
    routingLabel: W31_ROUTING_LABELS[args.routingMode],
    holderLabel,
    retainedUsd,
    distributedUsd,
    statusLabels,
    distributionLines,
    custodyPositionId: custodyId,
    clientOperationId,
    downstreamConsumed: false,
    supplierApReduced: false,
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

  const custodyPositions = [...next.custodyPositions];
  if (custodyId && retainedUsd > 0) {
    custodyPositions.push({
      id: custodyId,
      acquisitionId: id,
      holderType,
      holderLabel,
      usdQty: retainedUsd,
      pkrCarrying: Math.round(retainedUsd * args.pkrPerUsd * 100) / 100,
      status: 'OPEN',
    });
  }

  let walletUsdQty = next.walletUsdQty;
  let agentHeldUsdQty = next.agentHeldUsdQty;
  let thirdPartyHeldUsdQty = next.thirdPartyHeldUsdQty;
  if (retainedUsd > 0) {
    if (holderType === 'COMPANY_WALLET') walletUsdQty = Math.round((walletUsdQty + retainedUsd) * 100) / 100;
    else if (holderType === 'AGENT') agentHeldUsdQty = Math.round((agentHeldUsdQty + retainedUsd) * 100) / 100;
    else thirdPartyHeldUsdQty = Math.round((thirdPartyHeldUsdQty + retainedUsd) * 100) / 100;
  }

  const receipt: DemoReceipt = {
    eventNo,
    journalPreviewRef,
    amountPkr: carryingPkr,
    clearingBalancePkr: availableDemoAdvancePkr({ ...next, advances }),
    timestamp: createdAt,
    clientOperationId,
    message: 'DEMO — NOT POSTED. No database, journal, payment or supplier settlement was created.',
  };

  next = {
    ...next,
    busy: false,
    advances,
    acquisitions: [...next.acquisitions, row],
    custodyPositions,
    clientOps: { ...next.clientOps, [clientOperationId]: { eventId: id, receipt } },
    history: [...next.history, row],
    walletUsdQty,
    agentHeldUsdQty,
    thirdPartyHeldUsdQty,
    agentApPreviewPkr: Math.round((next.agentApPreviewPkr + split.agentApCreatedPkr) * 100) / 100,
    lastReceipt: receipt,
    accountingStatus: 'NOT_POSTED',
  };
  return { ok: true, state: next, receipt };
}

/** Scenario helpers for W3.1 demo buttons. */
export function runDemoW31Scenario(
  state: ImportFxW3DemoState,
  scenario:
    | 'AGENT_HOLD_50K'
    | 'COMPANY_WALLET_50K'
    | 'THIRD_PARTY_50K'
    | 'SPLIT_10_8_5_27'
    | 'SUPPLIER_INTERMEDIARY'
    | 'OVER_ALLOCATION'
    | 'DUPLICATE_REPLAY'
    | 'REVERSE_BLOCKED'
): DemoActionResult {
  const base = {
    postingDate: todayIsoDate(),
    usdQty: 50_000,
    pkrPerUsd: 287.5,
    fundingType: 'CREDIT' as const,
  };

  switch (scenario) {
    case 'AGENT_HOLD_50K':
      return simulatePostUsdAcquisitionWithRouting(state, {
        ...base,
        routingMode: 'AGENT_CUSTODY',
        holderContactId: DEMO_AGENT_CONTACT_ID,
        clientOperationId: `scenario-agent-${Date.now()}`,
      });
    case 'COMPANY_WALLET_50K':
      return simulatePostUsdAcquisitionWithRouting(state, {
        ...base,
        routingMode: 'COMPANY_WALLET',
        destinationWalletId: DEMO_WALLET_ID,
        clientOperationId: `scenario-wallet-${Date.now()}`,
      });
    case 'THIRD_PARTY_50K':
      return simulatePostUsdAcquisitionWithRouting(state, {
        ...base,
        routingMode: 'THIRD_PARTY_CUSTODY',
        holderContactId: DEMO_THIRD_PARTY_ID,
        clientOperationId: `scenario-tp-${Date.now()}`,
      });
    case 'SPLIT_10_8_5_27':
      return simulatePostUsdAcquisitionWithRouting(state, {
        ...base,
        routingMode: 'SPLIT_HOLD_AND_DISTRIBUTE',
        holderContactId: DEMO_AGENT_CONTACT_ID,
        retainedUsd: 27_000,
        distributionRows: [
          {
            recipient_contact_id: DEMO_SUPPLIER_A_ID,
            purpose: 'SUPPLIER_INVOICE_SETTLEMENT',
            usd_qty: 10_000,
            linked_purchase_id: 'demo-po-a',
            recipient_role: 'supplier',
          },
          {
            recipient_contact_id: DEMO_SUPPLIER_B_ID,
            purpose: 'SUPPLIER_INVOICE_SETTLEMENT',
            usd_qty: 8_000,
            linked_purchase_id: 'demo-po-b',
            recipient_role: 'supplier',
          },
          {
            recipient_contact_id: DEMO_THIRD_PARTY_ID,
            purpose: 'THIRD_PARTY_CUSTODY',
            usd_qty: 5_000,
          },
        ],
        clientOperationId: `scenario-split-${Date.now()}`,
      });
    case 'SUPPLIER_INTERMEDIARY':
      return simulatePostUsdAcquisitionWithRouting(state, {
        ...base,
        usdQty: 12_000,
        routingMode: 'DIRECT_DISTRIBUTION',
        distributionRows: [
          {
            recipient_contact_id: DEMO_SUPPLIER_A_ID,
            purpose: 'THIRD_PARTY_CUSTODY',
            usd_qty: 12_000,
            recipient_role: 'supplier',
          },
        ],
        clientOperationId: `scenario-intermed-${Date.now()}`,
      });
    case 'OVER_ALLOCATION':
      return simulatePostUsdAcquisitionWithRouting(state, {
        ...base,
        routingMode: 'SPLIT_HOLD_AND_DISTRIBUTE',
        retainedUsd: 27_000,
        distributionRows: [
          { recipient_contact_id: DEMO_SUPPLIER_A_ID, purpose: 'OTHER_REVIEW_REQUIRED', usd_qty: 30_000 },
        ],
      });
    case 'DUPLICATE_REPLAY': {
      const op = 'demo-fixed-op-replay';
      const first = simulatePostUsdAcquisitionWithRouting(state, {
        ...base,
        usdQty: 1_000,
        routingMode: 'AGENT_CUSTODY',
        holderContactId: DEMO_AGENT_CONTACT_ID,
        clientOperationId: op,
      });
      if (!first.ok) return first;
      return simulatePostUsdAcquisitionWithRouting(first.state, {
        ...base,
        usdQty: 1_000,
        routingMode: 'AGENT_CUSTODY',
        holderContactId: DEMO_AGENT_CONTACT_ID,
        clientOperationId: op,
      });
    }
    case 'REVERSE_BLOCKED': {
      const posted = simulatePostUsdAcquisitionWithRouting(state, {
        ...base,
        usdQty: 5_000,
        routingMode: 'AGENT_CUSTODY',
        holderContactId: DEMO_AGENT_CONTACT_ID,
        clientOperationId: `scenario-revblock-${Date.now()}`,
      });
      if (!posted.ok) return posted;
      const acq = posted.state.acquisitions[posted.state.acquisitions.length - 1];
      const consumed = markDemoAcquisitionDownstreamConsumed(posted.state, acq.id);
      if (!consumed.ok) return consumed;
      return simulateReverseUsdAcquisition(consumed.state, acq.id);
    }
    default:
      return { ok: false, state, error: 'Unknown scenario', code: 'UNKNOWN' };
  }
}

export function markDemoAcquisitionDownstreamConsumed(
  state: ImportFxW3DemoState,
  acquisitionId: string
): DemoActionResult {
  const row = state.acquisitions.find((a) => a.id === acquisitionId);
  if (!row || row.status !== 'SIMULATED') {
    return { ok: false, state, error: 'Acquisition not found', code: 'NOT_FOUND' };
  }
  const acquisitions = state.acquisitions.map((a) =>
    a.id === acquisitionId ? { ...a, downstreamConsumed: true } : a
  );
  const custodyPositions = state.custodyPositions.map((c) =>
    c.acquisitionId === acquisitionId ? { ...c, status: 'CONSUMED' as const } : c
  );
  return {
    ok: true,
    state: { ...state, acquisitions, custodyPositions, accountingStatus: 'NOT_POSTED' },
  };
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
        message: 'DEMO — NOT POSTED. No database, journal, payment or supplier settlement was created.',
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
  if (row.downstreamConsumed) {
    return {
      ok: false,
      state,
      error: 'Reversal blocked — later custody/distribution consumption exists (simulated).',
      code: 'DOWNSTREAM_CONSUMED',
    };
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
  const custodyPositions = state.custodyPositions.map((c) =>
    c.acquisitionId === acquisitionId ? { ...c, status: 'CONSUMED' as const, usdQty: 0 } : c
  );

  let walletUsdQty = state.walletUsdQty;
  let agentHeldUsdQty = state.agentHeldUsdQty;
  let thirdPartyHeldUsdQty = state.thirdPartyHeldUsdQty;
  const pos = state.custodyPositions.find((c) => c.acquisitionId === acquisitionId && c.status === 'OPEN');
  if (pos) {
    if (pos.holderType === 'COMPANY_WALLET') walletUsdQty = Math.round((walletUsdQty - pos.usdQty) * 100) / 100;
    else if (pos.holderType === 'AGENT') agentHeldUsdQty = Math.round((agentHeldUsdQty - pos.usdQty) * 100) / 100;
    else thirdPartyHeldUsdQty = Math.round((thirdPartyHeldUsdQty - pos.usdQty) * 100) / 100;
  } else if (row.routingMode === 'COMPANY_WALLET') {
    walletUsdQty = Math.round((walletUsdQty - row.usdQty) * 100) / 100;
  }

  return {
    ok: true,
    state: {
      ...state,
      advances,
      acquisitions,
      custodyPositions,
      history,
      walletUsdQty,
      agentHeldUsdQty,
      thirdPartyHeldUsdQty,
      agentApPreviewPkr: Math.round((state.agentApPreviewPkr - row.agentApCreatedPkr) * 100) / 100,
      accountingStatus: 'NOT_POSTED',
      lastReceipt: {
        eventNo: `${row.eventNo}-REV`,
        journalPreviewRef: `DEMO-JE-REV-${row.eventNo}`,
        amountPkr: row.carryingPkr,
        clearingBalancePkr: availableDemoAdvancePkr({ ...state, advances }),
        timestamp: new Date().toISOString(),
        message: 'DEMO — NOT POSTED. No database, journal, payment or supplier settlement was created.',
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
    return {
      ...createInitialImportFxW3DemoState(),
      ...parsed,
      custodyPositions: parsed.custodyPositions || [],
      clientOps: parsed.clientOps || {},
      agentHeldUsdQty: parsed.agentHeldUsdQty || 0,
      thirdPartyHeldUsdQty: parsed.thirdPartyHeldUsdQty || 0,
      busy: false,
    };
  } catch {
    return null;
  }
}

/** Confirms this module never references supabase client / RPC call sites. */
export const DEMO_STORE_HAS_NO_NETWORK = true as const;
