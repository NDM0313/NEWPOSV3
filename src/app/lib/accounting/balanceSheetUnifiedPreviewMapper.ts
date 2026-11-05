/**
 * Phase 3A — derive Balance Sheet preview totals from unified Trial Balance rows.
 * PREVIEW_ONLY — does not replace accountingReportsService.getBalanceSheet.
 */

import { COA_HEADER_CODES } from '@/app/data/defaultCoASeed';
import { buildAccountMapById } from '@/app/lib/accountHierarchy';
import type { TrialBalanceResult, TrialBalanceRow } from '@/app/services/accountingReportsService';
import { accountTypeCategory } from '@/app/lib/accounting/bsPlUnifiedPreviewAccountTypes';

export type BsPlAccountMeta = {
  id: string;
  code?: string;
  name?: string;
  type?: string;
  parent_id?: string | null;
  is_group?: boolean;
};

export type BalanceSheetUnifiedPreviewResult = {
  previewOnly: true;
  needsFinanceGoldenApproval: true;
  asOfDate: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  difference: number;
  tbImbalance: number;
  netIncome: number;
  assetLineCount: number;
  liabilityLineCount: number;
  equityLineCount: number;
  accountingRuleNotes: string[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Mirrors legacy getBalanceSheet TB→BS mapping (AR/AP rollup, absorption, net income).
 * Retained earnings roll-forward: NEEDS_ACCOUNTING_RULE_CONFIRMATION if preview ≠ legacy.
 */
export function mapTrialBalanceToBalanceSheetPreview(args: {
  tb: Pick<TrialBalanceResult, 'rows' | 'totalDebit' | 'totalCredit'>;
  accounts: BsPlAccountMeta[];
  asOfDate: string;
}): BalanceSheetUnifiedPreviewResult {
  const { tb, accounts, asOfDate } = args;
  const accountingRuleNotes: string[] = [
    'PREVIEW_ONLY — not finance-approved golden totals.',
    'Net income folded into equity per legacy BS-FIX / PF-04 rules.',
    'NEEDS_ACCOUNTING_RULE_CONFIRMATION — compare with finance before loader swap.',
  ];

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
    accounts.filter((x) => x.parent_id && arControl && x.parent_id === arControl.id).map((x) => x.id)
  );
  const apChildIds = new Set(
    accounts.filter((x) => x.parent_id && apControl && x.parent_id === apControl.id).map((x) => x.id)
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

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let revenueExpenseBalanceSum = 0;
  let assetLineCount = 0;
  let liabilityLineCount = 0;
  let equityLineCount = 0;

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
      assetLineCount += 1;
    } else if (cat === 'liability') {
      const displayAmount = -amount + 0;
      totalLiabilities += displayAmount;
      liabilityLineCount += 1;
    } else if (cat === 'equity') {
      const displayAmount = -amount + 0;
      totalEquity += displayAmount;
      equityLineCount += 1;
    } else if (cat === 'revenue' || cat === 'expense') {
      revenueExpenseBalanceSum += amount;
    }
  });

  const processedInMainLoop = new Set<string>();
  accounts.forEach((a) => {
    const codeTrim = String(a.code || '').trim();
    if (COA_HEADER_CODES.has(codeTrim)) return;
    if (a.is_group === true) return;
    if (arChildIds.has(a.id) || apChildIds.has(a.id)) return;
    processedInMainLoop.add(a.id);
  });

  tb.rows.forEach((r: TrialBalanceRow) => {
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

  const netIncome = round2(-revenueExpenseBalanceSum);
  if (netIncome !== 0) {
    totalEquity += netIncome;
    equityLineCount += 1;
  }

  const tbImbalance = round2(tb.totalDebit - tb.totalCredit);
  const totalLiabilitiesAndEquity = round2(totalLiabilities + totalEquity);
  const totalAssetsRounded = round2(totalAssets);
  const difference = round2(totalAssetsRounded - totalLiabilitiesAndEquity);

  return {
    previewOnly: true,
    needsFinanceGoldenApproval: true,
    asOfDate: asOfDate.slice(0, 10),
    totalAssets: totalAssetsRounded,
    totalLiabilities: round2(totalLiabilities),
    totalEquity: round2(totalEquity),
    totalLiabilitiesAndEquity,
    difference,
    tbImbalance,
    netIncome,
    assetLineCount,
    liabilityLineCount,
    equityLineCount,
    accountingRuleNotes,
  };
}
