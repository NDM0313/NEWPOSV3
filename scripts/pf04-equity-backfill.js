/**
 * PF-04: Ensure Owner Capital (3000) and Retained Earnings (3002) for NEW and OLD business.
 * Run: node scripts/pf04-equity-backfill.js
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
  console.log('No DATABASE_URL — skip.');
  process.exit(0);
}

const NEW_BUSINESS = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
const OLD_BUSINESS = 'eb71d817-b87e-4195-964b-7b5321b480f5';

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    for (const companyId of [NEW_BUSINESS, OLD_BUSINESS]) {
      await client.query(`
        INSERT INTO accounts (company_id, code, name, type, balance, is_active)
        VALUES ($1, '3000', 'Owner Capital', 'equity', 0, true)
        ON CONFLICT (company_id, code) DO NOTHING
      `, [companyId]);
      await client.query(`
        INSERT INTO accounts (company_id, code, name, type, balance, is_active)
        VALUES ($1, '3002', 'Retained Earnings', 'equity', 0, true)
        ON CONFLICT (company_id, code) DO NOTHING
      `, [companyId]);
    }
    console.log('PF-04: Equity accounts 3000, 3002 ensured for NEW and OLD business.');
    const r = await client.query(`
      SELECT company_id, code, name, type FROM accounts
      WHERE company_id IN ($1, $2) AND code IN ('3000', '3002') ORDER BY company_id, code
    `, [NEW_BUSINESS, OLD_BUSINESS]);
    console.table(r.rows);
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
