/**
 * Apply Import FX W3 migrations ONLY to localhost / 127.0.0.1 from .env.db.local.
 * Never loads .env.local (production). Never targets dincouture / VPS IPs.
 *
 * Usage: node scripts/qa/apply-import-fx-w3-local.mjs
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

function loadEnvDbLocal() {
  const envPath = path.join(root, '.env.db.local');
  if (!fs.existsSync(envPath)) {
    console.error('BLOCKED — LOCALHOST DATABASE NOT CONFIRMED');
    console.error('Missing .env.db.local (required; never use .env.local / production).');
    process.exit(2);
  }
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const env = loadEnvDbLocal();
const connectionString = env.DATABASE_ADMIN_URL || env.DIRECT_URL || env.DATABASE_URL;
if (!connectionString) throw new Error('No DATABASE_URL in .env.db.local');

const u = new URL(connectionString);
const host = u.hostname;
const port = u.port || '5432';
const db = (u.pathname || '/postgres').replace(/^\//, '') || 'postgres';
console.log(`[W3-MIGRATE] Resolved host=${host} port=${port} database=${db}`);
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error('[W3-MIGRATE] ABORT: host is not localhost — refusing migrate');
  process.exit(2);
}
if (port !== '5432') {
  console.error('[W3-MIGRATE] ABORT: port must be 5432. Got', port);
  process.exit(2);
}
if (db !== 'postgres') {
  console.error('[W3-MIGRATE] ABORT: database must be postgres. Got', db);
  process.exit(2);
}
if (String(connectionString).includes('dincouture') || String(connectionString).includes('72.62')) {
  console.error('[W3-MIGRATE] ABORT: production marker in connection string');
  process.exit(2);
}

const FILES = [
  'migrations/20260813180000_import_fx_case_w3_advance_usd_acquisition.sql',
  'migrations/20260813180100_import_fx_case_w3_usd_acquisition_rpcs.sql',
];

const client = new pg.Client({ connectionString });
try {
  await client.connect();
} catch (e) {
  console.error('BLOCKED — LOCALHOST DATABASE NOT CONFIRMED');
  console.error(String(e?.message || e));
  process.exit(2);
}

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ DEFAULT NOW()
  );
`);

const applied = new Set(
  (await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name)
);

let ran = 0;
for (const rel of FILES) {
  const name = path.basename(rel);
  if (applied.has(name) || applied.has(rel)) {
    console.log(`[W3-MIGRATE] skip (already applied) ${name}`);
    continue;
  }
  const sql = fs.readFileSync(path.join(root, rel), 'utf8');
  console.log(`[W3-MIGRATE] applying ${name} …`);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    await client.query('COMMIT');
    ran += 1;
    console.log(`[W3-MIGRATE] OK ${name}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`[W3-MIGRATE] FAIL ${name}`, e);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log(`[W3-MIGRATE] done ran=${ran}`);
