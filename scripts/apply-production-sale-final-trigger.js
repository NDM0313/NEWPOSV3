/**
 * STEP 9 — Apply sale_final_stock_movement_trigger.sql to PRODUCTION only.
 * Requires: PRODUCTION_DATABASE_URL in .env.local (must be set explicitly).
 * Do not use DATABASE_URL so production is never applied by mistake.
 *
 * Usage: node scripts/apply-production-sale-final-trigger.js
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

const connectionString = process.env.PRODUCTION_DATABASE_URL;
if (!connectionString) {
  console.error('PRODUCTION_DATABASE_URL is not set in .env.local. Refusing to run.');
  console.error('Set it explicitly to the production database connection string, then run again.');
  process.exit(1);
}

const migrationPath = path.join(root, 'migrations', 'sale_final_stock_movement_trigger.sql');

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('Applying migrations/sale_final_stock_movement_trigger.sql to PRODUCTION...');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('Done. Trigger sale_final_stock_movement_trigger is now active on sales.');
  } catch (err) {
    console.error('Error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
