/**
 * Phase 3D — BS / P&L unified engine main loaders.
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { DEFAULT_BS_PL_PREVIEW_BASIS } from '@/app/lib/accounting/bsPlUnifiedPreviewDiff';
import { mapUnifiedTrialBalanceToBalanceSheetMain } from '@/app/lib/accounting/balanceSheetUnifiedMainMapper';
import {
  mapUnifiedTrialBalanceToProfitLossComparison,
  mapUnifiedTrialBalanceToProfitLossMain,
} from '@/app/lib/accounting/profitLossUnifiedMainMapper';
import type { BalanceSheetResult, ProfitLossResult } from '@/app/services/accountingReportsService';
import {
  fetchActiveAccountsForBsPl,
  loadBalanceSheetUnifiedPreview,
  loadProfitLossUnifiedPreview,
} from '@/app/services/bsPlUnifiedPreviewService';

export async function loadBalanceSheetUnifiedMain(params: {
  companyId: string;
  asOfDate: string;
  branchId?: string;
  basis?: UnifiedLedgerBasis;
}): Promise<BalanceSheetResult> {
  const basis = params.basis ?? DEFAULT_BS_PL_PREVIEW_BASIS;
  const asOf = params.asOfDate.slice(0, 10);
  const previewLoad = await loadBalanceSheetUnifiedPreview({
    companyId: params.companyId,
    asOfDate: asOf,
    branchId: params.branchId,
    basis,
  });

  if (previewLoad.tbPreview.blockedByKillSwitch) {
    throw new Error(previewLoad.tbPreview.blockReason ?? 'Unified Balance Sheet blocked by kill switch.');
  }

  const accounts = await fetchActiveAccountsForBsPl(params.companyId);
  return mapUnifiedTrialBalanceToBalanceSheetMain({
    tb: previewLoad.tbPreview,
    accounts,
    asOfDate: asOf,
  });
}

export async function loadProfitLossUnifiedMain(params: {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string;
  basis?: UnifiedLedgerBasis;
  compareStartDate?: string;
  compareEndDate?: string;
}): Promise<ProfitLossResult> {
  const basis = params.basis ?? DEFAULT_BS_PL_PREVIEW_BASIS;
  const previewLoad = await loadProfitLossUnifiedPreview({
    companyId: params.companyId,
    startDate: params.startDate,
    endDate: params.endDate,
    branchId: params.branchId,
    basis,
  });

  if (previewLoad.tbPreview.blockedByKillSwitch) {
    throw new Error(previewLoad.tbPreview.blockReason ?? 'Unified P&L blocked by kill switch.');
  }

  let comparison;
  if (params.compareStartDate && params.compareEndDate) {
    const compareLoad = await loadProfitLossUnifiedPreview({
      companyId: params.companyId,
      startDate: params.compareStartDate,
      endDate: params.compareEndDate,
      branchId: params.branchId,
      basis,
    });
    if (!compareLoad.tbPreview.blockedByKillSwitch) {
      comparison = mapUnifiedTrialBalanceToProfitLossComparison({
        rows: compareLoad.tbPreview.rows,
        startDate: params.compareStartDate,
        endDate: params.compareEndDate,
      });
    }
  }

  return mapUnifiedTrialBalanceToProfitLossMain({
    rows: previewLoad.tbPreview.rows,
    startDate: params.startDate,
    endDate: params.endDate,
    comparison,
  });
}

export function balanceSheetResultToPreviewShape(
  result: BalanceSheetResult,
): import('@/app/lib/accounting/balanceSheetUnifiedPreviewMapper').BalanceSheetUnifiedPreviewResult {
  const netIncome =
    result.equity.items.find((i) => (i.name || '').toLowerCase().includes('net income'))?.amount ?? 0;
  return {
    previewOnly: true,
    needsFinanceGoldenApproval: true,
    asOfDate: result.asOfDate,
    totalAssets: result.totalAssets,
    totalLiabilities: result.liabilities.total,
    totalEquity: result.equity.total,
    totalLiabilitiesAndEquity: result.totalLiabilitiesAndEquity,
    difference: result.difference,
    tbImbalance: result.tbImbalance,
    netIncome,
    assetLineCount: result.assets.items.length,
    liabilityLineCount: result.liabilities.items.length,
    equityLineCount: result.equity.items.length,
    accountingRuleNotes: ['Unified main loader active.'],
  };
}

export function profitLossResultToPreviewShape(
  result: ProfitLossResult,
): import('@/app/lib/accounting/profitLossUnifiedPreviewMapper').ProfitLossUnifiedPreviewResult {
  return {
    previewOnly: true,
    needsFinanceGoldenApproval: true,
    startDate: result.startDate,
    endDate: result.endDate,
    totalRevenue: result.revenue.total,
    totalCostOfSales: result.costOfSales.total,
    grossProfit: result.grossProfit,
    totalExpenses: result.expenses.total,
    netProfit: result.netProfit,
    revenueLineCount: result.revenue.items.length,
    costLineCount: result.costOfSales.items.length,
    expenseLineCount: result.expenses.items.length,
    accountingRuleNotes: ['Unified main loader active.'],
  };
}
