/**
 * Issue 04: Balance Sheet verification for NEW BUSINESS c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee
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

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    const end = '2026-12-31';
    const q = await client.query(`
      SELECT a.id, a.code, a.name, a.type,
        COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) AS balance
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = $1 AND je.entry_date <= $2::date
      WHERE a.company_id = $1 AND a.is_active = true
      GROUP BY a.id, a.code, a.name, a.type
      HAVING COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) != 0
      ORDER BY a.code
    `, [NEW_BUSINESS, end]);

    let totalAssets = 0, totalLiabilities = 0, totalEquity = 0;
    const byCat = { asset: [], liability: [], equity: [], revenue: [], expense: [] };
    q.rows.forEach((r) => {
      const bal = Number(r.balance);
      const cat = category(r.type);
      const amt = bal < 0 ? -bal : bal;
      if (cat === 'asset') {
        totalAssets += amt;
        byCat.asset.push({ code: r.code, name: r.name, balance: bal, amount: amt });
      } else if (cat === 'liability') {
        totalLiabilities += amt;
        byCat.liability.push({ code: r.code, name: r.name, balance: bal, amount: amt });
      } else if (cat === 'equity') {
        totalEquity += amt;
        byCat.equity.push({ code: r.code, name: r.name, balance: bal, amount: amt });
      } else if (cat === 'revenue' || cat === 'expense') {
        byCat[cat].push({ code: r.code, name: r.name, balance: bal });
      }
    });

    console.log('\n--- NEW BUSINESS Balance Sheet components (as-of', end, ') ---');
    console.log('Assets:', byCat.asset.length, 'accounts, total:', totalAssets.toFixed(2));
    console.log('Liabilities:', byCat.liability.length, 'accounts, total:', totalLiabilities.toFixed(2));
    console.log('Equity:', byCat.equity.length, 'accounts, total:', totalEquity.toFixed(2));
    console.log('Revenue (excluded from BS):', byCat.revenue.length);
    console.log('Expense (excluded from BS):', byCat.expense.length);
    const diff = totalAssets - (totalLiabilities + totalEquity);
    console.log('\nAssets - (Liab + Equity) =', diff.toFixed(2));

    // List accounts and their type classification
    const allAccounts = await client.query(`
      SELECT code, name, type FROM accounts WHERE company_id = $1 AND is_active = true ORDER BY code
    `, [NEW_BUSINESS]);
    console.log('\n--- All accounts and category ---');
    allAccounts.rows.forEach((r) => {
      console.log(r.code, r.name, '| type:', r.type, '| cat:', category(r.type));
    });
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
