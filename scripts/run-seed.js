/**
 * Run fresh_data_seed.sql against the database using DATABASE_POOLER_URL or DATABASE_URL.
 * Usage: node scripts/run-seed.js
 * Env: Load .env.local from project root (or set DATABASE_POOLER_URL / DATABASE_URL).
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Load .env.local into process.env
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
  console.error('Missing DATABASE_POOLER_URL or DATABASE_URL. Set in .env.local or environment.');
  process.exit(1);
}

const seedPath = path.join(root, 'seed', 'fresh_data_seed.sql');
if (!fs.existsSync(seedPath)) {
  console.error('Seed file not found: seed/fresh_data_seed.sql');
  process.exit(1);
}

const sql = fs.readFileSync(seedPath, 'utf8');

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('Running seed: seed/fresh_data_seed.sql');
    await client.query(sql);
    console.log('Seed completed successfully.');
  } catch (err) {
    console.error('Seed failed:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
