/**
 * DIN CHINA pilot golden batch compare — shadow only (Phase 2.2).
 * Replicates 9/9 tie-out matrix: MR JALIL × 3 bases × 3 branch scopes.
 */

import { supabase } from '@/lib/supabase';
import {
  DIN_CHINA_COMPANY_ID,
  DIN_CHINA_COMPANY_NAME,
  MR_JALIL_CONTACT_ID,
  MR_JALIL_CONTACT_NAME,
  PILOT_BATCH_BASES,
  PILOT_BATCH_BRANCH_SCOPES,
  type PilotBatchBranchScope,
} from '@/app/lib/unifiedLedgerGoldenFixtures';
import {
  compareCompanyContactTieOut,
  type CompanyTieOutRow,
} from '@/app/services/unifiedLedgerAllCompanyTieOutService';
import { summarizeAllCompanyTieOut, type AllCompanyTieOutSummary } from '@/app/lib/unifiedLedgerTieOutSummary';

export type PilotBatchCompareResult = {
  summary: AllCompanyTieOutSummary;
  rows: CompanyTieOutRow[];
};

async function resolveBranchId(
  companyId: string,
  scope: PilotBatchBranchScope
): Promise<string | null> {
  if (scope.branchId) return scope.branchId;
  if (!scope.branchCode && !scope.branchMatchName) return null;

  let query = supabase
    .from('branches')
    .select('id, name, code')
    .eq('company_id', companyId)
    .eq('is_active', true);

  const { data } = await query;
  const branches = data || [];

  if (scope.branchCode) {
    const match = branches.find((b) => String(b.code || '').trim() === scope.branchCode);
    return match?.id ?? null;
  }
  if (scope.branchMatchName) {
    const match = branches.find((b) =>
      String(b.name || '').toUpperCase().includes(scope.branchMatchName!.toUpperCase())
    );
    return match?.id ?? null;
  }
  return null;
}

export async function runDinChinaPilotBatchCompare(params?: {
  dateFrom?: string | null;
  dateTo?: string | null;
  useHybridOldEngine?: boolean;
}): Promise<PilotBatchCompareResult> {
  const rows: CompanyTieOutRow[] = [];

  for (const branchScope of PILOT_BATCH_BRANCH_SCOPES) {
    const branchId = await resolveBranchId(DIN_CHINA_COMPANY_ID, branchScope);
    for (const basis of PILOT_BATCH_BASES) {
      const row = await compareCompanyContactTieOut({
        scope: {
          companyId: DIN_CHINA_COMPANY_ID,
          companyName: DIN_CHINA_COMPANY_NAME,
          branchId,
          branchLabel: branchScope.label,
        },
        contact: {
          contactId: MR_JALIL_CONTACT_ID,
          contactName: MR_JALIL_CONTACT_NAME,
          contactCode: null,
          partyType: 'customer',
        },
        basis,
        dateFrom: params?.dateFrom ?? null,
        dateTo: params?.dateTo ?? null,
        useHybridOldEngine: params?.useHybridOldEngine ?? false,
      });
      rows.push(row);
    }
  }

  return {
    rows,
    summary: summarizeAllCompanyTieOut(rows),
  };
}
