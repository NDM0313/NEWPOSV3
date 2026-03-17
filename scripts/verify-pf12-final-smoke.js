/**
 * PF-12 Final Production Smoke Test
 * Runs sanity checks on NEW BUSINESS and regression checks on OLD BUSINESS.
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
const NEW_BUSINESS_ID = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
const OLD_BUSINESS_ID = 'eb71d817-b87e-4195-964b-7b5321b480f5';

const results = { newBiz: [], oldBiz: [], errors: [] };

function ok(company, area, message) {
  const arr = company === 'NEW' ? results.newBiz : results.oldBiz;
  arr.push({ area, status: 'ok', message });
}
function fail(company, area, message) {
  const arr = company === 'NEW' ? results.newBiz : results.oldBiz;
  arr.push({ area, status: 'fail', message });
  results.errors.push({ company, area, message });
}

async function run() {
  if (!conn) {
    console.log('PF-12: No DATABASE_URL — skip DB smoke test. Run app manually for full QA.');
    console.log('NEW_BUSINESS_ID:', NEW_BUSINESS_ID);
    console.log('OLD_BUSINESS_ID:', OLD_BUSINESS_ID);
    process.exit(0);
    return;
  }

  const client = new pg.Client({ connectionString: conn });
  await client.connect();

  try {
    // ---- NEW BUSINESS ----
    const companyCheckNew = await client.query(
      'SELECT id, business_name FROM companies WHERE id = $1',
      [NEW_BUSINESS_ID]
    );
    if (companyCheckNew.rows.length === 0) {
      fail('NEW', 'Company', 'Company not found');
    } else {
      ok('NEW', 'Company', `Found: ${companyCheckNew.rows[0].business_name || NEW_BUSINESS_ID}`);
    }

    const accountsNew = await client.query(
      'SELECT COUNT(*) AS c FROM accounts WHERE company_id = $1 AND is_active = true',
      [NEW_BUSINESS_ID]
    );
    const nAccountsNew = parseInt(accountsNew.rows[0]?.c || '0', 10);
    if (nAccountsNew === 0) {
      fail('NEW', 'Accounts', 'No active accounts');
    } else {
      ok('NEW', 'Accounts', `${nAccountsNew} active accounts`);
    }

    const jeNew = await client.query(
      'SELECT COUNT(*) AS c FROM journal_entries WHERE company_id = $1',
      [NEW_BUSINESS_ID]
    );
    ok('NEW', 'Accounting', `Journal entries: ${jeNew.rows[0]?.c || 0}`);

    const salesNew = await client.query(
      'SELECT COUNT(*) AS c FROM sales WHERE company_id = $1',
      [NEW_BUSINESS_ID]
    );
    ok('NEW', 'Sales', `Sales: ${salesNew.rows[0]?.c || 0}`);

    const purchasesNew = await client.query(
      'SELECT COUNT(*) AS c FROM purchases WHERE company_id = $1',
      [NEW_BUSINESS_ID]
    );
    ok('NEW', 'Purchases', `Purchases: ${purchasesNew.rows[0]?.c || 0}`);

    try {
      const slNew = await client.query(
        'SELECT COUNT(*) AS c FROM shipment_ledger WHERE company_id = $1',
        [NEW_BUSINESS_ID]
      );
      ok('NEW', 'Courier/Shipment', `Shipment ledger view OK, rows: ${slNew.rows[0]?.c || 0}`);
    } catch (e) {
      fail('NEW', 'Courier/Shipment', e.message || 'shipment_ledger view error');
    }

    const csNew = await client.query(
      'SELECT COUNT(*) AS c FROM courier_summary WHERE company_id = $1',
      [NEW_BUSINESS_ID]
    );
    ok('NEW', 'Courier summary', `courier_summary rows: ${csNew.rows[0]?.c || 0}`);

    // ---- OLD BUSINESS ----
    const companyCheckOld = await client.query(
      'SELECT id, business_name FROM companies WHERE id = $1',
      [OLD_BUSINESS_ID]
    );
    if (companyCheckOld.rows.length === 0) {
      fail('OLD', 'Company', 'Company not found');
    } else {
      ok('OLD', 'Company', `Found: ${companyCheckOld.rows[0].business_name || OLD_BUSINESS_ID}`);
    }

    const accountsOld = await client.query(
      'SELECT COUNT(*) AS c FROM accounts WHERE company_id = $1 AND is_active = true',
      [OLD_BUSINESS_ID]
    );
    const nAccountsOld = parseInt(accountsOld.rows[0]?.c || '0', 10);
    if (nAccountsOld === 0) {
      fail('OLD', 'Accounts', 'No active accounts');
    } else {
      ok('OLD', 'Accounts', `${nAccountsOld} active accounts`);
    }

    const jeOld = await client.query(
      'SELECT COUNT(*) AS c FROM journal_entries WHERE company_id = $1',
      [OLD_BUSINESS_ID]
    );
    ok('OLD', 'Accounting', `Journal entries: ${jeOld.rows[0]?.c || 0}`);

    try {
      await client.query('SELECT 1 FROM shipment_ledger LIMIT 1');
      ok('OLD', 'Courier/Shipment', 'shipment_ledger view accessible');
    } catch (e) {
      fail('OLD', 'Courier/Shipment', e.message || 'view error');
    }

    // Trial balance sanity: total debit ≈ total credit for each company
    for (const [label, cid] of [['NEW', NEW_BUSINESS_ID], ['OLD', OLD_BUSINESS_ID]]) {
      const tb = await client.query(
        `SELECT
          COALESCE(SUM(jel.debit), 0) AS total_debit,
          COALESCE(SUM(jel.credit), 0) AS total_credit
         FROM journal_entry_lines jel
         JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = $1`,
        [cid]
      );
      const d = parseFloat(tb.rows[0]?.total_debit || 0);
      const c = parseFloat(tb.rows[0]?.total_credit || 0);
      const diff = Math.abs(d - c);
      if (diff > 0.02) {
        fail(label, 'Reports (TB balance)', `Debit ${d} vs Credit ${c} (diff ${diff})`);
      } else {
        ok(label, 'Reports (TB balance)', `Debit = Credit (${d.toFixed(2)})`);
      }
    }
  } finally {
    await client.end();
  }

  // Print report
  console.log('\n--- PF-12 Final Smoke Test ---\n');
  console.log('NEW BUSINESS:');
  results.newBiz.forEach((r) => console.log(`  [${r.status.toUpperCase()}] ${r.area}: ${r.message}`));
  console.log('\nOLD BUSINESS:');
  results.oldBiz.forEach((r) => console.log(`  [${r.status.toUpperCase()}] ${r.area}: ${r.message}`));
  if (results.errors.length > 0) {
    console.log('\nErrors:', results.errors);
    process.exit(1);
  }
  console.log('\n--- DB smoke test passed ---');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
