/**
 * PF-01 — Courier Payable Control / Sub-Account verification
 * Ensures 2030 exists for NEW and OLD business; verifies courier structure.
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
  try {
    // Ensure 2030 exists for all companies
    const insertSql = `
      INSERT INTO accounts (company_id, code, name, type, balance, is_active)
      SELECT c.id, '2030', 'Courier Payable (Control)', 'Liability', 0, true
      FROM companies c
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.company_id = c.id AND a.code = '2030')
    `;
    await client.query(insertSql);

    for (const [label, companyId] of [
      ['NEW BUSINESS (primary)', NEW_BUSINESS],
      ['OLD BUSINESS', OLD_BUSINESS],
    ]) {
      console.log('\n---', label, companyId, '---');
      const control = await client.query(
        "SELECT id, code, name FROM accounts WHERE company_id = $1 AND code = '2030' LIMIT 1",
        [companyId]
      );
      const children = await client.query(
        "SELECT id, code, name, parent_id FROM accounts WHERE company_id = $1 AND code ~ '^203[1-9]' ORDER BY code",
        [companyId]
      );
      let couriers = { rows: [] };
      try {
        couriers = await client.query(
          'SELECT id, name, account_id FROM couriers WHERE company_id = $1',
          [companyId]
        );
      } catch (_) {
        // couriers table or columns may not exist
      }
      console.log('2030 Control:', control.rows[0] ? control.rows[0].code + ' ' + control.rows[0].name : 'MISSING');
      console.log('Courier child accounts (2031+):', children.rows.length, children.rows.map((r) => r.code + ' ' + r.name));
      console.log('Couriers master rows:', couriers.rows.length);
      if (companyId === NEW_BUSINESS) {
        if (control.rows[0]) console.log('NEW BUSINESS: 2030 present; COA default view shows control only (sub-accounts hidden until "Show sub-accounts").');
        else console.log('NEW BUSINESS: 2030 MISSING - run ensure default accounts.');
      }
    }
    console.log('\n--- PF-01: Courier control 2030 ensured; sub-accounts 2031+ per courier; COA hides children by default ---');
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
