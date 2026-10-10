/**
 * Import FX Case W2.1 — operator clarity helpers (planning only; never posts journals).
 */

import type { ImportFxArrangementType, ImportFxFundingMode } from '@/app/lib/importFxCaseHelpers';

export type ImportFxAssignmentPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ImportFxAssignmentStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_AGENT'
  | 'WAITING_THIRD_PARTY'
  | 'DONE'
  | 'CANCELLED';

/** All shipped arrangement families require a money-exchange agent on confirm. */
export const IMPORT_FX_ARRANGEMENT_TYPES_REQUIRING_AGENT: readonly ImportFxArrangementType[] = [
  'PATH_21_AGENT_DUAL_CREDIT',
  'POOLED_USD_CNY',
  'AGENT_PREPAID',
] as const;

export function arrangementTypeRequiresAgent(
  arrangementType: string | null | undefined
): boolean {
  const t = String(arrangementType || '')
    .trim()
    .toUpperCase();
  return (IMPORT_FX_ARRANGEMENT_TYPES_REQUIRING_AGENT as readonly string[]).includes(t);
}

export const W21_HISTORICAL_MISSING_AGENT_WARNING =
  'Confirmed arrangement has no money-exchange agent. Review before financial execution.';

export const W21_PLANNING_NOT_POSTED_BADGE = 'Not financially posted';

export const W21_PATH_CLARITY_CASE_COPY =
  'Planning/workflow only — no wallet or accounting posting in W2.';

export const W21_PATH_CLARITY_AGENT_FX_COPY =
  'This is a separate money-posting workflow. It can affect Agent AP, Cash/Bank, TT wallet and Supplier AP.';

export const W21_PATH_CLARITY_LEAVE_WARNING =
  'Ensure this transaction has not already been recorded through another payment path.';

export const W21_WALLET_SOURCE_GUIDANCE =
  'W2 case planning never creates a TT/USD wallet balance. Wallet movements come from Path 21 or other approved payment/journal paths — not from confirming ARRANGEMENT.';

/** Explicit directional labels (IFX-GAP-03). */
export const W21_RATE_LABEL_PKR_PER_USD = 'PKR per 1 USD';
export const W21_RATE_LABEL_PKR_PER_CNY = 'PKR per 1 CNY';
export const W21_RATE_LABEL_CNY_PER_USD = 'CNY received per 1 USD';
export const W21_RATE_LABEL_USD_PER_CNY = 'USD required per 1 CNY';

export function formatW21RateLabel(
  kind: 'pkr_per_usd' | 'pkr_per_cny' | 'cny_per_usd' | 'usd_per_cny'
): string {
  switch (kind) {
    case 'pkr_per_usd':
      return W21_RATE_LABEL_PKR_PER_USD;
    case 'pkr_per_cny':
      return W21_RATE_LABEL_PKR_PER_CNY;
    case 'cny_per_usd':
      return W21_RATE_LABEL_CNY_PER_USD;
    case 'usd_per_cny':
      return W21_RATE_LABEL_USD_PER_CNY;
  }
}

export function computeExpectedTotalPkr(params: {
  plannedUsd?: number | null;
  pkrPerUsd?: number | null;
  feesPkr?: number | null;
}): number | null {
  const usd = params.plannedUsd;
  const rate = params.pkrPerUsd;
  const fees = params.feesPkr ?? 0;
  if (usd == null || rate == null || !Number.isFinite(usd) || !Number.isFinite(rate)) return null;
  if (usd < 0 || rate < 0) return null;
  const feesN = Number.isFinite(fees) && fees > 0 ? fees : 0;
  return usd * rate + feesN;
}

/** Canonical: CREDIT clears planned advance (NULL). */
export function normalizeAdvanceForFundingMode(
  fundingMode: ImportFxFundingMode | '' | null | undefined,
  advancePkr: number | null | undefined
): number | null {
  const mode = String(fundingMode || '')
    .trim()
    .toUpperCase();
  if (mode === 'CREDIT') return null;
  if (advancePkr == null || !Number.isFinite(advancePkr)) return null;
  return advancePkr;
}

export function computeExpectedAgentCreditPkr(params: {
  fundingMode: ImportFxFundingMode | '' | null | undefined;
  expectedTotalPkr: number | null;
  advancePkr: number | null;
}): number | null {
  const mode = String(params.fundingMode || '')
    .trim()
    .toUpperCase();
  const total = params.expectedTotalPkr;
  const advance = params.advancePkr ?? 0;
  if (mode === 'ADVANCE') return 0;
  if (mode === 'CREDIT') return total;
  if (mode === 'MIXED') {
    if (total == null) return null;
    return Math.max(0, total - (Number.isFinite(advance) ? advance : 0));
  }
  return null;
}

export type FundingSummaryView = {
  fundingMode: ImportFxFundingMode | null;
  expectedTotalPkr: number | null;
  showPlannedAdvance: boolean;
  plannedAdvancePkr: number | null;
  showExpectedAgentCredit: boolean;
  expectedAgentCreditPkr: number | null;
  notFinanciallyPosted: true;
};

export function buildFundingSummaryView(params: {
  fundingMode: ImportFxFundingMode | '' | null | undefined;
  plannedUsd?: number | null;
  pkrPerUsd?: number | null;
  feesPkr?: number | null;
  advancePkr?: number | null;
}): FundingSummaryView {
  const rawMode = String(params.fundingMode || '')
    .trim()
    .toUpperCase();
  const mode =
    rawMode === 'ADVANCE' || rawMode === 'CREDIT' || rawMode === 'MIXED'
      ? (rawMode as ImportFxFundingMode)
      : null;
  const expectedTotalPkr = computeExpectedTotalPkr({
    plannedUsd: params.plannedUsd,
    pkrPerUsd: params.pkrPerUsd,
    feesPkr: params.feesPkr,
  });
  const normalizedAdvance = normalizeAdvanceForFundingMode(mode, params.advancePkr);
  const credit = computeExpectedAgentCreditPkr({
    fundingMode: mode,
    expectedTotalPkr,
    advancePkr: normalizedAdvance,
  });

  return {
    fundingMode: mode,
    expectedTotalPkr,
    showPlannedAdvance: mode === 'ADVANCE' || mode === 'MIXED',
    plannedAdvancePkr: mode === 'CREDIT' ? null : normalizedAdvance,
    showExpectedAgentCredit: mode === 'CREDIT' || mode === 'MIXED',
    expectedAgentCreditPkr: mode === 'ADVANCE' ? 0 : credit,
    notFinanciallyPosted: true,
  };
}

export function validateW21ArrangementPlanning(input: {
  arrangementType?: string | null;
  agentId?: string | null;
  thirdPartyId?: string | null;
  fundingMode?: string | null;
  plannedUsd?: string | null;
  expectedCny?: string | null;
  expectedPkrPerUsd?: string | null;
  expectedCnyPerUsd?: string | null;
  expectedFeesPkr?: string | null;
  expectedAdvanceAmountPkr?: string | null;
  /** When true (confirm), require agent for agent-dependent types. */
  requireAgentIfNeeded?: boolean;
}): string[] {
  const errors: string[] = [];
  const agent = String(input.agentId || '').trim();
  const third = String(input.thirdPartyId || '').trim();
  if (agent && third && agent === third) {
    errors.push('Agent and third party must be different contacts.');
  }
  if (input.requireAgentIfNeeded && arrangementTypeRequiresAgent(input.arrangementType) && !agent) {
    errors.push('Money exchange agent is required for this arrangement type.');
  }

  const amounts: Array<[string | null | undefined, string]> = [
    [input.plannedUsd, 'Expected USD amount'],
    [input.expectedCny, 'Expected CNY amount'],
    [input.expectedPkrPerUsd, 'PKR per 1 USD rate'],
    [input.expectedCnyPerUsd, 'CNY received per 1 USD rate'],
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

  const mode = String(input.fundingMode || '')
    .trim()
    .toUpperCase();
  const usd = String(input.plannedUsd || '').trim() ? Number(input.plannedUsd) : null;
  const rate = String(input.expectedPkrPerUsd || '').trim() ? Number(input.expectedPkrPerUsd) : null;
  const fees = String(input.expectedFeesPkr || '').trim() ? Number(input.expectedFeesPkr) : 0;
  const advanceRaw = String(input.expectedAdvanceAmountPkr || '').trim()
    ? Number(input.expectedAdvanceAmountPkr)
    : null;
  const advance = normalizeAdvanceForFundingMode(
    mode as ImportFxFundingMode,
    advanceRaw
  );
  const total = computeExpectedTotalPkr({
    plannedUsd: usd,
    pkrPerUsd: rate,
    feesPkr: fees,
  });
  if (mode === 'MIXED' && total != null && advance != null && advance > total) {
    errors.push('Planned advance cannot exceed expected total PKR cost.');
  }
  if (mode === 'CREDIT' && advanceRaw != null && advanceRaw !== 0) {
    // Soft: UI should clear; still warn if non-zero left in form before normalize
    // (confirm path still OK after server normalize — client clears on switch).
  }

  return errors;
}

export function isHistoricalConfirmedMissingAgent(params: {
  arrangementConfirmedAt?: string | null;
  arrangementStageStatus?: string | null;
  operationalStatus?: string | null;
  agentContactId?: string | null;
  arrangementType?: string | null;
}): boolean {
  const confirmed =
    !!params.arrangementConfirmedAt ||
    String(params.arrangementStageStatus || '') === 'COMPLETED' ||
    String(params.operationalStatus || '') === 'ARRANGED';
  if (!confirmed) return false;
  if (!arrangementTypeRequiresAgent(params.arrangementType)) return false;
  return !String(params.agentContactId || '').trim();
}

export const IMPORT_FX_ASSIGNMENT_PRIORITIES: {
  value: ImportFxAssignmentPriority;
  label: string;
}[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export const IMPORT_FX_ASSIGNMENT_STATUSES: {
  value: ImportFxAssignmentStatus;
  label: string;
}[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'WAITING_AGENT', label: 'Waiting agent' },
  { value: 'WAITING_THIRD_PARTY', label: 'Waiting third party' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function isAssignmentOverdue(params: {
  dueAt?: string | null;
  status?: string | null;
}): boolean {
  const status = String(params.status || '').toUpperCase();
  if (status === 'DONE' || status === 'CANCELLED') return false;
  if (!params.dueAt) return false;
  const t = new Date(params.dueAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

export function formatUserOption(user: {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
}): { id: string; name: string; searchText: string } {
  const name = String(user.full_name || user.email || 'User').trim();
  const email = String(user.email || '').trim();
  const role = String(user.role || '').trim();
  const label = [name, email && email !== name ? email : null, role ? `(${role})` : null]
    .filter(Boolean)
    .join(' · ');
  return {
    id: user.id,
    name: label,
    searchText: [name, email, role].filter(Boolean).join(' ').toLowerCase(),
  };
}
