import type { BalanceSheetLineItem } from '../types/unifiedReports';

export type GroupedBalanceSheetItems = {
  groupLabel: string;
  items: BalanceSheetLineItem[];
  subtotal: number;
};

function sumItems(items: BalanceSheetLineItem[]): number {
  return items.reduce((s, i) => s + i.amount, 0);
}

export function groupMobileBalanceSheetAssets(items: BalanceSheetLineItem[]): GroupedBalanceSheetItems[] {
  const groups: Record<string, { label: string; items: BalanceSheetLineItem[] }> = {
    cash_bank: { label: 'Cash & Cash Equivalents', items: [] },
    inventory: { label: 'Inventory', items: [] },
    receivables: { label: 'Receivables', items: [] },
    advances: { label: 'Advances & prepayments', items: [] },
    other: { label: 'Other Assets', items: [] },
  };

  items.forEach((i) => {
    const n = (i.name || '').toLowerCase();
    const c = (i.code || '').toLowerCase();
    if (
      n.includes('cash') ||
      n.includes('bank') ||
      n.includes('wallet') ||
      n.includes('mcb') ||
      n.includes('habib') ||
      c.includes('1000') ||
      c.includes('1010') ||
      c.includes('1020')
    ) {
      groups.cash_bank.items.push(i);
    } else if (n.includes('inventory') || n.includes('stock') || c.includes('1200') || c.includes('1300')) {
      groups.inventory.items.push(i);
    } else if (n.includes('receivable') || n.includes('receivables') || c.includes('1100')) {
      groups.receivables.items.push(i);
    } else if (n.includes('advance') && (n.includes('worker') || n.includes('employee'))) {
      groups.advances.items.push(i);
    } else {
      groups.other.items.push(i);
    }
  });

  return Object.values(groups)
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      groupLabel: g.label,
      items: g.items,
      subtotal: sumItems(g.items),
    }));
}

export function groupMobileBalanceSheetLiabilities(items: BalanceSheetLineItem[]): GroupedBalanceSheetItems[] {
  const groups: Record<string, { label: string; items: BalanceSheetLineItem[] }> = {
    trade_payables: { label: 'Trade & other payables', items: [] },
    payroll_related: { label: 'Payroll & worker', items: [] },
    deposits_and_advances: { label: 'Deposits & advances held', items: [] },
    courier: { label: 'Courier payables', items: [] },
    other: { label: 'Other liabilities', items: [] },
  };

  items.forEach((i) => {
    const n = (i.name || '').toLowerCase();
    if (n.includes('courier')) {
      groups.courier.items.push(i);
    } else if (n.includes('worker') && n.includes('payable')) {
      groups.payroll_related.items.push(i);
    } else if (n.includes('deposit') || n.includes('rental advance')) {
      groups.deposits_and_advances.items.push(i);
    } else if (n.includes('payable') || n.includes('payables')) {
      groups.trade_payables.items.push(i);
    } else {
      groups.other.items.push(i);
    }
  });

  return Object.values(groups)
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      groupLabel: g.label,
      items: g.items,
      subtotal: sumItems(g.items),
    }));
}
