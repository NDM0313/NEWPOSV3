/**
 * Run supplier ledger live path verification (payment -> ledger_master -> ledger_entries).
 * Company: eb71d817-b87e-4195-964b-7b5321b480f5. No placeholders.
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
    SELECT p.id AS payment_id, p.contact_id, p.amount, p.reference_type,
           lm.id AS ledger_id, lm.entity_id, le.id AS ledger_entry_id, le.source, le.reference_id
    FROM payments p
    LEFT JOIN ledger_master lm ON lm.company_id = p.company_id AND lm.ledger_type = 'supplier' AND lm.entity_id = p.contact_id
    LEFT JOIN ledger_entries le ON le.ledger_id = lm.id AND le.source = 'payment' AND le.reference_id = p.id
    WHERE p.company_id = $1 AND p.reference_type = 'manual_payment'
    ORDER BY p.payment_date DESC, p.created_at DESC
    LIMIT 10
  `, [COMPANY]);
  out('manual_payment -> ledger_entries', r.rows);

  const missing = (r.rows || []).filter((row) => row.ledger_entry_id == null && row.contact_id != null);
  if (missing.length > 0) {
    console.log('\n⚠ Payments with contact_id but NO ledger_entries row:', missing.length);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
