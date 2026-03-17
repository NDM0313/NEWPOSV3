/**
 * Final accounting verification for freeze/signoff.
 * NEW BUSINESS = primary; OLD BUSINESS = reference.
 * Checks: accounts, JEs, payments, TB balance, COA sanity, rental/studio zero-state where applicable.
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
const NEW_BUSINESS = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
const OLD_BUSINESS = 'eb71d817-b87e-4195-964b-7b5321b480f5';

async function run() {
  if (!conn) {
    console.log('No DATABASE_URL');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  const results = { newBusiness: {}, oldBusiness: {}, coa: {}, verdict: [] };
  try {
    for (const [label, companyId] of [
      ['NEW BUSINESS', NEW_BUSINESS],
      ['OLD BUSINESS', OLD_BUSINESS],
    ]) {
      const key = label === 'NEW BUSINESS' ? 'newBusiness' : 'oldBusiness';
      const accounts = await client.query('SELECT COUNT(*) AS c FROM accounts WHERE company_id = $1 AND is_active = true', [companyId]);
      const jeCount = await client.query('SELECT COUNT(*) AS c FROM journal_entries WHERE company_id = $1', [companyId]);
      const paymentsCount = await client.query('SELECT COUNT(*) AS c FROM payments WHERE company_id = $1', [companyId]);
      const tb = await client.query(`
        SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS imbalance
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE je.company_id = $1
      `, [companyId]);
      const imbalance = parseFloat(tb.rows[0]?.imbalance ?? 0);
      const rentals = await client.query('SELECT COUNT(*) AS c FROM rentals WHERE company_id = $1', [companyId]);
      const studioStages = await client.query(
        "SELECT COUNT(*) AS c FROM journal_entries WHERE company_id = $1 AND reference_type IN ('studio_production_stage','studio_production_stage_reversal')",
        [companyId]
      );
      results[key] = {
        accounts: accounts.rows[0].c,
        journalEntries: jeCount.rows[0].c,
        payments: paymentsCount.rows[0].c,
        trialBalanceImbalance: imbalance,
        rentals: rentals.rows[0].c,
        studioStageJEs: studioStages.rows[0].c,
      };
      if (label === 'NEW BUSINESS') {
        if (accounts.rows[0].c >= 1) results.verdict.push('NEW: Has accounts');
        if (imbalance === 0) results.verdict.push('NEW: Trial balance balanced');
        else results.verdict.push(`NEW: Trial balance imbalance = ${imbalance}`);
      } else {
        if (imbalance === 0) results.verdict.push('OLD: Trial balance balanced');
        else results.verdict.push(`OLD: Trial balance imbalance = ${imbalance}`);
      }
    }

    // COA: duplicate account names per company (active only)
    const dupNew = await client.query(`
      SELECT name, COUNT(*) AS c FROM accounts WHERE company_id = $1 AND is_active = true GROUP BY name HAVING COUNT(*) > 1
    `, [NEW_BUSINESS]);
    const dupOld = await client.query(`
      SELECT name, COUNT(*) AS c FROM accounts WHERE company_id = $1 AND is_active = true GROUP BY name HAVING COUNT(*) > 1
    `, [OLD_BUSINESS]);
    const invNew = await client.query(`
      SELECT id, code, name FROM accounts WHERE company_id = $1 AND (LOWER(name) LIKE '%inventory%' OR code = '1200') AND is_active = true LIMIT 1
    `, [NEW_BUSINESS]);
    const paymentAccountsNew = await client.query(`
      SELECT COUNT(*) AS c FROM accounts WHERE company_id = $1 AND is_active = true AND (code IN ('1000','1010','1020') OR LOWER(type) IN ('cash','bank','mobile_wallet','asset'))
    `, [NEW_BUSINESS]);

    results.coa = {
      duplicateNamesNew: dupNew.rows.length,
      duplicateNamesOld: dupOld.rows.length,
      inventoryAccountNew: invNew.rows.length > 0 ? invNew.rows[0].code + ' ' + invNew.rows[0].name : 'none',
      paymentLikeAccountsNew: paymentAccountsNew.rows[0].c,
    };
    if (dupNew.rows.length > 0) results.verdict.push('COA: NEW has duplicate account names');
    else results.verdict.push('COA: NEW no duplicate account names');
    if (invNew.rows.length > 0) results.verdict.push('COA: NEW has inventory account');
    else results.verdict.push('COA: NEW no inventory account (optional for zero ops)');

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
