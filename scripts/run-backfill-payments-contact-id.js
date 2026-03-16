/**
 * Backfill payments.contact_id from purchases.supplier_id for purchase-linked payments.
 * Then run first audit query (payments_supplier_null_contact).
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const auditDir = path.join(root, 'docs', 'audit');

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

async function main() {
  if (!connectionString) {
    console.error('No DATABASE_URL in .env.local');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();

  const backfillSql = fs.readFileSync(path.join(auditDir, 'backfill_payments_contact_id_from_purchase.sql'), 'utf8');
  const res = await client.query(backfillSql);
  console.log('Backfill payments.contact_id (from purchase):', res.rowCount ?? 0, 'rows updated');

  const backfillLedgerSql = fs.readFileSync(path.join(auditDir, 'backfill_payments_contact_id_from_supplier_ledger.sql'), 'utf8');
  const res2 = await client.query(backfillLedgerSql);
  console.log('Backfill payments.contact_id (from supplier ledger):', res2.rowCount ?? 0, 'rows updated');

  const auditSql = `
    SELECT COUNT(*) AS cnt FROM payments p
    WHERE p.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
      AND (LOWER(COALESCE(p.reference_type,'')) IN ('purchase','on_account'))
      AND p.contact_id IS NULL
  `;
  const auditRes = await client.query(auditSql);
  console.log('Remaining supplier payments with NULL contact_id:', auditRes.rows?.[0]?.cnt ?? 0);

  await client.end();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
