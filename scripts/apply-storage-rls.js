/**
 * Apply storage RLS policies for payment-attachments bucket (fixes journal entry uploads).
 * Uses DATABASE_POOLER_URL or DATABASE_URL from .env.local (same as run-migrations.js).
 *
 * Usage: npm run apply-storage-rls
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
  console.error('[apply-storage-rls] No DATABASE_POOLER_URL or DATABASE_URL in .env.local');
  console.error('Add one of them (e.g. postgresql://postgres.xxx:password@host:6543/postgres) and run again.');
  process.exit(1);
}

const sqlPath = path.join(root, 'supabase-extract', 'migrations', 'RUN_THIS_FOR_STORAGE_RLS.sql');
if (!fs.existsSync(sqlPath)) {
  console.error('[apply-storage-rls] SQL file not found:', sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');
if (!sql.trim()) {
  console.error('[apply-storage-rls] SQL file is empty');
  process.exit(1);
}

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('[apply-storage-rls] Applying storage RLS policies...');
    await client.query(sql);
    console.log('[apply-storage-rls] Done. payment-attachments bucket RLS is updated.');
  } catch (err) {
    console.error('[apply-storage-rls] Error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
