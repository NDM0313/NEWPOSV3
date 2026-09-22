import { num, roundMoney } from './dinChinaFinancialAuditShared.js';

export function buildBalanceSheetAnalysis(ctx, taskResults) {
  const { accounts } = ctx;
  const { revenue: taskA, cogs: taskB, purchase: taskC, ar: taskD } = taskResults;

  const accountSnapshots = {
    ar1100: snapshot(accounts.ar.account),
    inventory1200: snapshot(accounts.inventory.account),
    ap2100: snapshot(accounts.ap.account),
    revenue4100: snapshot(accounts.revenue.account),
    cogs5010: snapshot(accounts.cogs.account),
    discount5200: snapshot(accounts.discount.account),
  };

  const sections = [
    {
      topic: 'Inventory vs COGS',
      explanation: [
        `Expected COGS from cost_price × qty: Rs ${taskB?.expectedCogsTotal ?? 0}`,
        `Actual COGS posted (5010): Rs ${taskB?.actualCogsPosted ?? 0}`,
        `Inventory credit on sale JEs: Rs ${taskB?.actualInventoryCreditFromSales ?? 0}`,
        taskB?.balanceSheetInventoryOverstated
          ? 'Inventory may be overstated until Phase 2 COGS relief is posted.'
          : 'COGS/inventory relief appears aligned with expected costs.',
      ],
    },
    {
      topic: 'AR vs customer dues',
      explanation: [
        `Sum of sale due_amount: Rs ${taskD?.expectedArOutstanding ?? 0}`,
        `GL AR (1100) balance: Rs ${taskD?.glAccountsReceivableBalance ?? 0}`,
        `Gap: Rs ${taskD?.arExpectedVsActualGap ?? 0}`,
        'Phase 6 sell returns (~Rs 1.06M) may explain part of any residual AR gap.',
      ],
    },
    {
      topic: 'Purchase / AP',
      explanation: [
        `ERP purchase total: Rs ${taskC?.erpPurchaseTotal ?? 0}`,
        `Updated CSV target: Rs ${taskC?.updatedCsvTotal ?? 0}`,
        `Mismatch: Rs ${taskC?.mismatchAmount ?? 0} (Phase 3 requires approval)`,
      ],
    },
    {
      topic: 'Revenue tie-out',
      explanation: [
        `Operational sales total: Rs ${taskA?.operationalSalesTotal ?? 0}`,
        `GL 4100 on sale document JEs: Rs ${taskA?.glRevenueFromSaleDocumentJes ?? 0}`,
        `Missing revenue JEs: ${taskA?.missingRevenueJeCount ?? 0}`,
      ],
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    accountSnapshots,
    sections,
  };
}

function snapshot(account) {
  if (!account) return null;
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    balance: roundMoney(num(account.balance)),
  };
}
