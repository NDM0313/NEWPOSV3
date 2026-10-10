/**
 * Phase 3A — pure diff helpers for BS / P&L unified preview compare.
 */

import type { BalanceSheetResult, ProfitLossResult } from '@/app/services/accountingReportsService';
import { balancePasses, round2 } from '@/app/lib/unifiedLedgerCompareDiff';
import type { BalanceSheetUnifiedPreviewResult } from '@/app/lib/accounting/balanceSheetUnifiedPreviewMapper';
import type { ProfitLossUnifiedPreviewResult } from '@/app/lib/accounting/profitLossUnifiedPreviewMapper';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';

export const DEFAULT_BS_PL_PREVIEW_BASIS: UnifiedLedgerBasis = 'official_gl';

export type BalanceSheetUnifiedPreviewDiff = {
  legacyTotalAssets: number;
  previewTotalAssets: number;
  assetsDelta: number;
  legacyTotalLiabilities: number;
  previewTotalLiabilities: number;
  liabilitiesDelta: number;
  legacyTotalEquity: number;
  previewTotalEquity: number;
  equityDelta: number;
  legacyLiabilitiesAndEquity: number;
  previewLiabilitiesAndEquity: number;
  liabilitiesAndEquityDelta: number;
  legacyDifference: number;
  previewDifference: number;
  differenceDelta: number;
  legacyTbImbalance: number;
  previewTbImbalance: number;
  pass: boolean;
  previewOnly: true;
  needsFinanceGoldenApproval: true;
};

export type ProfitLossUnifiedPreviewDiff = {
  legacyRevenue: number;
  previewRevenue: number;
  revenueDelta: number;
  legacyCostOfSales: number;
  previewCostOfSales: number;
  costDelta: number;
  legacyGrossProfit: number;
  previewGrossProfit: number;
  grossProfitDelta: number;
  legacyExpenses: number;
  previewExpenses: number;
  expensesDelta: number;
  legacyNetProfit: number;
  previewNetProfit: number;
  netProfitDelta: number;
  pass: boolean;
  previewOnly: true;
  needsFinanceGoldenApproval: true;
};

export function compareBalanceSheetUnifiedPreview(args: {
  legacy: BalanceSheetResult;
  preview: BalanceSheetUnifiedPreviewResult;
}): BalanceSheetUnifiedPreviewDiff {
  const legacyTotalLiabilities = args.legacy.liabilities.total;
  const legacyTotalEquity = args.legacy.equity.total;

  const assetsDelta = round2(args.legacy.totalAssets - args.preview.totalAssets);
  const liabilitiesDelta = round2(legacyTotalLiabilities - args.preview.totalLiabilities);
  const equityDelta = round2(legacyTotalEquity - args.preview.totalEquity);
  const liabilitiesAndEquityDelta = round2(
    args.legacy.totalLiabilitiesAndEquity - args.preview.totalLiabilitiesAndEquity
  );
  const differenceDelta = round2(args.legacy.difference - args.preview.difference);

  const pass =
    balancePasses(assetsDelta) &&
    balancePasses(liabilitiesDelta) &&
    balancePasses(equityDelta) &&
    balancePasses(liabilitiesAndEquityDelta) &&
    balancePasses(differenceDelta);

  return {
    legacyTotalAssets: args.legacy.totalAssets,
    previewTotalAssets: args.preview.totalAssets,
    assetsDelta,
    legacyTotalLiabilities,
    previewTotalLiabilities: args.preview.totalLiabilities,
    liabilitiesDelta,
    legacyTotalEquity,
    previewTotalEquity: args.preview.totalEquity,
    equityDelta,
    legacyLiabilitiesAndEquity: args.legacy.totalLiabilitiesAndEquity,
    previewLiabilitiesAndEquity: args.preview.totalLiabilitiesAndEquity,
    liabilitiesAndEquityDelta,
    legacyDifference: args.legacy.difference,
    previewDifference: args.preview.difference,
    differenceDelta,
    legacyTbImbalance: args.legacy.tbImbalance,
    previewTbImbalance: args.preview.tbImbalance,
    pass,
    previewOnly: true,
    needsFinanceGoldenApproval: true,
  };
}

export function compareProfitLossUnifiedPreview(args: {
  legacy: ProfitLossResult;
  preview: ProfitLossUnifiedPreviewResult;
}): ProfitLossUnifiedPreviewDiff {
  const revenueDelta = round2(args.legacy.revenue.total - args.preview.totalRevenue);
  const costDelta = round2(args.legacy.costOfSales.total - args.preview.totalCostOfSales);
  const grossProfitDelta = round2(args.legacy.grossProfit - args.preview.grossProfit);
  const expensesDelta = round2(args.legacy.expenses.total - args.preview.totalExpenses);
  const netProfitDelta = round2(args.legacy.netProfit - args.preview.netProfit);

  const pass =
    balancePasses(revenueDelta) &&
    balancePasses(costDelta) &&
    balancePasses(grossProfitDelta) &&
    balancePasses(expensesDelta) &&
    balancePasses(netProfitDelta);

  return {
    legacyRevenue: args.legacy.revenue.total,
    previewRevenue: args.preview.totalRevenue,
    revenueDelta,
    legacyCostOfSales: args.legacy.costOfSales.total,
    previewCostOfSales: args.preview.totalCostOfSales,
    costDelta,
    legacyGrossProfit: args.legacy.grossProfit,
    previewGrossProfit: args.preview.grossProfit,
    grossProfitDelta,
    legacyExpenses: args.legacy.expenses.total,
    previewExpenses: args.preview.totalExpenses,
    expensesDelta,
    legacyNetProfit: args.legacy.netProfit,
    previewNetProfit: args.preview.netProfit,
    netProfitDelta,
    pass,
    previewOnly: true,
    needsFinanceGoldenApproval: true,
  };
}
