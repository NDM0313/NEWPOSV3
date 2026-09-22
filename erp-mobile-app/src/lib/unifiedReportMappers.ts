import { accountTypeCategory, isCostOfProductionAccount } from './bsPlAccountTypes';
import type {
  BalanceSheetLineItem,
  BalanceSheetResult,
  ProfitLossResult,
  TrialBalanceResult,
  TrialBalanceRow,
} from '../types/unifiedReports';

const COA_HEADER_CODES = new Set(['1050', '1060', '1070', '1080', '1090', '2090', '3090', '4050', '6090']);

export type BsPlAccountMeta = {
  id: string;
  code: string;
  name: string;
  type: string;
  parent_id?: string | null;
  is_group?: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function mapUnifiedAccountsToTrialBalanceRows(
  accounts: Array<{
    accountId: string;
    accountCode: string | null;
    accountName: string | null;
    accountType: string | null;
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
  }>,
): TrialBalanceRow[] {
  return accounts.map((acc) => ({
    account_id: acc.accountId,
    account_code: acc.accountCode || '',
    account_name: acc.accountName || '',
    account_type: acc.accountType || '',
    debit: acc.totalDebit,
    credit: acc.totalCredit,
    balance: acc.netBalance,
  }));
}

export function mapUnifiedTrialBalanceToBalanceSheetMain(args: {
  tb: Pick<TrialBalanceResult, 'rows' | 'totalDebit' | 'totalCredit'>;
  accounts: BsPlAccountMeta[];
  asOfDate: string;
}): BalanceSheetResult {
  const { tb, accounts, asOfDate } = args;
  const balanceByAccountId = new Map<string, number>();
  tb.rows.forEach((r) => balanceByAccountId.set(r.account_id, r.balance));

  const arControl = accounts.find((x) => String(x.code || '').trim() === '1100');
  const apControl = accounts.find((x) => String(x.code || '').trim() === '2000');
  const arChildIds = new Set(
    accounts.filter((x) => x.parent_id && arControl && x.parent_id === arControl.id).map((x) => x.id),
  );
  const apChildIds = new Set(
    accounts.filter((x) => x.parent_id && apControl && x.parent_id === apControl.id).map((x) => x.id),
  );

  const rolledArBalance = (): number => {
    if (!arControl?.id) return 0;
    return [arControl.id, ...arChildIds].reduce((s, id) => s + (balanceByAccountId.get(id) ?? 0), 0);
  };
  const rolledApBalance = (): number => {
    if (!apControl?.id) return 0;
    return [apControl.id, ...apChildIds].reduce((s, id) => s + (balanceByAccountId.get(id) ?? 0), 0);
  };

  const assetItems: BalanceSheetLineItem[] = [];
  const liabilityItems: BalanceSheetLineItem[] = [];
  const equityItems: BalanceSheetLineItem[] = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let revenueExpenseBalanceSum = 0;
  const processedInMainLoop = new Set<string>();

  accounts.forEach((a) => {
    const codeTrim = String(a.code || '').trim();
    if (COA_HEADER_CODES.has(codeTrim)) return;
    if (a.is_group === true) return;
    if (arChildIds.has(a.id) || apChildIds.has(a.id)) return;
    processedInMainLoop.add(a.id);

    const cat = accountTypeCategory(a.type || '');
    let amount = balanceByAccountId.get(a.id) ?? 0;
    if (arControl && a.id === arControl.id) amount = rolledArBalance();
    else if (apControl && a.id === apControl.id) amount = rolledApBalance();

    if (cat === 'asset') {
      totalAssets += amount;
      assetItems.push({ name: a.name || '', amount, code: a.code || '' });
    } else if (cat === 'liability') {
      const displayAmount = -amount;
      totalLiabilities += displayAmount;
      liabilityItems.push({ name: a.name || '', amount: displayAmount, code: a.code || '' });
    } else if (cat === 'equity') {
      const displayAmount = -amount;
      totalEquity += displayAmount;
      equityItems.push({ name: a.name || '', amount: displayAmount, code: a.code || '' });
    } else if (cat === 'revenue' || cat === 'expense') {
      revenueExpenseBalanceSum += amount;
    }
  });

  assetItems.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  liabilityItems.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  equityItems.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  tb.rows.forEach((r) => {
    if (processedInMainLoop.has(r.account_id)) return;
    if (arChildIds.has(r.account_id) || apChildIds.has(r.account_id)) return;
    if (!r.balance) return;
    const cat = accountTypeCategory(r.account_type || '');
    if (cat === 'asset') totalAssets += r.balance;
    else if (cat === 'liability') totalLiabilities += -r.balance;
    else if (cat === 'equity') totalEquity += -r.balance;
    else revenueExpenseBalanceSum += r.balance;
  });

  const netIncome = round2(-revenueExpenseBalanceSum);
  if (netIncome !== 0) {
    totalEquity += netIncome;
    equityItems.push({ name: 'Net Income (to date)', amount: netIncome, code: '' });
  }

  const tbImbalance = round2(tb.totalDebit - tb.totalCredit);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const difference = round2(totalAssets - totalLiabilitiesAndEquity);

  return {
    assets: { label: 'Assets', items: assetItems, total: totalAssets },
    liabilities: { label: 'Liabilities', items: liabilityItems, total: totalLiabilities },
    equity: { label: 'Owner Equity', items: equityItems, total: totalEquity },
    totalAssets,
    totalLiabilitiesAndEquity,
    difference,
    tbImbalance,
    asOfDate: asOfDate.slice(0, 10),
  };
}

export function mapUnifiedTrialBalanceToProfitLossMain(args: {
  rows: TrialBalanceRow[];
  startDate: string;
  endDate: string;
}): ProfitLossResult {
  const revenueItems: BalanceSheetLineItem[] = [];
  const costItems: BalanceSheetLineItem[] = [];
  const expenseItems: BalanceSheetLineItem[] = [];
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
