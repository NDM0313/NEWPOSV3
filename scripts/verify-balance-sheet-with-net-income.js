/**
 * Balance Sheet with net income in equity (Issue 04 fix) - run for OLD and NEW business
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1).replace(/\\'/g, "'");
    if (!process.env[key]) process.env[key] = val;
  }
}

const conn = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!conn) {
  console.log('No DATABASE_URL');
  process.exit(0);
}

const NEW_BUSINESS = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
const OLD_BUSINESS = 'eb71d817-b87e-4195-964b-7b5321b480f5';

const REVENUE_TYPES = ['revenue', 'income'];
const EXPENSE_TYPES = ['expense', 'cost of sales', 'cogs'];
const ASSET_TYPES = ['asset', 'cash', 'bank', 'mobile_wallet', 'receivable'];
const LIABILITY_TYPES = ['liability'];
const EQUITY_TYPES = ['equity'];

function category(type) {
  const t = (type || '').toLowerCase();
  if (REVENUE_TYPES.some((x) => t.includes(x))) return 'revenue';
  if (EXPENSE_TYPES.some((x) => t.includes(x))) return 'expense';
  if (ASSET_TYPES.some((x) => t.includes(x))) return 'asset';
  if (LIABILITY_TYPES.some((x) => t.includes(x))) return 'liability';
  if (EQUITY_TYPES.some((x) => t.includes(x))) return 'equity';
  return 'expense';
}

async function runBS(companyId, label, client, end) {
  const q = await client.query(`
    SELECT a.id, a.code, a.name, a.type,
      COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jel.debit ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jel.credit ELSE 0 END), 0) AS balance
    FROM accounts a
    LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = $1 AND je.entry_date <= $2::date
    WHERE a.company_id = $1 AND a.is_active = true
    GROUP BY a.id, a.code, a.name, a.type
    ORDER BY a.code
  `, [companyId, end]);

  let totalAssets = 0, totalLiabilities = 0, totalEquity = 0, revenueExpenseSum = 0;
  q.rows.forEach((r) => {
    const bal = Number(r.balance);
    const cat = category(r.type);
    const amt = bal < 0 ? -bal : bal;
    if (cat === 'asset') totalAssets += amt;
    else if (cat === 'liability') totalLiabilities += amt;
    else if (cat === 'equity') totalEquity += amt;
    else if (cat === 'revenue' || cat === 'expense') revenueExpenseSum += bal;
  });
  const netIncome = Math.round(-revenueExpenseSum * 100) / 100;
  totalEquity += netIncome;
  const totalLiabEquity = totalLiabilities + totalEquity;
  const difference = Math.round((totalAssets - totalLiabEquity) * 100) / 100;
  console.log('\n---', label, '---');
  console.log('Assets:', totalAssets.toFixed(2), '| Liabilities:', totalLiabilities.toFixed(2), '| Equity (incl. Net Income):', totalEquity.toFixed(2), '| Net Income added:', netIncome.toFixed(2));
  console.log('Difference (Assets - (Liab+Equity)):', difference.toFixed(2));
  return difference;
}

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    const end = '2026-12-31';
    await runBS(NEW_BUSINESS, 'NEW BUSINESS (c37b77cc)', client, end);
    await runBS(OLD_BUSINESS, 'OLD BUSINESS (eb71d817)', client, end);
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
