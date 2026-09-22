/**
 * Phase 3D — P&L unified engine main loader mapper.
 * Mirrors accountingReportsService.getProfitLoss using unified TB rows.
 */

import {
  accountTypeCategory,
  isCostOfProductionAccount,
} from '@/app/lib/accounting/bsPlUnifiedPreviewAccountTypes';
import type {
  ProfitLossComparison,
  ProfitLossResult,
  TrialBalanceRow,
} from '@/app/services/accountingReportsService';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapProfitLossFromRows(args: {
  rows: TrialBalanceRow[];
  startDate: string;
  endDate: string;
}): Omit<ProfitLossResult, 'comparison'> {
  const revenueItems: { name: string; amount: number; code?: string }[] = [];
  const costItems: { name: string; amount: number; code?: string }[] = [];
  const expenseItems: { name: string; amount: number; code?: string }[] = [];

  let totalRevenue = 0;
  let totalCost = 0;
  let totalExpenses = 0;

  args.rows.forEach((r) => {
    const cat = accountTypeCategory(r.account_type);
    const revenueAmount = cat === 'revenue' ? r.credit - r.debit : 0;
    const expenseAmount = cat === 'expense' ? r.debit - r.credit : 0;
    if (cat === 'revenue' && revenueAmount !== 0) {
      totalRevenue += revenueAmount;
      revenueItems.push({ name: r.account_name, amount: revenueAmount, code: r.account_code });
    } else if (cat === 'expense' && expenseAmount > 0) {
      if (isCostOfProductionAccount(r.account_code, r.account_type)) {
        totalCost += expenseAmount;
        costItems.push({ name: r.account_name, amount: expenseAmount, code: r.account_code });
      } else {
        totalExpenses += expenseAmount;
        expenseItems.push({ name: r.account_name, amount: expenseAmount, code: r.account_code });
      }
    }
  });

  const grossProfit = round2(totalRevenue - totalCost);
  const netProfit = round2(grossProfit - totalExpenses);

  return {
    revenue: { label: 'Revenue', items: revenueItems, total: round2(totalRevenue) },
    costOfSales: { label: 'Cost of Sales', items: costItems, total: round2(totalCost) },
    grossProfit,
    expenses: { label: 'Expenses', items: expenseItems, total: round2(totalExpenses) },
    netProfit,
    startDate: args.startDate.slice(0, 10),
    endDate: args.endDate.slice(0, 10),
  };
}

export function mapUnifiedTrialBalanceToProfitLossMain(args: {
  rows: TrialBalanceRow[];
  startDate: string;
  endDate: string;
  comparison?: ProfitLossComparison;
}): ProfitLossResult {
  const base = mapProfitLossFromRows(args);
  return {
    ...base,
    comparison: args.comparison,
  };
}

export function mapUnifiedTrialBalanceToProfitLossComparison(args: {
  rows: TrialBalanceRow[];
  startDate: string;
  endDate: string;
}): ProfitLossComparison {
  let compRevenue = 0;
  let compCost = 0;
  let compExpenses = 0;
  args.rows.forEach((r) => {
    const cat = accountTypeCategory(r.account_type);
    const revenueAmount = cat === 'revenue' ? r.credit - r.debit : 0;
    const expenseAmount = cat === 'expense' ? r.debit - r.credit : 0;
    if (cat === 'revenue') compRevenue += revenueAmount;
    else if (cat === 'expense' && expenseAmount > 0) {
      if (isCostOfProductionAccount(r.account_code, r.account_type)) compCost += expenseAmount;
      else compExpenses += expenseAmount;
    }
  });
  return {
    startDate: args.startDate.slice(0, 10),
    endDate: args.endDate.slice(0, 10),
    revenue: round2(compRevenue),
    costOfSales: round2(compCost),
    grossProfit: round2(compRevenue - compCost),
    expenses: round2(compExpenses),
    netProfit: round2(compRevenue - compCost - compExpenses),
  };
}
