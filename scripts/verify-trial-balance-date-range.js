/**
 * Issue 03: TB with date range and per-account rounding (as app does)
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

const COMPANY = 'eb71d817-b87e-4195-964b-7b5321b480f5';

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    // Per-account totals (raw) for a wide date range - then apply rounding like the app
    const q = await client.query(`
      SELECT a.id, a.code, a.name,
        COALESCE(SUM(jel.debit), 0) AS debit,
        COALESCE(SUM(jel.credit), 0) AS credit
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = $1
      WHERE a.company_id = $1 AND a.is_active = true
      GROUP BY a.id, a.code, a.name
      HAVING COALESCE(SUM(jel.debit), 0) != 0 OR COALESCE(SUM(jel.credit), 0) != 0
      ORDER BY a.code
    `, [COMPANY]);

    let rawDebit = 0, rawCredit = 0;
    let roundedDebit = 0, roundedCredit = 0;
    q.rows.forEach((r) => {
      const d = Number(r.debit);
      const c = Number(r.credit);
      rawDebit += d;
      rawCredit += c;
      const rd = Math.round(d * 100) / 100;
      const rc = Math.round(c * 100) / 100;
      roundedDebit += rd;
      roundedCredit += rc;
    });
    console.log('\n--- Per-account then sum (all time) ---');
    console.log('Raw    total debit:', rawDebit, 'credit:', rawCredit, 'diff:', rawDebit - rawCredit);
    console.log('Rounded total debit:', roundedDebit, 'credit:', roundedCredit, 'diff:', roundedDebit - roundedCredit);

    // With date filter: only lines whose JE is in range
    const q2 = await client.query(`
      SELECT a.id, a.code, SUM(jel.debit) AS debit, SUM(jel.credit) AS credit
      FROM accounts a
      INNER JOIN journal_entry_lines jel ON jel.account_id = a.id
      INNER JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = $1 AND je.entry_date >= $2::date AND je.entry_date <= $3::date
      WHERE a.company_id = $1 AND a.is_active = true
      GROUP BY a.id, a.code
    `, [COMPANY, '2026-01-01', '2026-12-31']);

    rawDebit = 0; rawCredit = 0;
    roundedDebit = 0; roundedCredit = 0;
    (q2.rows || []).forEach((r) => {
      const d = Number(r.debit);
      const c = Number(r.credit);
      rawDebit += d;
      rawCredit += c;
      roundedDebit += Math.round(d * 100) / 100;
      roundedCredit += Math.round(c * 100) / 100;
    });
    console.log('\n--- With date 2026-01-01 to 2026-12-31 ---');
    console.log('Raw    total debit:', rawDebit, 'credit:', rawCredit, 'diff:', rawDebit - rawCredit);
    console.log('Rounded total debit:', roundedDebit, 'credit:', roundedCredit, 'diff:', roundedDebit - roundedCredit);
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
