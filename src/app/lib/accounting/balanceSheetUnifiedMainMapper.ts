/**
 * Phase 3D — Balance Sheet unified engine main loader mapper.
 * Mirrors accountingReportsService.getBalanceSheet using unified TB rows.
 */

import { COA_HEADER_CODES } from '@/app/data/defaultCoASeed';
import {
  buildAccountMapById,
  classifyBalanceSheetAsset,
  classifyBalanceSheetLiability,
} from '@/app/lib/accountHierarchy';
import type { BsPlAccountMeta } from '@/app/lib/accounting/balanceSheetUnifiedPreviewMapper';
import type {
  BalanceSheetLineItem,
  BalanceSheetResult,
  TrialBalanceResult,
} from '@/app/services/accountingReportsService';

function accountTypeCategory(type: string): 'revenue' | 'expense' | 'asset' | 'liability' | 'equity' {
  const t = (type || '').toLowerCase();
  if (['revenue', 'income'].some((x) => t.includes(x))) return 'revenue';
  if (['expense', 'cost of sales', 'cogs'].some((x) => t.includes(x))) return 'expense';
  if (['asset', 'cash', 'bank', 'mobile_wallet', 'receivable', 'inventory'].some((x) => t.includes(x))) {
    return 'asset';
  }
  if (['liability', 'payable'].some((x) => t.includes(x))) return 'liability';
  if (['equity'].some((x) => t.includes(x))) return 'equity';
  return 'expense';
}

export function mapUnifiedTrialBalanceToBalanceSheetMain(args: {
  tb: Pick<TrialBalanceResult, 'rows' | 'totalDebit' | 'totalCredit'>;
  accounts: BsPlAccountMeta[];
  asOfDate: string;
}): BalanceSheetResult {
  const { tb, accounts, asOfDate } = args;
  const balanceByAccountId = new Map<string, number>();
  tb.rows.forEach((r) => balanceByAccountId.set(r.account_id, r.balance));

  const hierarchyRows = accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    parent_id: a.parent_id,
  }));
  const accountMapForBs = buildAccountMapById(hierarchyRows);

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
    const ids = [arControl.id, ...arChildIds];
    return ids.reduce((s, id) => s + (balanceByAccountId.get(id) ?? 0), 0);
  };
  const rolledApBalance = (): number => {
    if (!apControl?.id) return 0;
    const ids = [apControl.id, ...apChildIds];
    return ids.reduce((s, id) => s + (balanceByAccountId.get(id) ?? 0), 0);
  };

  const assetItems: BalanceSheetLineItem[] = [];
  const liabilityItems: BalanceSheetLineItem[] = [];
  const equityItems: BalanceSheetLineItem[] = [];

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let revenueExpenseBalanceSum = 0;

  accounts.forEach((a) => {
    const codeTrim = String(a.code || '').trim();
    if (COA_HEADER_CODES.has(codeTrim)) return;
    if (a.is_group === true) return;
    if (arChildIds.has(a.id) || apChildIds.has(a.id)) return;

    const cat = accountTypeCategory(a.type || '');
    let amount = balanceByAccountId.get(a.id) ?? 0;
    if (arControl && a.id === arControl.id) amount = rolledArBalance();
    else if (apControl && a.id === apControl.id) amount = rolledApBalance();

    if (cat === 'asset') {
      const displayAmount = amount + 0;
      totalAssets += displayAmount;
      assetItems.push({
        name: a.name || '',
        amount: displayAmount,
        code: a.code || '',
        bs_asset_group: classifyBalanceSheetAsset(
          { code: a.code, name: a.name, type: a.type, parent_id: a.parent_id },
          accountMapForBs,
        ),
        drilldownControl: codeTrim === '1100' ? 'ar' : undefined,
      });
    } else if (cat === 'liability') {
      const displayAmount = -amount + 0;
      totalLiabilities += displayAmount;
      liabilityItems.push({
        name: a.name || '',
        amount: displayAmount,
        code: a.code || '',
        bs_liability_group: classifyBalanceSheetLiability(
          { code: a.code, name: a.name, type: a.type, parent_id: a.parent_id },
          accountMapForBs,
        ),
        drilldownControl: codeTrim === '2000' ? 'ap' : undefined,
      });
    } else if (cat === 'equity') {
      const displayAmount = -amount + 0;
      totalEquity += displayAmount;
      equityItems.push({ name: a.name || '', amount: displayAmount, code: a.code || '' });
    } else if (cat === 'revenue' || cat === 'expense') {
      revenueExpenseBalanceSum += amount;
    }
  });

  assetItems.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  liabilityItems.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  equityItems.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  const processedInMainLoop = new Set<string>();
  accounts.forEach((a) => {
    const codeTrim = String(a.code || '').trim();
    if (COA_HEADER_CODES.has(codeTrim)) return;
    if (a.is_group === true) return;
    if (arChildIds.has(a.id) || apChildIds.has(a.id)) return;
    processedInMainLoop.add(a.id);
  });

  tb.rows.forEach((r) => {
    if (processedInMainLoop.has(r.account_id)) return;
    if (arChildIds.has(r.account_id) || apChildIds.has(r.account_id)) return;
    if (!r.balance) return;
    const a = accountMapForBs.get(r.account_id);
    if (!a) return;
    const cat = accountTypeCategory(String((a as { type?: string }).type || ''));
    if (cat === 'asset') totalAssets += r.balance;
    else if (cat === 'liability') totalLiabilities += -r.balance;
    else if (cat === 'equity') totalEquity += -r.balance;
    else revenueExpenseBalanceSum += r.balance;
  });

  const netIncome = Math.round(-revenueExpenseBalanceSum * 100) / 100;
  if (netIncome !== 0) {
    totalEquity += netIncome;
    equityItems.push({ name: 'Net Income (to date)', amount: netIncome, code: '' });
  }

  const tbImbalance = Math.round((tb.totalDebit - tb.totalCredit) * 100) / 100;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const difference = Math.round((totalAssets - totalLiabilitiesAndEquity) * 100) / 100;

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
