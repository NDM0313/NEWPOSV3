/**
 * Phase 3A — derive P&L preview totals from unified Trial Balance rows.
 * PREVIEW_ONLY — mirrors legacy getProfitLoss COGS heuristic; NEEDS_RULE_CONFIRMATION.
 */

import type { TrialBalanceRow } from '@/app/services/accountingReportsService';
import {
  accountTypeCategory,
  isCostOfProductionAccount,
} from '@/app/lib/accounting/bsPlUnifiedPreviewAccountTypes';

export type ProfitLossUnifiedPreviewResult = {
  previewOnly: true;
  needsFinanceGoldenApproval: true;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalCostOfSales: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  revenueLineCount: number;
  costLineCount: number;
  expenseLineCount: number;
  accountingRuleNotes: string[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function mapTrialBalanceRowsToProfitLossPreview(args: {
  rows: TrialBalanceRow[];
  startDate: string;
  endDate: string;
}): ProfitLossUnifiedPreviewResult {
  const accountingRuleNotes: string[] = [
    'PREVIEW_ONLY — not finance-approved golden totals.',
    'COGS split uses COST_OF_PRODUCTION_CODES + type heuristics (mirrors legacy).',
    'NEEDS_RULE_CONFIRMATION — finance must approve COGS mapping before loader swap.',
  ];

  let totalRevenue = 0;
  let totalCost = 0;
  let totalExpenses = 0;
  let revenueLineCount = 0;
  let costLineCount = 0;
  let expenseLineCount = 0;

  args.rows.forEach((r) => {
    const cat = accountTypeCategory(r.account_type);
    const revenueAmount = cat === 'revenue' ? r.credit - r.debit : 0;
    const expenseAmount = cat === 'expense' ? r.debit - r.credit : 0;

    if (cat === 'revenue' && revenueAmount !== 0) {
      totalRevenue += revenueAmount;
      revenueLineCount += 1;
    } else if (cat === 'expense' && expenseAmount > 0) {
      if (isCostOfProductionAccount(r.account_code, r.account_type)) {
        totalCost += expenseAmount;
        costLineCount += 1;
      } else {
        totalExpenses += expenseAmount;
        expenseLineCount += 1;
      }
    }
  });

  const grossProfit = round2(totalRevenue - totalCost);
  const netProfit = round2(grossProfit - totalExpenses);

  return {
    previewOnly: true,
    needsFinanceGoldenApproval: true,
    startDate: args.startDate.slice(0, 10),
    endDate: args.endDate.slice(0, 10),
    totalRevenue: round2(totalRevenue),
    totalCostOfSales: round2(totalCost),
    grossProfit,
    totalExpenses: round2(totalExpenses),
    netProfit,
    revenueLineCount,
    costLineCount,
    expenseLineCount,
    accountingRuleNotes,
  };
}
