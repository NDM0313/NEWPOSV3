/**
 * STEP 11 — Test manufacturing accounting (test DB only).
 * 1) Applies all migrations in migrations/test/ for studio manufacturing.
 * 2) Runs validation queries from scripts/validate_inventory_accounting.sql.
 * Env: .env.local — tries TEST_DATABASE_URL, DATABASE_URL, DATABASE_POOLER_URL (use pooler if direct fails with ENOTFOUND).
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

// Try pooler first (often fixes ENOTFOUND), then direct
const connectionCandidates = [
  process.env.DATABASE_POOLER_URL,
  process.env.TEST_DATABASE_URL,
  process.env.DATABASE_URL,
  process.env.DATABASE_ADMIN_URL,
].filter(Boolean);

if (connectionCandidates.length === 0) {
  console.error('Set DATABASE_URL or DATABASE_POOLER_URL in .env.local');
  console.error('If you get ENOTFOUND: add DATABASE_POOLER_URL from Supabase Dashboard → Project Settings → Database → Connection pooling → URI');
  process.exit(1);
}

const testMigrationsDir = path.join(root, 'migrations', 'test');
const manufacturingOrder = [
  'create_manufacturing_accounts.sql',
  'calculate_production_cost.sql',
  'studio_finished_goods_inventory_and_journal.sql',
  'sale_final_cogs_journal_test.sql',
  'manufacturing_risk_controls_test.sql',
  'fix_production_cost_calculation.sql', // production cost fix + backfill + safety
  'repair_missing_production_stock_movements.sql', // backfill missing PRODUCTION movements
];

async function run() {
  let client;
  let lastErr;
  for (const conn of connectionCandidates) {
    client = new pg.Client({ connectionString: conn });
    try {
      await client.connect();
      console.log('Connected (using ' + (conn.includes('pooler') ? 'pooler' : 'direct') + ' URL).\n');
      break;
    } catch (e) {
      lastErr = e;
      await client.end().catch(() => {});
      client = null;
      if (e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED') {
        console.warn('Connection failed:', e.message, '- trying next URL...');
        continue;
      }
      throw e;
    }
  }
  if (!client) {
    console.error('Could not connect to database.');
    console.error('Error:', lastErr?.message || lastErr);
    if (lastErr?.code === 'ENOTFOUND') {
      console.error('\nFix: Use Supabase Connection pooler URL in .env.local:');
      console.error('  1. Supabase Dashboard → Project Settings → Database');
      console.error('  2. Connection string → "Connection pooling" → URI');
      console.error('  3. Set DATABASE_POOLER_URL= that URI (or DATABASE_URL= that URI)');
    }
    process.exit(1);
  }
  try {
    console.log('Applying test manufacturing migrations...\n');

    for (const file of manufacturingOrder) {
      const filePath = path.join(testMigrationsDir, file);
      if (!fs.existsSync(filePath)) {
        console.log('[SKIP]', file, '(not found)');
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
      console.log('[OK]', file);
    }

    console.log('\nRunning validation queries (validate_inventory_accounting.sql)...\n');
    const validatePath = path.join(root, 'scripts', 'validate_inventory_accounting.sql');
    if (fs.existsSync(validatePath)) {
      const validateSql = fs.readFileSync(validatePath, 'utf8');
      const parts = validateSql.split(/;\s*(?=SELECT|$)/).filter((p) => p.trim().startsWith('SELECT'));
      for (let i = 0; i < parts.length; i++) {
        const stmt = parts[i].trim();
        if (!stmt) continue;
        try {
          const res = await client.query(stmt + (stmt.endsWith(';') ? '' : ';'));
          console.log('Query', i + 1, ':', res.rows?.length || 0, 'rows');
          if (res.rows?.length > 0 && res.rows.length <= 5) console.log(res.rows);
        } catch (e) {
          console.warn('Validation query', i + 1, ':', e.message);
        }
      }
    }

    console.log('\nTest manufacturing accounting setup complete.');
  } catch (err) {
    console.error('Error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

run();
