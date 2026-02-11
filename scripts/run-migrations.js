/**
 * Auto-apply SQL migrations using DATABASE_POOLER_URL or DATABASE_URL (PSQL access).
 * Usage: node scripts/run-migrations.js
 * Env: .env.local (or set DATABASE_POOLER_URL / DATABASE_URL).
 *
 * Creates schema_migrations table to track applied migrations; runs pending
 * migrations from supabase-extract/migrations in filename order.
 * Skips: 01_full_database_wipe, 14_demo_dummy_data, 15_demo_reset_script,
 *        cleanup_demo_data, controlled_demo_seed (dangerous / demo-only).
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'supabase-extract', 'migrations');

const SKIP_FILES = new Set([
  '01_full_database_wipe.sql',
  '14_demo_dummy_data.sql',
  '15_demo_reset_script.sql',
  'cleanup_demo_data.sql',
  'controlled_demo_seed.sql',
]);

// If DB was set up before this runner existed, mark these as already applied so only 19+ run
const BOOTSTRAP_APPLIED = [
  '02_clean_erp_schema.sql', '03_frontend_driven_schema.sql', '04_create_default_accounts.sql',
  '05_inventory_movement_engine.sql', '06_purchase_transaction_with_accounting.sql',
  '07_sale_transaction_with_accounting.sql', '08_payment_engine.sql',
  '09_contact_groups.sql', '09_expense_transaction.sql', '10_ledger_calculations.sql',
  '11_returns_cancellation.sql', '12_accounting_reports.sql', '13_create_demo_company.sql',
  '16_chart_of_accounts.sql', '17_accounts_description.sql', '18_branches_default_accounts.sql',
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
  console.log('[MIGRATE] No DATABASE_POOLER_URL/DATABASE_URL in .env.local — skipping migrations. App will start without applying migrations.');
  process.exit(0);
}

if (!fs.existsSync(migrationsDir)) {
  console.error('Migrations folder not found:', migrationsDir);
  process.exit(1);
}

const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.query(CREATE_MIGRATIONS_TABLE);

    const { rows: existing } = await client.query('SELECT name FROM schema_migrations');
    if (existing.length === 0) {
      console.log('[BOOTSTRAP] Marking pre-existing migrations (02–18) as applied…');
      for (const name of BOOTSTRAP_APPLIED) {
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
      }
      console.log('[BOOTSTRAP] Done.');
    }

    const { rows: applied } = await client.query('SELECT name FROM schema_migrations');
    const appliedSet = new Set(applied.map((r) => r.name));

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && !SKIP_FILES.has(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    let runCount = 0;
    for (const file of files) {
      const name = file;
      if (appliedSet.has(name)) {
        console.log('[SKIP]', name, '(already applied)');
        continue;
      }
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      if (!sql.trim()) {
        console.log('[SKIP]', name, '(empty)');
        continue;
      }
      console.log('[RUN]', name);
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        appliedSet.add(name);
        runCount++;
        console.log('[OK]', name);
      } catch (err) {
        console.error('[FAIL]', name, err.message);
        if (err.detail) console.error('Detail:', err.detail);
        await client.end();
        process.exit(1);
      }
    }

    console.log('');
    console.log('Migrations complete. Applied', runCount, 'new migration(s).');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
