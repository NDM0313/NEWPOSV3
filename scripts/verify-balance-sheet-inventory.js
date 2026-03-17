/**
 * Issue 09: Verify Balance Sheet shows all asset accounts including Inventory (1200) with balance 0 or value.
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

const ASSET_TYPES = ['asset', 'cash', 'bank', 'mobile_wallet', 'receivable', 'inventory'];
const LIABILITY_TYPES = ['liability'];
const EQUITY_TYPES = ['equity'];

function category(type) {
  const t = (type || '').toLowerCase();
  if (ASSET_TYPES.some((x) => t.includes(x))) return 'asset';
  if (LIABILITY_TYPES.some((x) => t.includes(x))) return 'liability';
  if (EQUITY_TYPES.some((x) => t.includes(x))) return 'equity';
  return null;
}

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    const end = '2026-12-31';
    for (const [label, companyId] of [
      ['NEW BUSINESS (c37b77cc)', NEW_BUSINESS],
      ['OLD BUSINESS (eb71d817)', OLD_BUSINESS],
    ]) {
      const accounts = await client.query(
        `SELECT a.id, a.code, a.name, a.type,
          COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jel.debit - jel.credit ELSE 0 END), 0) AS balance
         FROM accounts a
         LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
         LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = $1 AND je.entry_date <= $2::date
         WHERE a.company_id = $1 AND a.is_active = true
         GROUP BY a.id, a.code, a.name, a.type
         ORDER BY a.code`,
        [companyId, end]
      );
      const assets = [];
      const liabilities = [];
      const equity = [];
      (accounts.rows || []).forEach((r) => {
        const cat = category(r.type);
        const bal = Number(r.balance);
        if (cat === 'asset') assets.push({ code: r.code, name: r.name, balance: bal, display: bal > 0 ? bal : -bal });
        else if (cat === 'liability') liabilities.push({ code: r.code, name: r.name, balance: bal, display: bal < 0 ? -bal : bal });
        else if (cat === 'equity') equity.push({ code: r.code, name: r.name, balance: bal, display: bal < 0 ? -bal : bal });
      });
      const totalAssets = assets.reduce((s, x) => s + x.display, 0);
      const totalLiab = liabilities.reduce((s, x) => s + x.display, 0);
      const totalEquity = equity.reduce((s, x) => s + x.display, 0);
      console.log('\n---', label, '---');
      console.log('Asset accounts (including zero balance):', assets.length);
      assets.forEach((a) => console.log('  ', a.code, a.name, '|', a.display.toFixed(2)));
      const has1200 = assets.some((a) => a.code === '1200');
      console.log('Inventory (1200) in asset section:', has1200 ? 'YES' : 'NO');
      console.log('Total Assets:', totalAssets.toFixed(2), '| Liabilities:', totalLiab.toFixed(2), '| Equity:', totalEquity.toFixed(2));
    }
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
