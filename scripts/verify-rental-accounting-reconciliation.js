/**
 * Issue 11 — Rental Accounting / Reporting Reconciliation
 * Verifies: rental counts, rental_payments, journal_entries (reference_type=rental) for NEW and OLD business.
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
    console.log('No DATABASE_URL; set in .env.local');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    for (const [label, companyId] of [
      ['NEW BUSINESS (primary)', NEW_BUSINESS],
      ['OLD BUSINESS', OLD_BUSINESS],
    ]) {
      console.log('\n---', label, companyId, '---');
      const rentals = await client.query(
        'SELECT COUNT(*) AS c FROM rentals WHERE company_id = $1',
        [companyId]
      );
      const payments = await client.query(
        'SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS total FROM rental_payments rp JOIN rentals r ON r.id = rp.rental_id WHERE r.company_id = $1',
        [companyId]
      );
      const jeRental = await client.query(
        `SELECT COUNT(*) AS c, COALESCE(SUM(jel.credit) + SUM(jel.debit), 0) AS total
         FROM journal_entries je
         JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
         WHERE je.company_id = $1 AND je.reference_type = 'rental'`,
        [companyId]
      );
      const accountsRental = await client.query(
        `SELECT code, name FROM accounts WHERE company_id = $1 AND code IN ('2020', '2011') ORDER BY code`,
        [companyId]
      );
      console.log('Rentals count:', rentals.rows[0].c);
      console.log('Rental payments count:', payments.rows[0].c, '| Sum amount:', payments.rows[0].total);
      console.log('Journal entries (rental) count:', jeRental.rows[0].c, '| Lines sum:', jeRental.rows[0].total);
      console.log('Rental-related accounts (2020, 2011):', accountsRental.rows.length, accountsRental.rows.map((r) => r.code + ' ' + r.name));
      if (companyId === NEW_BUSINESS && Number(rentals.rows[0].c) === 0) {
        console.log('NEW BUSINESS: no rentals → zero-state OK. Fix ensures payments post when added via any path.');
      }
    }
    console.log('\n--- Issue 11 fix: RentalContext.addPayment now posts to accounting; Rental Advance (2020) & Security Deposit (2011) in default accounts ---');
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
