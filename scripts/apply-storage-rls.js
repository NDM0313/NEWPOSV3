/**
 * Apply storage RLS policies (payment-attachments + product-images).
 * Uses DATABASE_POOLER_URL or DATABASE_URL from .env.local.
 *
 * Usage: npm run apply-storage-rls
 *
 * Fix options when storage upload is blocked by RLS:
 *   (1) VPS: cd /root/NEWPOSV3 && bash deploy/deploy.sh — RLS applies automatically.
 *   (2) Supabase Dashboard → SQL Editor → run RUN_THIS_FOR_STORAGE_RLS.sql (and
 *       RUN_PRODUCT_IMAGES_STORAGE_RLS.sql if product image uploads fail).
 *   (3) Local: npm run apply-storage-rls (set DATABASE_URL or DATABASE_POOLER_URL in .env.local).
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'supabase-extract', 'migrations');

const SQL_FILES = [
  'RUN_THIS_FOR_STORAGE_RLS.sql',
  'RUN_PRODUCT_IMAGES_STORAGE_RLS.sql',
];

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
// Hint: ensure this DB is the SAME project as your app (check Supabase project URL vs host in .env.local)
try {
  const u = new URL(connectionString.replace(/^postgresql:\/\//, 'https://'));
  console.log('[apply-storage-rls] Using DB host:', u.hostname);
} catch (_) {}

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    for (const file of SQL_FILES) {
      const sqlPath = path.join(migrationsDir, file);
      if (!fs.existsSync(sqlPath)) {
        console.warn('[apply-storage-rls] Skip (not found):', file);
        continue;
      }
      const sql = fs.readFileSync(sqlPath, 'utf8').trim();
      if (!sql) {
        console.warn('[apply-storage-rls] Skip (empty):', file);
        continue;
      }
      console.log('[apply-storage-rls] Applying', file, '...');
      await client.query(sql);
    }
    console.log('[apply-storage-rls] Done. Storage RLS (payment-attachments + product-images) updated.');
  } catch (err) {
    console.error('[apply-storage-rls] Error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
