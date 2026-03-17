/**
 * Issue 03: Trial Balance verification for company eb71d817-b87e-4195-964b-7b5321b480f5
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
    // 1) Total debit vs credit for company (all time, all entries with valid JE)
    const q1 = await client.query(`
      SELECT
        COALESCE(SUM(jel.debit), 0) AS total_debit,
        COALESCE(SUM(jel.credit), 0) AS total_credit,
        COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) AS difference
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = $1
      INNER JOIN accounts a ON a.id = jel.account_id AND a.company_id = $1
    `, [COMPANY]);
    console.log('\n--- 1) TB totals (all time, company) ---');
    console.log(q1.rows[0]);

    // 2) Orphan JEL: lines with no matching JE or wrong company
    const q2 = await client.query(`
      SELECT jel.id, jel.journal_entry_id, jel.account_id, jel.debit, jel.credit
      FROM journal_entry_lines jel
      LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.account_id IN (SELECT id FROM accounts WHERE company_id = $1)
        AND (je.id IS NULL OR je.company_id != $1)
    `, [COMPANY]);
    console.log('\n--- 2) Orphan or wrong-company JEL count ---', q2.rows.length);
    if (q2.rows.length > 0) console.table(q2.rows.slice(0, 10));

    // 3) JEs that don't balance (sum of lines debit != sum of lines credit)
    const q3 = await client.query(`
      SELECT je.id, je.entry_no, je.reference_type, je.entry_date,
        SUM(jel.debit) AS sum_debit, SUM(jel.credit) AS sum_credit,
        SUM(jel.debit) - SUM(jel.credit) AS diff
      FROM journal_entries je
      JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
      WHERE je.company_id = $1
      GROUP BY je.id, je.entry_no, je.reference_type, je.entry_date
      HAVING ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) > 0.01
      ORDER BY je.entry_date DESC
      LIMIT 20
    `, [COMPANY]);
    console.log('\n--- 3) Unbalanced journal entries ---', q3.rows.length);
    if (q3.rows.length > 0) console.table(q3.rows);

    // 4) JEL with account not in company (stale account_id)
    const q4 = await client.query(`
      SELECT jel.id, jel.journal_entry_id, jel.account_id, jel.debit, jel.credit
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = $1
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = jel.account_id AND a.company_id = $1)
    `, [COMPANY]);
    console.log('\n--- 4) JEL with account not in company ---', q4.rows.length);
    if (q4.rows.length > 0) console.table(q4.rows.slice(0, 10));
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
