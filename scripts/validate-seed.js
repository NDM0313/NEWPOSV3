/**
 * Phase 5 – Validation Checklist (run after seed).
 * Connects with DATABASE_POOLER_URL or DATABASE_URL and runs all Phase 5 checks.
 * Exit code 0 = all pass; 1 = one or more failed.
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

const connectionString = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_POOLER_URL or DATABASE_URL.');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

function pass(name, detail) {
  console.log(`  ✅ ${name}${detail ? ` – ${detail}` : ''}`);
  return true;
}
function fail(name, detail) {
  console.log(`  ❌ ${name}${detail ? ` – ${detail}` : ''}`);
  return false;
}

async function query(sql, params = []) {
  const res = await client.query(sql, params);
  return res.rows;
}

async function run() {
  let allPass = true;
  try {
    await client.connect();
    console.log('Phase 5 – Validation (post-seed)\n');

    const cidRow = await query('SELECT id FROM companies LIMIT 1');
    const cid = cidRow?.[0]?.id;
    if (!cid) {
      console.log('  ❌ No company found. Run seed first.');
      process.exit(1);
    }

    // ----- Sales & Items -----
    console.log('Sales & Items');
    const saleItemsTable = await query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('sales_items', 'sale_items') LIMIT 1`
    );
    const itemsTable = saleItemsTable?.[0]?.table_name || 'sale_items';
    const saleWithItems = await query(
      `SELECT s.id, COUNT(i.sale_id) AS cnt FROM sales s LEFT JOIN ${itemsTable} i ON i.sale_id = s.id WHERE s.company_id = $1 GROUP BY s.id`,
      [cid]
    );
    const salesWithoutItems = (saleWithItems || []).filter((r) => Number(r.cnt) === 0);
    if (salesWithoutItems.length > 0) { fail('View Sale (SL) → items', `${salesWithoutItems.length} sale(s) have no items`); allPass = false; }
    else pass('View Sale (SL) → items', `${saleWithItems?.length || 0} sales with items`);

    const studioSales = await query(
      `SELECT id FROM sales WHERE company_id = $1 AND is_studio = true`,
      [cid]
    );
    const prodCount = await query(
      `SELECT COUNT(*) AS c FROM studio_productions WHERE company_id = $1`,
      [cid]
    );
    const stageCount = await query(
      `SELECT COUNT(*) AS c FROM studio_production_stages sp JOIN studio_productions p ON p.id = sp.production_id WHERE p.company_id = $1`,
      [cid]
    );
    if ((studioSales?.length || 0) > 0 && (Number(prodCount?.[0]?.c) === 0 || Number(stageCount?.[0]?.c) === 0)) { fail('Studio Sale → productions + stages', 'Studio sales exist but productions/stages missing'); allPass = false; }
    else pass('Studio Sale (STD) → productions + stages', `${prodCount?.[0]?.c || 0} productions, ${stageCount?.[0]?.c || 0} stages`);

    // ----- Studio & Workers -----
    console.log('\nStudio & Workers');
    const jobRefs = await query(
      `SELECT document_no, amount, status, payment_reference FROM worker_ledger_entries WHERE company_id = $1 LIMIT 10`,
      [cid]
    );
    const hasJobRef = (jobRefs || []).some((r) => r.document_no && String(r.document_no).startsWith('JOB-'));
    if (!hasJobRef && (jobRefs?.length || 0) > 0) { fail('Worker Ledger → JOB ref + amount', 'No JOB-xxxx document_no'); allPass = false; }
    else pass('Worker Ledger → JOB ref + amount', `${jobRefs?.length || 0} entries`);

    // ----- Purchases & Supplier -----
    console.log('\nPurchases & Supplier');
    const suppLedger = await query(
      `SELECT le.id, le.source, le.reference_no FROM ledger_entries le JOIN ledger_master lm ON lm.id = le.ledger_id WHERE lm.company_id = $1 AND lm.ledger_type = 'supplier'`,
      [cid]
    );
    const hasPur = (suppLedger || []).some((r) => r.source === 'purchase' || (r.reference_no && String(r.reference_no).startsWith('PUR-')));
    const hasPay = (suppLedger || []).some((r) => r.source === 'payment' || (r.reference_no && String(r.reference_no).startsWith('PAY-')));
    if (!hasPur && !hasPay) { fail('Supplier Ledger → PUR + PAY', 'No purchase or payment entries'); allPass = false; }
    else pass('Supplier Ledger → PUR + PAY', `${suppLedger?.length || 0} entries`);

    // ----- Expenses & User -----
    console.log('\nExpenses & User');
    const userLedger = await query(
      `SELECT le.source, le.reference_no FROM ledger_entries le JOIN ledger_master lm ON lm.id = le.ledger_id WHERE lm.company_id = $1 AND lm.ledger_type = 'user'`,
      [cid]
    );
    const hasExpense = (userLedger || []).some((r) => (r.source || '').toLowerCase() === 'expense' || (r.reference_no || '').startsWith('EXP-'));
    const hasUserPay = (userLedger || []).some((r) => (r.source || '').toLowerCase() === 'payment');
    if (!hasExpense && !hasUserPay && (userLedger?.length || 0) > 0) { fail('User Ledger → salary/expense + PAY', 'Missing expense or payment source'); allPass = false; }
    else pass('User Ledger → salary/expense + PAY', `${userLedger?.length || 0} entries`);

    // ----- Document sequences -----
    console.log('\nAccounting & Global');
    const seq = await query(
      `SELECT document_type, prefix, current_number FROM document_sequences WHERE company_id = $1`,
      [cid]
    );
    const types = (seq || []).map((r) => r.document_type);
    const need = ['sale', 'studio', 'payment', 'job'];
    const missing = need.filter((t) => !types.includes(t));
    if (missing.length > 0) { fail('Document sequences', `Missing: ${missing.join(', ')}`); allPass = false; }
    else pass('Document sequences', types.join(', '));

    // ----- Orphans: ledger_entries all have valid ledger_id -----
    const orphanLe = await query(
      `SELECT le.id FROM ledger_entries le LEFT JOIN ledger_master lm ON lm.id = le.ledger_id WHERE lm.id IS NULL LIMIT 1`
    );
    if ((orphanLe?.length || 0) > 0) { fail('No orphan ledger entries', 'Found entries without ledger_master'); allPass = false; }
    else pass('No orphan ledger entries');

    const workerCount = await query(`SELECT COUNT(*) AS c FROM workers WHERE company_id = $1`, [cid]);
    const wCount = Number(workerCount?.[0]?.c || 0);
    if (wCount < 6) { fail('Workers count', `Expected >= 6, got ${wCount}`); allPass = false; }
    else pass('Workers count', `${wCount}`);

    console.log('');
    if (allPass) console.log('All Phase 5 checks passed.');
    else console.log('One or more checks failed. Fix seed and re-run.');
    process.exit(allPass ? 0 : 1);
  } catch (err) {
    console.error('Validation error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
