/**
 * Run ERP full health check (scripts/erp_full_health_check.sql).
 * Uses same env as migrations: .env.local → DATABASE_URL / DATABASE_POOLER_URL / DATABASE_ADMIN_URL.
 * Usage: node scripts/run-health-check.js   or   npm run health
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

const connectionString =
  process.env.DATABASE_ADMIN_URL ||
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.log('[HEALTH] No DATABASE_URL in .env.local — skipping. Set DATABASE_URL or DATABASE_POOLER_URL.');
  process.exit(0);
}

const sqlPath = path.join(__dirname, 'erp_full_health_check.sql');
if (!fs.existsSync(sqlPath)) {
  console.error('[HEALTH] File not found:', sqlPath);
  process.exit(1);
}

const fullSql = fs.readFileSync(sqlPath, 'utf8');
// Run DO block first, then SELECT on same connection so temp table is visible (pooler-safe)
const selectSql = `SELECT component AS "Component", status AS "Status", details AS "Details" FROM erp_health_result ORDER BY component`;
const sqlWithoutSelect = fullSql.includes('-- Structured report')
  ? fullSql.split('-- Structured report')[0].trim()
  : fullSql;

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.query(sqlWithoutSelect);
    const res = await client.query(selectSql);
    console.log('\n--- ERP Health Check Result ---\n');
    if (res.rows && res.rows.length) {
      console.table(res.rows);
    } else {
      console.log('(No rows; check NOTICE messages above for PASS/FAIL)');
    }
    console.log('');
  } catch (err) {
    console.error('[HEALTH] Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
