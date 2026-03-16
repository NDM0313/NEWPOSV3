/**
 * Run real_duplicates_audit.sql queries and print counts + sample rows.
 * Requires DATABASE_URL in .env.local.
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

  const out = (label, rows) => {
    console.log('\n---', label, '---');
    console.log('Count:', rows?.length ?? 0);
    if (rows?.length) console.table(rows.slice(0, 10));
  };

  let r;

  r = await client.query(`
    SELECT company_id, LOWER(TRIM(name)) AS norm_name, COUNT(*) AS cnt, array_agg(id ORDER BY code, created_at) AS ids
    FROM accounts WHERE company_id = $1
    GROUP BY company_id, LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  `, [COMPANY]);
  out('accounts_duplicate_name', r.rows);

  if (r.rows?.length > 0) {
    const allIds = r.rows.flatMap((x) => (x.ids || []));
    const rJel = await client.query(
      `SELECT account_id, COUNT(*) AS line_count FROM journal_entry_lines WHERE account_id = ANY($1) GROUP BY account_id`,
      [allIds]
    );
    out('journal_entry_lines_per_duplicate_account', rJel.rows);
  }

  r = await client.query(`
    SELECT id, code, name, parent_id FROM accounts
    WHERE company_id = $1 AND (parent_id IS NOT NULL OR code LIKE '2030%' OR LOWER(COALESCE(name,'')) LIKE '%courier%payable%')
    ORDER BY code
  `, [COMPANY]);
  out('accounts_courier_children', r.rows);

  r = await client.query(`
    SELECT company_id, LOWER(TRIM(COALESCE(name,''))) AS norm_name, COUNT(*) AS cnt, array_agg(id) AS ids
    FROM couriers WHERE company_id = $1
    GROUP BY company_id, LOWER(TRIM(COALESCE(name,'')))
    HAVING COUNT(*) > 1
  `, [COMPANY]);
  out('couriers_duplicate_name', r.rows);

  r = await client.query(`
    SELECT id, reference_type, reference_id, amount, payment_date
    FROM payments WHERE company_id = $1 AND (LOWER(COALESCE(reference_type,'')) IN ('purchase','on_account')) AND contact_id IS NULL
    ORDER BY payment_date DESC LIMIT 50
  `, [COMPANY]);
  out('payments_supplier_null_contact', r.rows);

  r = await client.query(`
    SELECT le.id, le.ledger_id, le.reference_id AS payment_or_purchase_id, le.source, lm.entity_id
    FROM ledger_entries le
    JOIN ledger_master lm ON lm.id = le.ledger_id AND lm.company_id = $1 AND lm.ledger_type = 'supplier'
    WHERE le.source = 'payment' AND le.reference_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = le.reference_id AND p.contact_id IS NOT NULL)
    LIMIT 50
  `, [COMPANY]);
  out('ledger_entries_payment_missing_contact', r.rows);

  if (r.rows?.length > 0) {
    const paymentIds = r.rows.map((x) => x.payment_or_purchase_id);
    const r2 = await client.query(
      `SELECT id, reference_type, reference_id, contact_id FROM payments WHERE id = ANY($1)`,
      [paymentIds]
    );
    out('payments_detail_for_missing_contact', r2.rows);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
