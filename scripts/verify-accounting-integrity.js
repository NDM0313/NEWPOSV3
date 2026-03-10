/**
 * Verify ERP accounting integrity (read-only).
 * Checks: orphan journal_entry_lines, required accounts per company, journal entry counts.
 * Env: .env.local → DATABASE_URL / DATABASE_POOLER_URL / DATABASE_ADMIN_URL.
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

async function run() {
  if (!connectionString) {
    console.log('[verify-accounting] No DATABASE_URL in .env.local — skip.');
    process.exit(0);
  }

  const client = new pg.Client({ connectionString });
  try {
    await client.connect();

    console.log('\n--- Accounting integrity check ---\n');

    const { rows: orphanJel } = await client.query(`
      SELECT COUNT(*) AS cnt FROM journal_entry_lines jel
      LEFT JOIN accounts a ON a.id = jel.account_id
      WHERE a.id IS NULL
    `);
    const orphanCount = Number(orphanJel?.[0]?.cnt ?? 0);
    console.log('Orphan journal_entry_lines (account_id not in accounts):', orphanCount, orphanCount === 0 ? 'OK' : 'FAIL');

    const { rows: companies } = await client.query('SELECT id FROM companies');
    const companyIds = (companies || []).map((r) => r.id);
    const { rows: required } = await client.query(`
      SELECT company_id, code FROM accounts WHERE code IN ('2000','4000','5000','2010')
    `);
    const requiredSet = new Set((required || []).map((r) => `${r.company_id}:${r.code}`));
    const expected = companyIds.length * 4;
    const actual = required?.length ?? 0;
    console.log('Required ERP accounts (2000,4000,5000,2010) per company:', actual + '/' + expected, actual >= expected ? 'OK' : 'WARN');

    const { rows: jeCount } = await client.query('SELECT COUNT(*) AS cnt FROM journal_entries');
    const { rows: jelCount } = await client.query('SELECT COUNT(*) AS cnt FROM journal_entry_lines');
    console.log('journal_entries count:', jeCount?.[0]?.cnt ?? 0);
    console.log('journal_entry_lines count:', jelCount?.[0]?.cnt ?? 0);

    const { rows: chartExists } = await client.query(`
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='chart_accounts' LIMIT 1
    `);
    const { rows: atExists } = await client.query(`
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='account_transactions' LIMIT 1
    `);
    console.log('chart_accounts table exists:', chartExists?.length ? 'yes (unused by app)' : 'no');
    console.log('account_transactions table exists:', atExists?.length ? 'yes (unused by app)' : 'no');

    console.log('\n--- Done ---\n');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
