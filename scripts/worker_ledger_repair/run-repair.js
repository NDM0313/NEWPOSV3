/**
 * Auto-apply worker ledger repair SQL (company eb71d817-b87e-4195-964b-7b5321b480f5).
 * Uses same DB connection as run-migrations.js (DATABASE_ADMIN_URL / DATABASE_POOLER_URL / DATABASE_URL from .env.local).
 * Usage: npm run worker-ledger-repair   OR   node scripts/worker_ledger_repair/run-repair.js
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

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
  console.error('[worker-ledger-repair] No DATABASE_ADMIN_URL/DATABASE_POOLER_URL/DATABASE_URL in .env.local');
  process.exit(1);
}

const repairPath = path.join(__dirname, '02_repair_backfill_company.sql');
if (!fs.existsSync(repairPath)) {
  console.error('[worker-ledger-repair] File not found:', repairPath);
  process.exit(1);
}

const sql = fs.readFileSync(repairPath, 'utf8');
if (!sql.trim()) {
  console.error('[worker-ledger-repair] SQL file is empty');
  process.exit(1);
}

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('[worker-ledger-repair] Applying repair SQL (company eb71d817-b87e-4195-964b-7b5321b480f5)…');
    const res = await client.query(sql);
    const lastResult = Array.isArray(res) ? res[res.length - 1] : res;
    if (lastResult?.rows?.length) {
      console.log('[worker-ledger-repair] Ambiguous rows (manual review):', lastResult.rows.length);
      lastResult.rows.forEach((r, i) => console.log(' ', i + 1, r.journal_entry_id, r.entry_no, r.entry_date, r.description?.slice(0, 40)));
    } else {
      console.log('[worker-ledger-repair] Done. No ambiguous rows, or repair had no output.');
    }
    console.log('[worker-ledger-repair] OK.');
  } catch (err) {
    console.error('[worker-ledger-repair] Error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
