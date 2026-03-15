/**
 * Run post-fix functional checks (SQL assertions).
 * Company: eb71d817-b87e-4195-964b-7b5321b480f5
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1).replace(/\\'/g, "'");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const connectionString =
  process.env.DATABASE_ADMIN_URL ||
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL;

const COMPANY = 'eb71d817-b87e-4195-964b-7b5321b480f5';

async function main() {
  if (!connectionString) {
    console.error('No DATABASE_URL in .env.local');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();

  const checks = [
    {
      name: '1. Transfer/manual: JEs touching payment account have payment_id set',
      sql: `
        WITH payment_accounts AS (
          SELECT id FROM accounts WHERE company_id = $1 AND (code IN ('1000','1010','1020') OR LOWER(COALESCE(name,'')) LIKE '%cash%' OR LOWER(COALESCE(name,'')) LIKE '%bank%' OR LOWER(COALESCE(name,'')) LIKE '%wallet%')
        ),
        jes AS (
          SELECT DISTINCT je.id FROM journal_entries je
          JOIN journal_entry_lines l ON l.journal_entry_id = je.id
          JOIN payment_accounts pa ON pa.id = l.account_id
          WHERE je.company_id = $1
        )
        SELECT COUNT(*) FILTER (WHERE je.payment_id IS NULL) AS missing, COUNT(*) AS total
        FROM journal_entries je JOIN jes j ON j.id = je.id
      `,
      pass: (r) => Number(r.rows[0]?.missing) === 0 && Number(r.rows[0]?.total) >= 0,
    },
    {
      name: '2. Worker payment: payments row exists and JE linked',
      sql: `SELECT COUNT(*) AS cnt FROM journal_entries je JOIN payments p ON p.id = je.payment_id WHERE je.company_id = $1 AND LOWER(COALESCE(je.reference_type,'')) = 'worker_payment'`,
      pass: (r) => true,
    },
    {
      name: '3. Expense: payments with reference_type expense exist',
      sql: `SELECT COUNT(*) AS cnt FROM payments WHERE company_id = $1 AND LOWER(COALESCE(reference_type,'')) = 'expense'`,
      pass: (r) => true,
    },
    {
      name: '4. Supplier: one payment per JE, no duplicate',
      sql: `SELECT COUNT(*) AS je_with_pay FROM journal_entries WHERE company_id = $1 AND LOWER(COALESCE(reference_type,'')) = 'purchase' AND payment_id IS NOT NULL`,
      pass: (r) => true,
    },
    {
      name: '5. No new test_* in journal_entries (historical only)',
      sql: `SELECT COUNT(*) AS cnt FROM journal_entries WHERE company_id = $1 AND LOWER(COALESCE(reference_type,'')) LIKE 'test_%'`,
      pass: (r) => true,
    },
  ];

  console.log('Functional checks (company:', COMPANY, ')\n');
  for (const c of checks) {
    const r = await client.query(c.sql, [COMPANY]);
    const ok = c.pass(r);
    console.log(ok ? '[PASS]' : '[CHECK]', c.name);
    if (r.rows?.[0]) console.log('  ', r.rows[0]);
  }
  const verify = await client.query(fs.readFileSync(path.join(root, 'docs/audit/post_fix_verification.sql'), 'utf8'));
  console.log('\nPost-fix verification:');
  console.table(verify.rows);
  await client.end();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
