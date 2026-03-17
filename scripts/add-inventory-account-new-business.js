/**
 * Issue 09: Add Inventory (1200) account to NEW BUSINESS if missing.
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

async function run() {
  if (!conn) {
    console.log('No DATABASE_URL');
    process.exit(0);
  }
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    const exists = await client.query(
      `SELECT 1 FROM accounts WHERE company_id = $1 AND code = '1200' LIMIT 1`,
      [NEW_BUSINESS]
    );
    if (exists.rows?.length) {
      console.log('Inventory (1200) already exists for NEW BUSINESS.');
      return;
    }
    await client.query(
      `INSERT INTO accounts (id, company_id, code, name, type, is_active)
       VALUES (gen_random_uuid(), $1, '1200', 'Inventory', 'asset', true)`,
      [NEW_BUSINESS]
    );
    console.log('Added Inventory (1200) account for NEW BUSINESS.');
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
