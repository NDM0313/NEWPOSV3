import {
  runCompanyReconciliationChecks,
  type LabCheckResult,
} from '@/app/services/accountingIntegrityLabService';

type UnifiedChecksArgs = {
  companyId: string;
  branchId?: string | null;
};

export async function runUnifiedAccountingCompanyChecks(
  args: UnifiedChecksArgs
): Promise<LabCheckResult[]> {
  return runCompanyReconciliationChecks(args.companyId, args.branchId ?? null);
}
