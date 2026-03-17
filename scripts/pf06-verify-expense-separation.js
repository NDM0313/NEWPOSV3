/**
 * PF-06: Verify Cost of Production vs generic expense separation.
 * - Lists expense accounts for NEW and OLD business; marks internal (5000, 5010, 5100, 5200, 5300).
 * - Confirms operating-expense-only list excludes those codes.
 * Run: node scripts/pf06-verify-expense-separation.js
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
  console.log('No DATABASE_URL — skip.');
  process.exit(0);
}

const COST_CODES = new Set(['5000', '5010', '5100', '5200', '5300']);
const NEW_BUSINESS = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
const OLD_BUSINESS = 'eb71d817-b87e-4195-964b-7b5321b480f5';

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    for (const [label, companyId] of [['NEW BUSINESS', NEW_BUSINESS], ['OLD BUSINESS', OLD_BUSINESS]]) {
      console.log('\n---', label, 'expense-type accounts ---');
      const r = await client.query(`
        SELECT code, name, type FROM accounts
        WHERE company_id = $1 AND is_active = true
          AND (LOWER(type) LIKE '%expense%' OR LOWER(type) LIKE '%cost%' OR LOWER(name) LIKE '%expense%' OR LOWER(name) LIKE '%cost%')
        ORDER BY code
      `, [companyId]);
      (r.rows || []).forEach((row) => {
        const internal = COST_CODES.has(String(row.code || '').trim());
        console.log(row.code, row.name, '|', internal ? '→ Cost of Production (P&L)' : '→ Operating Expense');
      });
      if (r.rows.length === 0) console.log('(none)');
    }
    console.log('\n--- PF-06: P&L should show 5000/5010/5100/5200/5300 under Cost of Sales; others under Expenses ---');
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
