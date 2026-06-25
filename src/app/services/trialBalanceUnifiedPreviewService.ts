/**
 * Trial Balance — unified engine shadow preview loader (Phase 2.5).
 * Parallel fetch only — never imported by TrialBalancePage legacy load.
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { mapUnifiedAccountsToTrialBalanceRows } from '@/app/lib/trialBalanceUnifiedMapper';
import { buildTrialBalancePreviewRpcScope } from '@/app/lib/trialBalanceUnifiedPreviewScope';
import { DEFAULT_TRIAL_BALANCE_PREVIEW_BASIS } from '@/app/lib/trialBalanceUnifiedPreviewDiff';
import type { TrialBalanceRow } from '@/app/services/accountingReportsService';
import {
  getUnifiedTrialBalance,
  type UnifiedLedgerMeta,
  type UnifiedTrialBalanceAccount,
} from '@/app/services/unifiedLedgerService';

export type TrialBalanceUnifiedPreviewResult = {
  rows: TrialBalanceRow[];
  accounts: UnifiedTrialBalanceAccount[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
  meta: UnifiedLedgerMeta;
  basis: UnifiedLedgerBasis;
  rpcScope: ReturnType<typeof buildTrialBalancePreviewRpcScope>;
  blockedByKillSwitch?: boolean;
  blockReason?: string;
};

function blockedResult(
  basis: UnifiedLedgerBasis,
  message: string,
  rpcScope: ReturnType<typeof buildTrialBalancePreviewRpcScope>
): TrialBalanceUnifiedPreviewResult {
  return {
    rows: [],
    accounts: [],
    totalDebit: 0,
    totalCredit: 0,
    difference: 0,
    basis,
    rpcScope,
    blockedByKillSwitch: true,
    blockReason: message,
    meta: {
      engine: 'disabled',
      basis,
      featureFlagEnabled: false,
      shadowForce: false,
      queryDurationMs: 0,
      rowCount: 0,
      periodOpeningBalance: 0,
      message,
    },
  };
}

export async function loadTrialBalanceUnifiedPreview(params: {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string;
  basis?: UnifiedLedgerBasis;
}): Promise<TrialBalanceUnifiedPreviewResult> {
  const basis = params.basis ?? DEFAULT_TRIAL_BALANCE_PREVIEW_BASIS;
  const rpcScope = buildTrialBalancePreviewRpcScope({
    startDate: params.startDate,
    endDate: params.endDate,
    branchId: params.branchId,
  });

  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(params.companyId);
  if (killSwitchActive) {
    return blockedResult(
      basis,
      'Unified preview blocked — kill switch active on Trial Balance.',
      rpcScope
    );
  }

  const unified = await getUnifiedTrialBalance({
    companyId: params.companyId,
    branchId: rpcScope.branchId,
    asOfDate: rpcScope.asOfDate,
    basis,
    shadowForce: true,
  });

  return {
    rows: mapUnifiedAccountsToTrialBalanceRows(unified.accounts),
    accounts: unified.accounts,
    totalDebit: unified.totalDebit,
    totalCredit: unified.totalCredit,
    difference: unified.difference,
    meta: unified.meta,
    basis,
    rpcScope,
  };
}
