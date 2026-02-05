/**
 * Link current Auth user to seeded company/branch (insert/update public.users + user_branches).
 * Usage: node scripts/run-link-auth.js
 * Env: DATABASE_POOLER_URL or DATABASE_URL in .env.local
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

const sqlPath = path.join(root, 'seed', 'link_auth_user_to_seed.sql');
if (!fs.existsSync(sqlPath)) {
  console.error('Not found: seed/link_auth_user_to_seed.sql');
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('Linking auth user to seed company/branch...');
    await client.query(sql);
    console.log('Done. Refresh the app; user should see company and branch.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
