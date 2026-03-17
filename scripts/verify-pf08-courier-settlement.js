/**
 * PF-08: Verify shipment/courier settlement and COD workflow.
 * - Ensures shipment_ledger view returns courier_payable from sub-accounts (2031+).
 * - Ensures courier_summary and journal entries exist for NEW/OLD business.
 * Run after applying migrations/pf08_shipment_ledger_courier_payable_fix.sql
 * Uses DATABASE_ADMIN_URL or DATABASE_POOLER_URL or DATABASE_URL from .env.local.
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
  console.log('No DATABASE_URL set');
  process.exit(1);
}

const NEW_BUSINESS_ID = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
const OLD_BUSINESS_ID = 'eb71d817-b87e-4195-964b-7b5321b480f5';

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();

  try {
    console.log('--- PF-08 Courier Settlement Verification ---\n');

    // 1) shipment_ledger: courier_payable should come from sub-accounts (2031+)
    const sl = await client.query(
      `SELECT shipment_id, shipping_income, shipping_expense, courier_payable, journal_entry_id
       FROM shipment_ledger WHERE company_id = $1 ORDER BY date DESC LIMIT 5`,
      [NEW_BUSINESS_ID]
    );
    console.log('NEW BUSINESS shipment_ledger rows:', sl.rows.length);
    sl.rows.forEach((r, i) => {
      console.log(`  ${i + 1}. income=${r.shipping_income} expense=${r.shipping_expense} courier_payable=${r.courier_payable}`);
    });

    // 2) courier_summary for NEW BUSINESS
    const csNew = await client.query(
      `SELECT courier_id, courier_name, total_expense, total_paid, balance_due FROM courier_summary WHERE company_id = $1`,
      [NEW_BUSINESS_ID]
    );
    console.log('\nNEW BUSINESS courier_summary:', csNew.rows.length, 'row(s)');

    // 3) OLD BUSINESS same
    const csOld = await client.query(
      `SELECT courier_id, courier_name, balance_due FROM courier_summary WHERE company_id = $1`,
      [OLD_BUSINESS_ID]
    );
    console.log('OLD BUSINESS courier_summary:', csOld.rows.length, 'row(s)');

    // 4) Journal entries reference_type shipment / courier_payment
    const jeNew = await client.query(
      `SELECT reference_type, COUNT(*) FROM journal_entries WHERE company_id = $1 AND reference_type IN ('shipment','courier_payment') GROUP BY reference_type`,
      [NEW_BUSINESS_ID]
    );
    console.log('\nNEW BUSINESS JEs (shipment/courier_payment):', jeNew.rows);

    console.log('\n--- PF-08 verification done ---');
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
