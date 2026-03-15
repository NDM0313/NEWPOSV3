/**
 * Auto-fix expense journal entries that have only debit (no credit) – insert missing credit line to Cash (1000).
 * Usage: npm run fix:expense-imbalance   OR   node scripts/fix-expense-journal-imbalance.js
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

const COMPANY_ID = 'eb71d817-b87e-4195-964b-7b5321b480f5';

if (!connectionString) {
  console.error('[fix-expense-imbalance] No DATABASE_URL in .env.local');
  process.exit(1);
}

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('[fix-expense-imbalance] Company:', COMPANY_ID);

    const { rows: imbalanced } = await client.query(
      `SELECT je.id AS journal_entry_id, je.company_id,
              (SUM(jel.debit) - SUM(jel.credit)) AS imbalance
       FROM journal_entries je
       JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
       WHERE (je.reference_type = 'expense' OR je.entry_no ~ '^EXP-[0-9]+$')
         AND je.company_id = $1
       GROUP BY je.id, je.company_id
       HAVING (SUM(jel.debit) - SUM(jel.credit)) > 0.01`,
      [COMPANY_ID]
    );

    if (imbalanced.length === 0) {
      console.log('[fix-expense-imbalance] No imbalanced expense entries found.');
      return;
    }

    console.log('[fix-expense-imbalance] Found', imbalanced.length, 'imbalanced expense entry/entries. Repairing...');

    for (const row of imbalanced) {
      const { rows: accounts } = await client.query(
        `SELECT id FROM accounts
         WHERE company_id = $1 AND (code = '1000' OR name ILIKE '%cash%') AND is_active = true
         LIMIT 1`,
        [row.company_id]
      );
      const cashId = accounts[0]?.id;
      if (!cashId) {
        console.warn('[fix-expense-imbalance] No Cash account (1000) for company', row.company_id, '- skip entry', row.journal_entry_id);
        continue;
      }
      const imbalance = parseFloat(row.imbalance);
      await client.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES ($1, $2, 0, $3, $4)`,
        [row.journal_entry_id, cashId, imbalance, 'Repair: missing credit line (expense balance fix)']
      );
      console.log('[fix-expense-imbalance] Added credit line', imbalance, 'for entry', row.journal_entry_id);
    }

    console.log('[fix-expense-imbalance] Done.');
  } catch (err) {
    console.error('[fix-expense-imbalance]', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
