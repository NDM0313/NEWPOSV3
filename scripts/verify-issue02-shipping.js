/**
 * Verify Issue 02: shipping in sale total / customer ledger.
 * Run: node scripts/verify-issue02-shipping.js
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

const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.log('No DATABASE_URL — skip.');
  process.exit(0);
}

const COMPANY = 'eb71d817-b87e-4195-964b-7b5321b480f5';

async function run() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    console.log('\n--- 1) Sales with shipment: total, shipment_charges, due_amount ---');
    const r1 = await client.query(`
      SELECT s.id, s.invoice_no, s.customer_id, s.total, s.shipment_charges, s.due_amount, s.paid_amount,
        (SELECT COALESCE(SUM(ss.charged_to_customer), 0) FROM sale_shipments ss WHERE ss.sale_id = s.id) AS sum_charged
      FROM sales s
      WHERE s.company_id = $1 AND EXISTS (SELECT 1 FROM sale_shipments ss WHERE ss.sale_id = s.id)
      ORDER BY s.invoice_date DESC LIMIT 5
    `, [COMPANY]);
    console.table(r1.rows);

    const customerId = r1.rows[0]?.customer_id ?? (await client.query(
      `SELECT customer_id FROM sales WHERE company_id = $1 AND customer_id IS NOT NULL LIMIT 1`, [COMPANY]
    )).rows[0]?.customer_id;
    if (customerId) {
      console.log('\n--- 2) get_customer_ledger_sales (with shipment_charges) ---');
      const r2 = await client.query(
        `SELECT * FROM get_customer_ledger_sales($1::uuid, $2::uuid, NULL, NULL) LIMIT 5`,
        [COMPANY, customerId]
      );
      console.table(r2.rows);
    }
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
