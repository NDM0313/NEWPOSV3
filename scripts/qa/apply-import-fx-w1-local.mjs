/**
 * Apply Import FX Path21 → Wave A → Wave 0 → W1 → history-read → security-harness → read-security
 * ONLY to localhost / 127.0.0.1 from .env.db.local.
 * Aborts if host is not local. Never loads .env.local (production).
 *
 * Usage: node scripts/qa/apply-import-fx-w1-local.mjs
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
  if (!fs.existsSync(envPath)) throw new Error('Missing .env.db.local');
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
console.log(`[QA-MIGRATE] Resolved host=${host} port=${port} database=${db}`);
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error('[QA-MIGRATE] ABORT: host is not localhost — refusing migrate');
  process.exit(2);
}
if (String(connectionString).includes('dincouture') || String(connectionString).includes('72.62')) {
  console.error('[QA-MIGRATE] ABORT: production marker in connection string');
  process.exit(2);
}

const FILES = [
  'scripts/qa/import-fx-w1-local-harness.sql',
  'migrations/20260801190000_fx_currency_purchase_schema.sql',
  'migrations/20260801190100_fx_currency_purchase_rpcs.sql',
  'migrations/20260811160000_import_fx_wave_a_server_off_checks.sql',
  'migrations/20260811160100_import_fx_wave_a_purchase_payment_fx_guards.sql',
  'migrations/20260811170000_import_fx_path21_agent_role_guards.sql',
  'migrations/20260811171000_import_fx_tt_wallet_include_party_tt.sql',
  'migrations/20260811200000_import_fx_wave0_path21_idempotency_settlement_lifecycle.sql',
  'migrations/20260811230000_import_fx_case_stage_persistence_w1.sql',
  'migrations/20260812010000_import_fx_case_create_idempotency_w1.sql',
  'migrations/20260812013000_import_fx_case_history_read_when_disabled_w1.sql',
  'scripts/qa/import-fx-w1-security-harness.sql',
  'migrations/20260812020000_import_fx_case_read_security_hardening_w1.sql',
  'migrations/20260812030000_import_fx_case_mutation_security_parity_w1.sql',
  'migrations/20260812040000_import_fx_case_attachment_security_w1.sql',
  'migrations/20260812050000_import_fx_case_table_privilege_lockdown_w1.sql',
];

const client = new pg.Client({ connectionString });
await client.connect();
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
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error('[MISSING]', rel);
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

console.log(`[QA-MIGRATE] Done. Applied ${ran} new file(s) on ${host}:${port}/${db}`);
await client.end();
