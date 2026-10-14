/**
 * Read-only golden verification for mobile unified report loaders.
 * Usage: node scripts/single-core-ledger/verify-mobile-unified-report-goldens.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

function loadEnv() {
  const envPath = resolve(root, 'erp-mobile-app/.env');
  if (!existsSync(envPath)) throw new Error('erp-mobile-app/.env not found');
  const text = readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^VITE_(\w+)=(.*)$/);
    if (m) env[`VITE_${m[1]}`] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const GOLDENS = {
  '30bd8592-3384-4f34-899a-f3907e336485': { name: 'DIN CHINA', bsAssets: 89754087.52, plNet: 8465730.87 },
  '597a5292-14c8-4cd8-96bd-c61b5a0d8c92': { name: 'DIN BRIDAL', bsAssets: 13521792, plNet: 119992 },
  '2ab65903-62a3-4bcf-bced-076b681e9b74': { name: 'DIN COUTURE', bsAssets: 22667273, plNet: -16750 },
};

const BS_LIFETIME_START = '1900-01-01';
const AS_OF = '2026-07-01';
const PL_START = '2026-01-01';
const PL_END = '2026-07-01';

function round2(n) {
  return Math.round(n * 100) / 100;
}

function accountTypeCategory(type) {
  const t = (type || '').toLowerCase();
  if (['revenue', 'income'].some((x) => t.includes(x))) return 'revenue';
  if (['expense', 'cost of sales', 'cogs'].some((x) => t.includes(x))) return 'expense';
  if (['asset', 'cash', 'bank', 'mobile_wallet', 'receivable', 'inventory'].some((x) => t.includes(x))) return 'asset';
  if (['liability', 'payable'].some((x) => t.includes(x))) return 'liability';
  if (['equity'].some((x) => t.includes(x))) return 'equity';
  return 'expense';
}

function mapBs(tbRows, accounts, asOfDate) {
  const balanceByAccountId = new Map(tbRows.map((r) => [r.account_id, r.balance]));
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let revenueExpenseBalanceSum = 0;
  const COA_HEADERS = new Set(['1050', '1060', '1070', '1080', '1090', '2090', '3090', '4050', '6090']);

  accounts.forEach((a) => {
    const codeTrim = String(a.code || '').trim();
    if (COA_HEADERS.has(codeTrim) || a.is_group) return;
    const cat = accountTypeCategory(a.type);
    const amount = balanceByAccountId.get(a.id) ?? 0;
    if (cat === 'asset') totalAssets += amount;
    else if (cat === 'liability') totalLiabilities += -amount;
    else if (cat === 'equity') totalEquity += -amount;
    else revenueExpenseBalanceSum += amount;
  });

  const netIncome = round2(-revenueExpenseBalanceSum);
  totalEquity += netIncome;
  return {
    totalAssets: round2(totalAssets),
    asOfDate: asOfDate.slice(0, 10),
  };
}

function mapPl(tbRows, startDate, endDate) {
  let totalRevenue = 0;
  let totalCost = 0;
  let totalExpenses = 0;
  const COST_CODES = new Set(['5000', '5010', '5100', '5110']);
  tbRows.forEach((r) => {
    const cat = accountTypeCategory(r.account_type);
    const revenueAmount = cat === 'revenue' ? r.credit - r.debit : 0;
    const expenseAmount = cat === 'expense' ? r.debit - r.credit : 0;
    if (cat === 'revenue' && revenueAmount !== 0) totalRevenue += revenueAmount;
    else if (cat === 'expense' && expenseAmount > 0) {
      if (COST_CODES.has(String(r.account_code || '').trim())) totalCost += expenseAmount;
      else totalExpenses += expenseAmount;
    }
  });
  return { netProfit: round2(totalRevenue - totalCost - totalExpenses), startDate, endDate };
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  const supabase = createClient(url, key);

  const results = [];
  for (const [companyId, golden] of Object.entries(GOLDENS)) {
    const { data: bsRpc } = await supabase.rpc('get_unified_trial_balance', {
      p_company_id: companyId,
      p_branch_id: null,
      p_as_of_date: AS_OF,
      p_basis: 'official_gl',
    });
    const { data: plRpc } = await supabase.rpc('get_unified_trial_balance', {
      p_company_id: companyId,
      p_branch_id: null,
      p_as_of_date: PL_END,
      p_basis: 'official_gl',
    });
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name, type, parent_id, is_group')
      .eq('company_id', companyId)
      .eq('is_active', true);

    const mapTbRows = (payload) =>
      (payload?.accounts || []).map((a) => ({
        account_id: a.account_id,
        account_code: a.account_code || '',
        account_name: a.account_name || '',
        account_type: a.account_type || '',
        debit: round2(Number(a.total_debit) || 0),
        credit: round2(Number(a.total_credit) || 0),
        balance: round2(Number(a.net_balance) || 0),
      }));

    const bsRows = mapTbRows(bsRpc);
    const plRows = mapTbRows(plRpc);
    const bs = mapBs(bsRows, accounts || [], AS_OF);
    const pl = mapPl(plRows, PL_START, PL_END);

    const bsDelta = round2(bs.totalAssets - golden.bsAssets);
    const plDelta = round2(pl.netProfit - golden.plNet);
    const pass = bsDelta === 0 && plDelta === 0;

    const { data: cfRpc } = await supabase.rpc('get_unified_cash_bank_ledger', {
      p_company_id: companyId,
      p_branch_id: null,
      p_start_date: PL_START,
      p_end_date: PL_END,
      p_basis: 'official_gl',
      p_liquidity: 'all',
    });
    const cfLoads = !cfRpc?.error && Array.isArray(cfRpc?.rows);

    results.push({
      company: golden.name,
      companyId,
      bsAssets: bs.totalAssets,
      bsGolden: golden.bsAssets,
      bsDelta,
      plNet: pl.netProfit,
      plGolden: golden.plNet,
      plDelta,
      trialBalanceLoads: bsRows.length > 0,
      cashFlowLoads: cfLoads,
      pass,
    });
  }

  const overall = results.every((r) => r.pass && r.trialBalanceLoads && r.cashFlowLoads);
  console.log(JSON.stringify({ overall, results }, null, 2));
  process.exit(overall ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
