/**
 * Pure helpers + shared stage constants for Import FX Case W1 (no I/O).
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

/** W1 may confirm only ARRANGEMENT as a completed planning stage. */
export function isW1ConfirmableStage(stageCode: ImportFxStageCode): boolean {
  return stageCode === 'ARRANGEMENT';
}

export function stageLabel(stageCode: ImportFxStageCode): string {
  return IMPORT_FX_STAGE_ORDER.find((s) => s.code === stageCode)?.label ?? stageCode;
}

export function isMoneyStageBlockedInW1(stageCode: ImportFxStageCode): boolean {
  return stageCode !== 'ARRANGEMENT';
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
    throw new Error('W1 planning events must keep posts_journal=false');
  }
}
