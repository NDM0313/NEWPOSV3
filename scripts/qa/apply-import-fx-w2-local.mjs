/**
 * Apply Import FX W2 ARRANGEMENT enrichment ONLY to localhost / 127.0.0.1
 * from .env.db.local. Never loads .env.local (production).
 *
 * Usage: node scripts/qa/apply-import-fx-w2-local.mjs
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
console.log(`[W2-MIGRATE] Resolved host=${host} port=${port} database=${db}`);
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error('[W2-MIGRATE] ABORT: host is not localhost — refusing migrate');
  process.exit(2);
}
if (port !== '5432') {
  console.error('[W2-MIGRATE] ABORT: port must be 5432 (newposv3-local-pg). Got', port);
  process.exit(2);
}
if (db !== 'postgres') {
  console.error('[W2-MIGRATE] ABORT: database must be postgres. Got', db);
  process.exit(2);
}
if (String(connectionString).includes('dincouture') || String(connectionString).includes('72.62')) {
  console.error('[W2-MIGRATE] ABORT: production marker in connection string');
  process.exit(2);
}

const FILES = [
  'migrations/20260812140000_import_fx_case_arrangement_enrichment_w2.sql',
  'migrations/20260812140100_import_fx_case_attachment_metadata_rpc_w2.sql',
];

const W1_REQUIRED = [
  '20260811230000_import_fx_case_stage_persistence_w1.sql',
  '20260812050000_import_fx_case_table_privilege_lockdown_w1.sql',
];

const client = new pg.Client({ connectionString });
try {
  await client.connect();
} catch (e) {
  console.error('BLOCKED — LOCALHOST DATABASE NOT CONFIRMED');
  console.error('Could not connect to localhost:5432/postgres (container newposv3-local-pg not proven).');
  process.exit(2);
}
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ DEFAULT NOW()
  );
`);

const appliedRows = (await client.query('SELECT name FROM schema_migrations ORDER BY name')).rows;
const applied = new Set(appliedRows.map((r) => r.name));
console.log(`[W2-MIGRATE] schema_migrations count=${appliedRows.length}`);

const missingW1 = W1_REQUIRED.filter((n) => !applied.has(n) && !applied.has(`migrations/${n}`));
if (missingW1.length) {
  console.error('[W2-MIGRATE] ABORT: W1 chain incomplete. Missing:');
  for (const n of missingW1) console.error('  -', n);
  await client.end();
  process.exit(1);
}

let ran = 0;
for (const rel of FILES) {
  const name = path.basename(rel);
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error('[MISSING]', rel);
    await client.end();
    process.exit(1);
  }
  if (applied.has(name) || applied.has(rel)) {
    console.log('[SKIP]', name);
    continue;
  }
  console.log('[RUN]', name);
  const sql = fs.readFileSync(full, 'utf8');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    console.log('[OK]', name);
    ran += 1;
  } catch (e) {
    console.error('[FAIL]', name, e.message);
    if (e.detail) console.error('Detail:', e.detail);
    await client.end();
    process.exit(1);
  }
}

const after = (await client.query(
  `SELECT name FROM schema_migrations WHERE name LIKE '%import_fx_case%w2%' OR name LIKE '%arrangement_enrichment_w2%' OR name LIKE '%attachment_metadata_rpc_w2%' ORDER BY name`
)).rows;
console.log(`[W2-MIGRATE] Done. Applied ${ran} new file(s) on ${host}:${port}/${db}`);
for (const r of after) console.log('[W2-MIG]', r.name);
await client.end();
