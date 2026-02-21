#!/usr/bin/env node
/**
 * Export complete data from Supabase Cloud and import into VPS.
 * Usage: node scripts/cloud-to-vps-data-migrate.mjs
 *
 * Requires in env or .env.local:
 *   CLOUD_DATABASE_URL - Supabase Cloud pooler
 *   DATABASE_URL - VPS (postgres.tenant:pass@host:5432/postgres)
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
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
loadEnv();

const CLOUD_URL = process.env.CLOUD_DATABASE_URL || process.env.DATABASE_URL_CLOUD ||
  'postgresql://postgres.wrwljqzckmnmuphwhslt:khan313ndm313@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const VPS_URL = process.env.DATABASE_URL;

if (!VPS_URL) {
  console.error('DATABASE_URL (VPS) required in .env.local');
  process.exit(1);
}

// Tables in insert order (parents before children) - approximate FK order
const TABLE_ORDER = [
  'companies', 'branches', 'accounts', 'contact_groups', 'roles', 'users', 'user_branches',
  'brands', 'product_categories', 'units', 'products', 'product_variations', 'product_combos', 'product_combo_items',
  'contacts', 'expense_categories', 'document_sequences', 'settings', 'modules_config',
  'ledger_master', 'inventory_balance',
  'purchases', 'purchase_items', 'purchase_returns', 'purchase_return_items',
  'sales', 'sale_items', 'sales_items', 'sale_returns', 'sale_return_items',
  'credit_notes', 'refunds', 'payments', 'expenses',
  'journal_entries', 'journal_entry_lines', 'ledger_entries', 'worker_ledger_entries',
  'stock_movements', 'activity_logs',
  'workers', 'job_cards', 'rentals', 'rental_items', 'rental_payments',
  'studio_orders', 'studio_order_items', 'studio_productions', 'studio_production_stages', 'studio_production_logs',
  'schema_migrations'
];

function escape(val) {
  if (val === null) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number' && !isNaN(val)) return String(val);
  if (val instanceof Date) return `'${val.toISOString().replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

async function main() {
  const cloud = new pg.Client({ connectionString: CLOUD_URL });
  const vps = new pg.Client({ connectionString: VPS_URL });

  await cloud.connect();
  await vps.connect();

  // Get tables that exist in BOTH Cloud and VPS
  const { rows: cloudTables } = await cloud.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  const { rows: vpsTables } = await vps.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  const cloudSet = new Set(cloudTables.map(r => r.table_name));
  const vpsSet = new Set(vpsTables.map(r => r.table_name));
  const common = [...cloudSet].filter(t => vpsSet.has(t));
  const toExport = TABLE_ORDER.filter(t => common.includes(t));
  const extra = common.filter(t => !TABLE_ORDER.includes(t));
  toExport.push(...extra);

  const onlyCloud = [...cloudSet].filter(t => !vpsSet.has(t));
  if (onlyCloud.length) console.log('[SKIP] Tables only in Cloud (no VPS schema):', onlyCloud.join(', '));

  console.log('[EXPORT] Tables to migrate:', toExport.length);

  // Phase 1: Truncate all VPS tables (only those that exist)
  console.log('[TRUNCATE] Clearing VPS tables...');
  const truncateList = toExport.map(t => `public."${t}"`).join(', ');
  await vps.query(`TRUNCATE ${truncateList} CASCADE`);

  // Phase 2: Insert from Cloud
  console.log('[INSERT] Copying data from Cloud...');
  for (const table of toExport) {
    try {
      // Only use columns that exist in BOTH Cloud and VPS
      const { rows: cloudCols } = await cloud.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
      `, [table]);
      const { rows: vpsCols } = await vps.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
      `, [table]);
      const vpsColSet = new Set(vpsCols.map(r => r.column_name));
      const commonCols = cloudCols.map(r => r.column_name).filter(c => vpsColSet.has(c));
      if (commonCols.length === 0) {
        console.log(`  [${table}] no common columns (skip)`);
        continue;
      }

      const colList = commonCols.map(c => `"${c}"`).join(', ');
      const { rows } = await cloud.query(`SELECT ${colList} FROM public."${table}"`);
      if (rows.length === 0) {
        console.log(`  [${table}] 0 rows (skip)`);
        continue;
      }

      const inserts = rows.map(row => {
        const vals = commonCols.map(c => escape(row[c]));
        return `INSERT INTO public."${table}" (${colList}) VALUES (${vals.join(', ')})`;
      });

      for (const sql of inserts) {
        await vps.query(sql);
      }
      console.log(`  [${table}] ${rows.length} rows OK`);
    } catch (err) {
      console.error(`  [${table}] FAIL:`, err.message);
    }
  }

  await cloud.end();
  await vps.end();
  console.log('[DONE] Cloud → VPS data migration complete.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
