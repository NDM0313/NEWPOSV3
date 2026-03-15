/**
 * Run Phase 4 legacy apply SQL against Supabase (manual backfill, supplier cleanup, worker cleanup).
 * Uses DATABASE_URL / DATABASE_POOLER_URL / DATABASE_ADMIN_URL from .env.local.
 * Usage: node scripts/run-phase4-apply.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const auditDir = path.join(root, 'docs', 'audit');

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

const connectionString =
  process.env.DATABASE_ADMIN_URL ||
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error('No DATABASE_URL / DATABASE_POOLER_URL / DATABASE_ADMIN_URL in .env.local');
  process.exit(1);
}

/** Run a single SQL file as one statement (for CTE + INSERT/UPDATE scripts) */
async function runSqlFile(client, name) {
  const filePath = path.join(auditDir, name);
  if (!fs.existsSync(filePath)) {
    console.log('[SKIP]', name, '(file not found)');
    return { ok: true, skipped: true };
  }
  const sql = fs.readFileSync(filePath, 'utf8').trim();
  if (!sql) {
    console.log('[SKIP]', name, '(empty)');
    return { ok: true, skipped: true };
  }
  try {
    const res = await client.query(sql);
    const rows = res.rowCount ?? (res.rows && res.rows.length);
    console.log('[OK]', name, rows != null ? rows + ' row(s) affected' : '');
    return { ok: true, rowCount: rows };
  } catch (err) {
    console.error('[ERROR]', name, err.message);
    return { ok: false, error: err.message };
  }
}

async function main() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('Phase 4 apply — connected to Supabase\n');

    // 1) Manual backfill apply
    const r1 = await runSqlFile(client, 'legacy_manual_payment_backfill_apply.sql');
    if (!r1.ok) {
      await client.end();
      process.exit(1);
    }

    // 2) Supplier cleanup apply (idempotent; 0 rows if already clean)
    await runSqlFile(client, 'legacy_supplier_payment_cleanup_apply.sql');

    // 3) Worker cleanup apply (idempotent; 0 rows if already clean)
    await runSqlFile(client, 'legacy_worker_payment_cleanup_apply.sql');

    console.log('\nPhase 4 apply complete.');
  } catch (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
