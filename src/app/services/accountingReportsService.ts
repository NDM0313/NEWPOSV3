/**
 * Accounting Reports Service
 * Trial Balance, P&L, Balance Sheet, Account Ledger, Sales Profit, Inventory Valuation
 */

import { supabase } from '@/lib/supabase';

export interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
  balance: number; // debit positive, credit negative for display
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
}

export interface ProfitLossSection {
  label: string;
  items: { name: string; amount: number; code?: string }[];
  total: number;
}

export interface ProfitLossResult {
  revenue: ProfitLossSection;
  costOfSales: ProfitLossSection;
  grossProfit: number;
  expenses: ProfitLossSection;
  netProfit: number;
  startDate: string;
  endDate: string;
}

export interface BalanceSheetSection {
  label: string;
  items: { name: string; amount: number; code?: string }[];
  total: number;
}

export interface BalanceSheetResult {
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  difference: number;
  asOfDate: string;
}

export interface SalesProfitRow {
  sale_id: string;
  invoice_no: string;
  sale_date: string;
  customer_name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number;
}

export interface SalesProfitResult {
  rows: SalesProfitRow[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  startDate: string;
  endDate: string;
}

export interface InventoryValuationRow {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
}

export interface InventoryValuationResult {
  rows: InventoryValuationRow[];
  totalValue: number;
  asOfDate: string;
}

// Normalize account type for grouping (DB may use asset, liability, revenue, expense, equity)
const REVENUE_TYPES = ['revenue', 'income'];
const EXPENSE_TYPES = ['expense', 'cost of sales', 'cogs'];
const ASSET_TYPES = ['asset', 'cash', 'bank', 'mobile_wallet'];
const LIABILITY_TYPES = ['liability'];
const EQUITY_TYPES = ['equity'];

function accountTypeCategory(type: string): 'revenue' | 'expense' | 'asset' | 'liability' | 'equity' {
  const t = (type || '').toLowerCase();
  if (REVENUE_TYPES.some((x) => t.includes(x))) return 'revenue';
  if (EXPENSE_TYPES.some((x) => t.includes(x))) return 'expense';
  if (ASSET_TYPES.some((x) => t.includes(x))) return 'asset';
  if (LIABILITY_TYPES.some((x) => t.includes(x))) return 'liability';
  if (EQUITY_TYPES.some((x) => t.includes(x))) return 'equity';
  return 'expense';
}

export const accountingReportsService = {
  /**
   * Trial Balance: SUM(debit), SUM(credit) per account for date range.
   * Join journal_entry_lines -> journal_entries (filter by company, date), join accounts.
   */
  async getTrialBalance(
    companyId: string,
    startDate: string,
    endDate: string,
    branchId?: string
  ): Promise<TrialBalanceResult> {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name, type')
      .eq('company_id', companyId)
      .eq('is_active', true);
    if (!accounts?.length) {
      return { rows: [], totalDebit: 0, totalCredit: 0, difference: 0 };
    }
    const accountIds = accounts.map((a: any) => a.id);
    const accountMap = new Map(accounts.map((a: any) => [a.id, a]));

    let query = supabase
      .from('journal_entry_lines')
      .select(`
        account_id,
        debit,
        credit,
        journal_entry:journal_entries(entry_date, company_id, branch_id)
      `)
      .in('account_id', accountIds);

    const { data: lines, error } = await query;
    if (error || !lines?.length) {
      const rows: TrialBalanceRow[] = accounts.map((a: any) => ({
        account_id: a.id,
        account_code: a.code || '',
        account_name: a.name || '',
        account_type: a.type || '',
        debit: 0,
        credit: 0,
        balance: 0,
      }));
      return { rows, totalDebit: 0, totalCredit: 0, difference: 0 };
    }

    const start = startDate.slice(0, 10);
    const end = endDate.slice(0, 10);
    const byAccount: Record<string, { debit: number; credit: number }> = {};
    accountIds.forEach((id: string) => {
      byAccount[id] = { debit: 0, credit: 0 };
    });
    lines.forEach((line: any) => {
      const je = line.journal_entry;
      if (!je || je.company_id !== companyId) return;
      const ed = (je.entry_date || '').slice(0, 10);
      if (ed < start || ed > end) return;
      if (branchId && je.branch_id !== branchId) return;
      const accId = line.account_id;
      if (!byAccount[accId]) byAccount[accId] = { debit: 0, credit: 0 };
      byAccount[accId].debit += Number(line.debit) || 0;
      byAccount[accId].credit += Number(line.credit) || 0;
    });

    let totalDebit = 0;
    let totalCredit = 0;
    const rows: TrialBalanceRow[] = accounts
      .map((a: any) => {
        const d = byAccount[a.id] || { debit: 0, credit: 0 };
        const debit = Math.round(d.debit * 100) / 100;
        const credit = Math.round(d.credit * 100) / 100;
        const balance = debit - credit;
        totalDebit += debit;
        totalCredit += credit;
        return {
          account_id: a.id,
          account_code: a.code || '',
          account_name: a.name || '',
          account_type: a.type || '',
          debit,
          credit,
          balance,
        };
      })
      .filter((r) => r.debit !== 0 || r.credit !== 0)
      .sort((a, b) => (a.account_code || '').localeCompare(b.account_code || ''));

    const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
    return { rows, totalDebit, totalCredit, difference };
  },

  /**
   * Profit & Loss: Revenue - Cost of Sales = Gross Profit; Gross Profit - Expenses = Net Profit.
   * Uses journal_entry_lines joined to journal_entries (date filter), grouped by account type.
   */
  async getProfitLoss(
    companyId: string,
    startDate: string,
    endDate: string,
    branchId?: string
  ): Promise<ProfitLossResult> {
    const tb = await this.getTrialBalance(companyId, startDate, endDate, branchId);
    const revenueItems: { name: string; amount: number; code?: string }[] = [];
    const costItems: { name: string; amount: number; code?: string }[] = [];
    const expenseItems: { name: string; amount: number; code?: string }[] = [];

    let totalRevenue = 0;
    let totalCost = 0;
    let totalExpenses = 0;
    tb.rows.forEach((r) => {
      const cat = accountTypeCategory(r.account_type);
      // Revenue is credit-nature: show credit - debit as positive income
      const revenueAmount = cat === 'revenue' ? r.credit - r.debit : 0;
      const expenseAmount = cat === 'expense' ? r.debit - r.credit : 0;
      if (cat === 'revenue' && revenueAmount !== 0) {
        totalRevenue += revenueAmount;
        revenueItems.push({ name: r.account_name, amount: revenueAmount, code: r.account_code });
      } else if (cat === 'expense' && expenseAmount > 0) {
        if ((r.account_type || '').toLowerCase().includes('cogs') || (r.account_type || '').toLowerCase().includes('cost')) {
          totalCost += expenseAmount;
          costItems.push({ name: r.account_name, amount: expenseAmount, code: r.account_code });
        } else {
          totalExpenses += expenseAmount;
          expenseItems.push({ name: r.account_name, amount: expenseAmount, code: r.account_code });
        }
      }
    });
    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalExpenses;
    return {
      revenue: { label: 'Revenue', items: revenueItems, total: totalRevenue },
      costOfSales: { label: 'Cost of Sales', items: costItems, total: totalCost },
      grossProfit,
      expenses: { label: 'Expenses', items: expenseItems, total: totalExpenses },
      netProfit,
      startDate,
      endDate,
    };
  },

  /**
   * Balance Sheet: Assets = Liabilities + Equity (as at a date).
   * Uses trial balance logic but for all time up to asOfDate; filter account types.
   */
  async getBalanceSheet(
    companyId: string,
    asOfDate: string,
    branchId?: string
  ): Promise<BalanceSheetResult> {
    const start = '1900-01-01';
    const end = asOfDate.slice(0, 10);
    const tb = await this.getTrialBalance(companyId, start, end, branchId);
    const assetItems: { name: string; amount: number; code?: string }[] = [];
    const liabilityItems: { name: string; amount: number; code?: string }[] = [];
    const equityItems: { name: string; amount: number; code?: string }[] = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    tb.rows.forEach((r) => {
      const cat = accountTypeCategory(r.account_type);
      const amount = r.balance;
      if (cat === 'asset') {
        totalAssets += amount > 0 ? amount : -amount;
        assetItems.push({ name: r.account_name, amount: amount > 0 ? amount : -amount, code: r.account_code });
      } else if (cat === 'liability') {
        totalLiabilities += amount < 0 ? -amount : amount;
        liabilityItems.push({ name: r.account_name, amount: amount < 0 ? -amount : amount, code: r.account_code });
      } else if (cat === 'equity') {
        totalEquity += amount < 0 ? -amount : amount;
        equityItems.push({ name: r.account_name, amount: amount < 0 ? -amount : amount, code: r.account_code });
      }
    });
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const difference = Math.round((totalAssets - totalLiabilitiesAndEquity) * 100) / 100;
    return {
      assets: { label: 'Assets', items: assetItems, total: totalAssets },
      liabilities: { label: 'Liabilities', items: liabilityItems, total: totalLiabilities },
      equity: { label: 'Owner Equity', items: equityItems, total: totalEquity },
      totalAssets,
      totalLiabilitiesAndEquity,
      difference,
      asOfDate: end,
    };
  },

  /**
   * Sales Profit: per-sale revenue, cost (from sale_items/product cost or unit_cost), profit.
   */
  async getSalesProfit(
    companyId: string,
    startDate: string,
    endDate: string,
    branchId?: string,
    customerId?: string
  ): Promise<SalesProfitResult> {
    let saleQuery = supabase
      .from('sales')
      .select('id, invoice_no, sale_date, total, customer_id, customer:contacts(name), branch_id')
      .eq('company_id', companyId)
      .eq('status', 'final')
      .gte('sale_date', startDate.slice(0, 10))
      .lte('sale_date', endDate.slice(0, 10));
    if (branchId) saleQuery = saleQuery.eq('branch_id', branchId);
    if (customerId) saleQuery = saleQuery.eq('customer_id', customerId);
    const { data: sales } = await saleQuery.order('sale_date', { ascending: false });
    if (!sales?.length) {
      return { rows: [], totalRevenue: 0, totalCost: 0, totalProfit: 0, startDate, endDate };
    }
    const saleIds = sales.map((s: any) => s.id);
    const { data: items } = await supabase
      .from('sale_items')
      .select('sale_id, quantity, unit_price, total, product_id, product:products(cost_price, cost)')
      .in('sale_id', saleIds);
    const costBySale: Record<string, number> = {};
    const revenueBySale: Record<string, number> = {};
    saleIds.forEach((id) => {
      costBySale[id] = 0;
      revenueBySale[id] = 0;
    });
    (items || []).forEach((item: any) => {
      const saleId = item.sale_id;
      const rev = Number(item.total) || Number(item.unit_price) * Number(item.quantity) || 0;
      revenueBySale[saleId] = (revenueBySale[saleId] || 0) + rev;
      const costPerUnit =
        Number((item.product && (item.product.cost_price ?? item.product.cost)) || 0) || 0;
      const cost = costPerUnit * (Number(item.quantity) || 0);
      costBySale[saleId] = (costBySale[saleId] || 0) + cost;
    });
    const rows: SalesProfitRow[] = sales.map((s: any) => {
      const revenue = revenueBySale[s.id] ?? Number(s.total) ?? 0;
      const cost = costBySale[s.id] ?? 0;
      const profit = revenue - cost;
      const margin_pct = revenue > 0 ? (profit / revenue) * 100 : 0;
      return {
        sale_id: s.id,
        invoice_no: s.invoice_no || `S-${s.id?.slice(0, 8)}`,
        sale_date: s.sale_date || '',
        customer_name: s.customer?.name || '—',
        revenue,
        cost,
        profit,
        margin_pct,
      };
    });
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalCost = rows.reduce((s, r) => s + r.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    return { rows, totalRevenue, totalCost, totalProfit, startDate, endDate };
  },

  /**
   * Inventory Valuation: current stock quantity × unit cost per product.
   * Uses stock_movements (quantity, unit_cost, total_cost, created_at).
   */
  async getInventoryValuation(
    companyId: string,
    asOfDate?: string,
    branchId?: string
  ): Promise<InventoryValuationResult> {
    const asOf = asOfDate ? asOfDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
    let movQuery = supabase
      .from('stock_movements')
      .select('product_id, quantity, unit_cost, total_cost, created_at')
      .eq('company_id', companyId);
    if (branchId) movQuery = movQuery.eq('branch_id', branchId);
    const { data: movements } = await movQuery;
    if (!movements?.length) {
      return { rows: [], totalValue: 0, asOfDate: asOf };
    }
    const byProduct: Record<string, { qty: number; costSum: number; costQty: number }> = {};
    movements.forEach((m: any) => {
      const createdAt = m.created_at;
      if (createdAt && String(createdAt).slice(0, 10) > asOf) return;
      const pid = m.product_id;
      if (!byProduct[pid]) byProduct[pid] = { qty: 0, costSum: 0, costQty: 0 };
      const qty = Number(m.quantity) || 0;
      byProduct[pid].qty += qty;
      const tc = Number(m.total_cost);
      const uc = Number(m.unit_cost) || 0;
      if (qty !== 0) {
        if (tc && !Number.isNaN(tc)) {
          byProduct[pid].costSum += tc;
          byProduct[pid].costQty += qty;
        } else if (uc > 0) {
          byProduct[pid].costSum += uc * qty;
          byProduct[pid].costQty += qty;
        }
      }
    });
    const productIds = Object.keys(byProduct).filter((id) => byProduct[id].qty > 0);
    if (!productIds.length) return { rows: [], totalValue: 0, asOfDate: asOf };
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku, cost_price, cost')
      .in('id', productIds);
    const productMap = new Map((products || []).map((p: any) => [p.id, p]));
    let totalValue = 0;
    const rows: InventoryValuationRow[] = productIds.map((pid) => {
      const p = productMap.get(pid);
      const rec = byProduct[pid];
      const avgCost =
        rec.costQty > 0 ? rec.costSum / rec.costQty : Number(p?.cost_price ?? p?.cost) || 0;
      const total_value = Math.round(rec.qty * avgCost * 100) / 100;
      totalValue += total_value;
      return {
        product_id: pid,
        product_name: p?.name || '—',
        sku: p?.sku || '—',
        quantity: rec.qty,
        unit_cost: Math.round(avgCost * 100) / 100,
        total_value,
      };
    });
    return { rows, totalValue: Math.round(totalValue * 100) / 100, asOfDate: asOf };
  },

  /**
   * Cash Flow Statement: Operating, Investing, Financing.
   * Uses journal_entries + journal_entry_lines; classifies by account types of the other leg.
   */
  async getCashFlowStatement(
    companyId: string,
    startDate: string,
    endDate: string,
    branchId?: string
  ): Promise<{
    operating: { in: number; out: number; net: number };
    investing: { in: number; out: number; net: number };
    financing: { in: number; out: number; net: number };
    netChange: number;
    startDate: string;
    endDate: string;
  }> {
    const start = startDate.slice(0, 10);
    const end = endDate.slice(0, 10);
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, type')
      .eq('company_id', companyId)
      .eq('is_active', true);
    if (!accounts?.length) {
      return {
        operating: { in: 0, out: 0, net: 0 },
        investing: { in: 0, out: 0, net: 0 },
        financing: { in: 0, out: 0, net: 0 },
        netChange: 0,
        startDate: start,
        endDate: end,
      };
    }
    const cashBankIds = accounts
      .filter((a: any) => ['cash', 'bank', 'mobile_wallet'].includes(String(a.type).toLowerCase()))
      .map((a: any) => a.id);
    if (!cashBankIds.length) {
      return {
        operating: { in: 0, out: 0, net: 0 },
        investing: { in: 0, out: 0, net: 0 },
        financing: { in: 0, out: 0, net: 0 },
        netChange: 0,
        startDate: start,
        endDate: end,
      };
    }
    const { data: entriesInRange } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .gte('entry_date', start)
      .lte('entry_date', end);
    const entryIdsInRange = (entriesInRange || []).map((e: any) => e.id);
    if (!entryIdsInRange.length) {
      return {
        operating: { in: 0, out: 0, net: 0 },
        investing: { in: 0, out: 0, net: 0 },
        financing: { in: 0, out: 0, net: 0 },
        netChange: 0,
        startDate: start,
        endDate: end,
      };
    }
    const { data: cashLines } = await supabase
      .from('journal_entry_lines')
      .select(`
        id, journal_entry_id, account_id, debit, credit,
        journal_entry:journal_entries(entry_date, company_id, branch_id),
        account:accounts(id, type)
      `)
      .in('account_id', cashBankIds)
      .in('journal_entry_id', entryIdsInRange);
    if (!cashLines?.length) {
      return {
        operating: { in: 0, out: 0, net: 0 },
        investing: { in: 0, out: 0, net: 0 },
        financing: { in: 0, out: 0, net: 0 },
        netChange: 0,
        startDate: start,
        endDate: end,
      };
    }
    const entryIds = [...new Set(cashLines.map((l: any) => l.journal_entry_id))];
    const { data: allLines } = await supabase
      .from('journal_entry_lines')
      .select('journal_entry_id, account_id, debit, credit, account:accounts(type)')
      .in('journal_entry_id', entryIds);
    const entryAccountTypes: Record<string, string[]> = {};
    (allLines || []).forEach((line: any) => {
      const jeId = line.journal_entry_id;
      if (!entryAccountTypes[jeId]) entryAccountTypes[jeId] = [];
      const t = (line.account?.type || '').toLowerCase();
      if (t && !entryAccountTypes[jeId].includes(t)) entryAccountTypes[jeId].push(t);
    });
    const operating = { in: 0, out: 0, net: 0 };
    const investing = { in: 0, out: 0, net: 0 };
    const financing = { in: 0, out: 0, net: 0 };
    cashLines.forEach((line: any) => {
      const je = line.journal_entry;
      if (!je || je.company_id !== companyId) return;
      if (branchId && je.branch_id !== branchId) return;
      const types = entryAccountTypes[line.journal_entry_id] || [];
      const isRev = types.some((t) => REVENUE_TYPES.some((r) => t.includes(r)));
      const isExp = types.some((t) => EXPENSE_TYPES.some((e) => t.includes(e)));
      const isARAP = types.some((t) => t.includes('receivable') || t.includes('payable'));
      const isAsset = types.some((t) => ASSET_TYPES.some((a) => t.includes(a)) && !['cash', 'bank', 'mobile_wallet'].some((c) => t.includes(c)));
      const isLiqEq = types.some((t) => LIABILITY_TYPES.some((l) => t.includes(l)) || EQUITY_TYPES.some((e) => t.includes(e)));
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      const cashIn = debit - credit;
      if (isRev || isARAP || isExp) {
        operating.in += cashIn > 0 ? cashIn : 0;
        operating.out += cashIn < 0 ? -cashIn : 0;
      } else if (isAsset) {
        investing.in += cashIn > 0 ? cashIn : 0;
        investing.out += cashIn < 0 ? -cashIn : 0;
      } else if (isLiqEq) {
        financing.in += cashIn > 0 ? cashIn : 0;
        financing.out += cashIn < 0 ? -cashIn : 0;
      } else {
        operating.in += cashIn > 0 ? cashIn : 0;
        operating.out += cashIn < 0 ? -cashIn : 0;
      }
    });
    operating.net = operating.in - operating.out;
    investing.net = investing.in - investing.out;
    financing.net = financing.in - financing.out;
    const netChange = operating.net + investing.net + financing.net;
    return {
      operating,
      investing,
      financing,
      netChange,
      startDate: start,
      endDate: end,
    };
  },

  /**
   * Profit by Product: aggregate getSalesProfit at product level from sale_items.
   */
  async getProfitByProduct(
    companyId: string,
    startDate: string,
    endDate: string,
    branchId?: string
  ): Promise<{ product_id: string; product_name: string; sku: string; revenue: number; cost: number; profit: number; margin_pct: number }[]> {
    const saleQuery = supabase
      .from('sales')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'final')
      .gte('sale_date', startDate.slice(0, 10))
      .lte('sale_date', endDate.slice(0, 10));
    if (branchId) (saleQuery as any).eq('branch_id', branchId);
    const { data: sales } = await saleQuery;
    if (!sales?.length) return [];
    const saleIds = sales.map((s: any) => s.id);
    const { data: items } = await supabase
      .from('sale_items')
      .select('sale_id, product_id, quantity, unit_price, total, product:products(id, name, sku, cost_price, cost)')
      .in('sale_id', saleIds);
    const byProduct: Record<string, { revenue: number; cost: number }> = {};
    (items || []).forEach((item: any) => {
      const pid = item.product_id || (item.product as any)?.id;
      if (!pid) return;
      if (!byProduct[pid]) byProduct[pid] = { revenue: 0, cost: 0 };
      const rev = Number(item.total) || Number(item.unit_price) * Number(item.quantity) || 0;
      const costPer = Number((item.product && (item.product.cost_price ?? item.product.cost)) || 0);
      byProduct[pid].revenue += rev;
      byProduct[pid].cost += costPer * (Number(item.quantity) || 0);
    });
    const productIds = Object.keys(byProduct);
    if (!productIds.length) return [];
    const { data: products } = await supabase.from('products').select('id, name, sku').in('id', productIds);
    const nameMap = new Map((products || []).map((p: any) => [p.id, { name: p.name, sku: p.sku }]));
    return productIds.map((pid) => {
      const r = byProduct[pid];
      const profit = r.revenue - r.cost;
      const margin_pct = r.revenue > 0 ? Math.round((profit / r.revenue) * 10000) / 100 : 0;
      const info = nameMap.get(pid);
      return {
        product_id: pid,
        product_name: info?.name || '—',
        sku: info?.sku || '—',
        revenue: Math.round(r.revenue * 100) / 100,
        cost: Math.round(r.cost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin_pct,
      };
    }).sort((a, b) => b.profit - a.profit);
  },

  /**
   * Profit by Category: same as product but grouped by product category.
   */
  async getProfitByCategory(
    companyId: string,
    startDate: string,
    endDate: string,
    branchId?: string
  ): Promise<{ category_id: string; category_name: string; revenue: number; cost: number; profit: number; margin_pct: number }[]> {
    const saleQuery = supabase
      .from('sales')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'final')
      .gte('sale_date', startDate.slice(0, 10))
      .lte('sale_date', endDate.slice(0, 10));
    if (branchId) (saleQuery as any).eq('branch_id', branchId);
    const { data: sales } = await saleQuery;
    if (!sales?.length) return [];
    const saleIds = sales.map((s: any) => s.id);
    const { data: items } = await supabase
      .from('sale_items')
      .select('sale_id, product_id, quantity, unit_price, total, product:products(id, category_id, cost_price, cost, category:product_categories(id, name))')
      .in('sale_id', saleIds);
    const byCategory: Record<string, { revenue: number; cost: number; name: string }> = {};
    (items || []).forEach((item: any) => {
      const cat = item.product?.category;
      const cid = cat?.id || 'uncategorized';
      const cname = cat?.name || 'Uncategorized';
      if (!byCategory[cid]) byCategory[cid] = { revenue: 0, cost: 0, name: cname };
      const rev = Number(item.total) || Number(item.unit_price) * Number(item.quantity) || 0;
      const costPer = Number((item.product && (item.product.cost_price ?? item.product.cost)) || 0);
      byCategory[cid].revenue += rev;
      byCategory[cid].cost += costPer * (Number(item.quantity) || 0);
    });
    return Object.entries(byCategory).map(([category_id, r]) => {
      const profit = r.revenue - r.cost;
      const margin_pct = r.revenue > 0 ? Math.round((profit / r.revenue) * 10000) / 100 : 0;
      return {
        category_id,
        category_name: r.name,
        revenue: Math.round(r.revenue * 100) / 100,
        cost: Math.round(r.cost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin_pct,
      };
    }).sort((a, b) => b.profit - a.profit);
  },

  /**
   * Profit by Customer: aggregate sales + sale_items by customer_id.
   */
  async getProfitByCustomer(
    companyId: string,
    startDate: string,
    endDate: string,
    branchId?: string
  ): Promise<{ customer_id: string; customer_name: string; revenue: number; cost: number; profit: number; margin_pct: number }[]> {
    let saleQuery = supabase
      .from('sales')
      .select('id, customer_id, customer:contacts(id, name)')
      .eq('company_id', companyId)
      .eq('status', 'final')
      .gte('sale_date', startDate.slice(0, 10))
      .lte('sale_date', endDate.slice(0, 10));
    if (branchId) (saleQuery as any).eq('branch_id', branchId);
    const { data: sales } = await saleQuery;
    if (!sales?.length) return [];
    const saleIds = sales.map((s: any) => s.id);
    const { data: items } = await supabase
      .from('sale_items')
      .select('sale_id, quantity, unit_price, total, product:products(cost_price, cost)')
      .in('sale_id', saleIds);
    const byCustomer: Record<string, { revenue: number; cost: number; name: string }> = {};
    (items || []).forEach((item: any) => {
      const sale = sales.find((s: any) => s.id === item.sale_id);
      const cid = sale?.customer_id ?? 'walk-in';
      const cname = (sale?.customer as any)?.name || 'Walk-in';
      if (!byCustomer[cid]) byCustomer[cid] = { revenue: 0, cost: 0, name: cname };
      const rev = Number(item.total) || Number(item.unit_price) * Number(item.quantity) || 0;
      const costPer = Number((item.product && (item.product.cost_price ?? item.product.cost)) || 0);
      byCustomer[cid].revenue += rev;
      byCustomer[cid].cost += costPer * (Number(item.quantity) || 0);
    });
    return Object.entries(byCustomer).map(([customer_id, r]) => {
      const profit = r.revenue - r.cost;
      const margin_pct = r.revenue > 0 ? Math.round((profit / r.revenue) * 10000) / 100 : 0;
      return {
        customer_id,
        customer_name: r.name,
        revenue: Math.round(r.revenue * 100) / 100,
        cost: Math.round(r.cost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin_pct,
      };
    }).sort((a, b) => b.profit - a.profit);
  },
};
