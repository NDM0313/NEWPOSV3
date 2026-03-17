/**
 * Check NEW BUSINESS exists and has companies/accounts
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
  console.log('No DATABASE_URL');
  process.exit(0);
}

const NEW_BUSINESS = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    const comp = await client.query('SELECT id, name FROM companies WHERE id = $1', [NEW_BUSINESS]);
    console.log('Company by id:', comp.rows[0] || 'NOT FOUND');

    const allComp = await client.query('SELECT id, name FROM companies ORDER BY created_at DESC LIMIT 5');
    console.log('\nRecent companies:', allComp.rows);

    const acc = await client.query('SELECT id, code, name, type FROM accounts WHERE company_id = $1 ORDER BY code', [NEW_BUSINESS]);
    console.log('Accounts count:', acc.rows.length);
    acc.rows.forEach((r) => console.log(r.code, r.name, r.type));

    const je = await client.query('SELECT COUNT(*) FROM journal_entries WHERE company_id = $1', [NEW_BUSINESS]);
    console.log('Journal entries:', je.rows[0].count);
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
