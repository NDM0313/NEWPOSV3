/**
 * Phase 3A — BS / P&L unified preview loaders (parallel fetch only).
 * Never replaces accountingReportsService.getBalanceSheet / getProfitLoss main paths.
 */

import { supabase } from '@/lib/supabase';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import {
  mapTrialBalanceToBalanceSheetPreview,
  type BalanceSheetUnifiedPreviewResult,
  type BsPlAccountMeta,
} from '@/app/lib/accounting/balanceSheetUnifiedPreviewMapper';
import {
  mapTrialBalanceRowsToProfitLossPreview,
  type ProfitLossUnifiedPreviewResult,
} from '@/app/lib/accounting/profitLossUnifiedPreviewMapper';
import { DEFAULT_BS_PL_PREVIEW_BASIS } from '@/app/lib/accounting/bsPlUnifiedPreviewDiff';
import { loadTrialBalanceUnifiedPreview } from '@/app/services/trialBalanceUnifiedPreviewService';
import type { TrialBalanceUnifiedPreviewResult } from '@/app/services/trialBalanceUnifiedPreviewService';

const BS_LIFETIME_START = '1900-01-01';

async function fetchActiveAccounts(companyId: string): Promise<BsPlAccountMeta[]> {
  let { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, code, name, type, parent_id, is_group')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (error && String(error.message || '').includes('parent_id')) {
    const retry = await supabase
      .from('accounts')
      .select('id, code, name, type')
      .eq('company_id', companyId)
      .eq('is_active', true);
    accounts = (retry.data || []).map((a) => ({ ...a, parent_id: null, is_group: false }));
  }

  return (accounts || []) as BsPlAccountMeta[];
}

export type BalanceSheetUnifiedPreviewLoadResult = {
  preview: BalanceSheetUnifiedPreviewResult | null;
  tbPreview: TrialBalanceUnifiedPreviewResult;
  basis: UnifiedLedgerBasis;
};

export type ProfitLossUnifiedPreviewLoadResult = {
  preview: ProfitLossUnifiedPreviewResult | null;
  tbPreview: TrialBalanceUnifiedPreviewResult;
  basis: UnifiedLedgerBasis;
};

export async function loadBalanceSheetUnifiedPreview(params: {
  companyId: string;
  asOfDate: string;
  branchId?: string;
  basis?: UnifiedLedgerBasis;
}): Promise<BalanceSheetUnifiedPreviewLoadResult> {
  const basis = params.basis ?? DEFAULT_BS_PL_PREVIEW_BASIS;
  const asOf = params.asOfDate.slice(0, 10);
  const tbPreview = await loadTrialBalanceUnifiedPreview({
    companyId: params.companyId,
    startDate: BS_LIFETIME_START,
    endDate: asOf,
    branchId: params.branchId,
    basis,
  });

  if (tbPreview.blockedByKillSwitch) {
    return { preview: null, tbPreview, basis };
  }

  const accounts = await fetchActiveAccounts(params.companyId);
  const preview = mapTrialBalanceToBalanceSheetPreview({
    tb: tbPreview,
    accounts,
    asOfDate: asOf,
  });

  return { preview, tbPreview, basis };
}

export async function loadProfitLossUnifiedPreview(params: {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string;
  basis?: UnifiedLedgerBasis;
}): Promise<ProfitLossUnifiedPreviewLoadResult> {
  const basis = params.basis ?? DEFAULT_BS_PL_PREVIEW_BASIS;
  const tbPreview = await loadTrialBalanceUnifiedPreview({
    companyId: params.companyId,
    startDate: params.startDate,
    endDate: params.endDate,
    branchId: params.branchId,
    basis,
  });

  if (tbPreview.blockedByKillSwitch) {
    return { preview: null, tbPreview, basis };
  }

  const preview = mapTrialBalanceRowsToProfitLossPreview({
    rows: tbPreview.rows,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  return { preview, tbPreview, basis };
}
