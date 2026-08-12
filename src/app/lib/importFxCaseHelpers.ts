/**
 * Pure helpers + shared stage constants for Import FX Case (W1 shell + W2 ARRANGEMENT enrichment).
 * Money stages remain blocked until W3+.
 */

export type ImportFxStageCode =
  | 'ARRANGEMENT'
  | 'ADVANCE'
  | 'USD_ACQUISITION'
  | 'CHINA_USD_TRANSFER'
  | 'USD_CNY_CONVERSION'
  | 'CNY_POOL'
  | 'SUPPLIER_ALLOCATION'
  | 'RECONCILIATION';

export type ImportFxStageStatus =
  | 'NOT_STARTED'
  | 'PLANNED'
  | 'AWAITING_ACTION'
  | 'IN_PROGRESS'
  | 'PARTIALLY_COMPLETED'
  | 'AWAITING_CONFIRMATION'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REVERSED';

export type ImportFxFundingMode = 'ADVANCE' | 'CREDIT' | 'MIXED';

export const IMPORT_FX_STAGE_ORDER: { code: ImportFxStageCode; label: string }[] = [
  { code: 'ARRANGEMENT', label: 'Arrangement' },
  { code: 'ADVANCE', label: 'Advance / Funding' },
  { code: 'USD_ACQUISITION', label: 'USD Acquisition' },
  { code: 'CHINA_USD_TRANSFER', label: 'China USD Transfer' },
  { code: 'USD_CNY_CONVERSION', label: 'USD → CNY Conversion' },
  { code: 'CNY_POOL', label: 'CNY Pool' },
  { code: 'SUPPLIER_ALLOCATION', label: 'Supplier Allocations' },
  { code: 'RECONCILIATION', label: 'Reconciliation' },
];

export const IMPORT_FX_FUNDING_MODES: { value: ImportFxFundingMode; label: string }[] = [
  { value: 'CREDIT', label: 'Credit (intention)' },
  { value: 'ADVANCE', label: 'Advance (intention — not paid)' },
  { value: 'MIXED', label: 'Mixed (intention)' },
];

/** W1/W2: only ARRANGEMENT may be confirmed. */
export function isW1ConfirmableStage(stageCode: ImportFxStageCode): boolean {
  return stageCode === 'ARRANGEMENT';
}

/** Alias for W2 naming. */
export function isW2ConfirmableStage(stageCode: ImportFxStageCode): boolean {
  return isW1ConfirmableStage(stageCode);
}

export function stageLabel(stageCode: ImportFxStageCode): string {
  return IMPORT_FX_STAGE_ORDER.find((s) => s.code === stageCode)?.label ?? stageCode;
}

/** Money stages blocked in W1 and W2 (confirm/complete deferred to W3+). */
export function isMoneyStageBlockedInW1(stageCode: ImportFxStageCode): boolean {
  return stageCode !== 'ARRANGEMENT';
}

export function isMoneyStageBlockedInW2(stageCode: ImportFxStageCode): boolean {
  return isMoneyStageBlockedInW1(stageCode);
}

export function normalizeFundingMode(raw: string | null | undefined): ImportFxFundingMode | null {
  const v = String(raw || '')
    .trim()
    .toUpperCase();
  if (v === 'ADVANCE' || v === 'CREDIT' || v === 'MIXED') return v;
  return null;
}

export function assertNonNegativePlanningAmount(value: number | null | undefined, field: string): void {
  if (value != null && Number.isFinite(value) && value < 0) {
    throw new Error(`IMPORT_FX_CASE_NEGATIVE_AMOUNT: ${field}`);
  }
}

export function canEditArrangementType(params: {
  operationalStatus: string | null | undefined;
  arrangementStageStatus: string | null | undefined;
  arrangementConfirmedAt: string | null | undefined;
}): boolean {
  if (params.arrangementConfirmedAt) return false;
  if (String(params.arrangementStageStatus || '') === 'COMPLETED') return false;
  return String(params.operationalStatus || '') === 'DRAFT';
}

export function stageStatusTone(status: ImportFxStageStatus): 'muted' | 'amber' | 'green' | 'red' {
  switch (status) {
    case 'COMPLETED':
      return 'green';
    case 'AWAITING_CONFIRMATION':
    case 'IN_PROGRESS':
    case 'PARTIALLY_COMPLETED':
    case 'PLANNED':
    case 'AWAITING_ACTION':
      return 'amber';
    case 'FAILED':
    case 'CANCELLED':
    case 'REVERSED':
      return 'red';
    default:
      return 'muted';
  }
}

/** Planning stages must never claim a journal was posted. */
export function assertPlanningEventDoesNotPost(postsJournal: boolean): void {
  if (postsJournal) {
    throw new Error('W2 planning events must keep posts_journal=false');
  }
}

export const W2_MONEY_STAGE_BLOCKED_COPY =
  'Available in W3+ — no financial posting in W2';
