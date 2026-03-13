/**
 * Verify ERP stabilization migrations: RPC, payments indexes, legacy comments.
 * Usage: node scripts/erp-migration-verify.js
 * Requires: .env.local with DATABASE_URL or DATABASE_POOLER_URL or DATABASE_ADMIN_URL
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

async function run() {
  if (!connectionString) {
    console.log('No DB URL in .env.local — skip verification.');
    process.exit(0);
  }
  const client = new pg.Client({ connectionString });
  const out = { rpc: null, indexes: [], comments: [], rpcCallable: null, errors: [] };
  try {
    await client.connect();

    // 1. pg_proc for get_dashboard_metrics
    const rpcRes = await client.query(`
      SELECT p.proname AS name, pg_get_function_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'get_dashboard_metrics'
    `);
    out.rpc = rpcRes.rows[0] || null;

    // 2. Call RPC (dry run with null company_id to test existence; may return empty)
    if (out.rpc) {
      try {
        const callRes = await client.query(
          `SELECT get_dashboard_metrics($1::uuid, $2::uuid, $3::date, $4::date) AS result`,
          ['00000000-0000-0000-0000-000000000000', null, null, null]
        );
        out.rpcCallable = callRes.rows[0]?.result != null;
      } catch (e) {
        out.rpcCallable = false;
        out.errors.push('RPC call test: ' + e.message);
      }
    }

    // 3. pg_indexes for payments
    const idxRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'payments'
      ORDER BY indexname
    `);
    out.indexes = idxRes.rows;

    // 4. Table comments for sale_items, chart_accounts, document_sequences
    const commentRes = await client.query(`
      SELECT c.relname AS table_name, obj_description(c.oid, 'pg_class') AS comment
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname IN ('sale_items', 'chart_accounts', 'document_sequences')
    `);
    out.comments = commentRes.rows;

    // 5. schema_migrations for our three files
    const migRes = await client.query(`
      SELECT name, applied_at FROM schema_migrations
      WHERE name IN ('erp_payments_indexes_safe.sql', 'erp_get_dashboard_metrics_rpc.sql', 'erp_legacy_table_comments.sql')
      ORDER BY name
    `);
    out.appliedMigrations = migRes.rows;
  } catch (e) {
    out.errors.push(e.message);
  } finally {
    await client.end();
  }
  console.log(JSON.stringify(out, null, 2));
}

run();
