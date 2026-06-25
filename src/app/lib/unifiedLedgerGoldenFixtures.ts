/**
 * Golden fixtures for admin unified ledger compare (Phase 2.2).
 * Mirrors scripts/single-core-ledger/pilot-companies.json + Phase 1.8 validation.
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import type { UnifiedPartyType } from '@/app/services/unifiedLedgerService';
import { DEFAULT_COMPARE_TOLERANCE } from '@/app/lib/unifiedLedgerCompareTypes';
import { balancePasses, round2 } from './unifiedLedgerCompareDiff';

export const DIN_CHINA_COMPANY_ID = '30bd8592-3384-4f34-899a-f3907e336485';
export const DIN_CHINA_COMPANY_NAME = 'DIN CHINA';

export const MR_JALIL_CONTACT_ID = 'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93';
export const MR_JALIL_CONTACT_NAME = 'MR JALIL';
export const MR_JALIL_EXPECTED_BALANCE = 216_300;

export const CLONE_REFERENCE = 'ledger_stage_20260625_prodcheck';
export const GATE_A_STATUS = 'PASS 3/3';
export const TIEOUT_STATUS = 'PASS 9/9';

export const BALANCE_TOLERANCE = DEFAULT_COMPARE_TOLERANCE;

export type GoldenContactPattern = {
  label: string;
  namePattern?: string;
  code?: string;
  partyType: UnifiedPartyType;
};

export const GOLDEN_CONTACT_PATTERNS: GoldenContactPattern[] = [
  { label: 'JALIL', namePattern: 'JALIL', partyType: 'customer' },
  { label: 'Inayat', namePattern: 'INAYAT', partyType: 'customer' },
  { label: 'Saqib', namePattern: 'SAQIB', partyType: 'customer' },
  { label: 'Walk-in CUS-0000', code: 'CUS-0000', partyType: 'customer' },
];

export type PilotBatchBranchScope = {
  label: string;
  branchId: string | null;
  branchCode?: string;
  branchMatchName?: string;
};

/** Matches all-company tie-out 9/9: MR JALIL × 3 bases × 3 branch scopes. */
export const PILOT_BATCH_BRANCH_SCOPES: PilotBatchBranchScope[] = [
  { label: 'All branches', branchId: null },
  { label: 'Main Branch / HQ', branchId: null, branchMatchName: 'DIN CHINA' },
  { label: 'BL0002', branchId: null, branchCode: 'BL0002' },
];

export const PILOT_BATCH_BASES: UnifiedLedgerBasis[] = [
  'official_gl',
  'effective_party',
  'audit_full_history',
];

export function balanceMatchesGolden(expected: number, actual: number, tolerance = BALANCE_TOLERANCE): boolean {
  return balancePasses(round2(expected - actual), tolerance);
}
