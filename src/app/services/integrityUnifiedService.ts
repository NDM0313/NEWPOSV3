import {
  runCompanyReconciliationChecks,
  type LabCheckResult,
} from '@/app/services/accountingIntegrityLabService';

export interface UnifiedCompanyChecksInput {
  companyId: string;
  branchId?: string | null;
}

/**
 * Backward-compatible wrapper used by AccountingIntegrityLabPage.
 * Unified checks currently map to company reconciliation suite.
 */
export async function runUnifiedAccountingCompanyChecks(
  input: UnifiedCompanyChecksInput
): Promise<LabCheckResult[]> {
  return runCompanyReconciliationChecks(input.companyId, input.branchId);
}

