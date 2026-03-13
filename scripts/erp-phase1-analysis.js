/**
 * ERP Implementation Log — Phase 1: System Analysis
 * Writes: docs/db_schema_snapshot.json, docs/db_triggers_snapshot.json, docs/inventory_anomaly_report.json
 * Requires: DATABASE_URL or DATABASE_POOLER_URL or DATABASE_ADMIN_URL in .env.local
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const docsDir = path.join(root, 'docs');

const TABLES = [
  'products',
  'product_variations',
  'stock_movements',
  'inventory_balance',
  'purchases',
  'purchase_items',
  'sales',
  'sale_items',
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

const connectionString =
  process.env.DATABASE_ADMIN_URL ||
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL;

async function run() {
  if (!connectionString) {
    console.warn('[Phase1] No DB URL — writing stub files.');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'db_schema_snapshot.json'), JSON.stringify({ error: 'No DATABASE_URL' }, null, 2));
    fs.writeFileSync(path.join(docsDir, 'db_triggers_snapshot.json'), JSON.stringify({ error: 'No DATABASE_URL' }, null, 2));
    fs.writeFileSync(path.join(docsDir, 'inventory_anomaly_report.json'), JSON.stringify({ error: 'No DATABASE_URL' }, null, 2));
    return;
  }

  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
  } catch (connectErr) {
    const msg = connectErr.message || String(connectErr);
    const detail = connectErr.detail || connectErr.hint || '';
    console.error('[Phase1] DB connect failed:', msg, detail ? `(${detail})` : '');
    fs.mkdirSync(docsDir, { recursive: true });
    const stub = { error: msg, detail: connectErr.detail, hint: connectErr.hint, code: connectErr.code };
    fs.writeFileSync(path.join(docsDir, 'db_schema_snapshot.json'), JSON.stringify(stub, null, 2));
    fs.writeFileSync(path.join(docsDir, 'db_triggers_snapshot.json'), JSON.stringify(stub, null, 2));
    fs.writeFileSync(path.join(docsDir, 'inventory_anomaly_report.json'), JSON.stringify(stub, null, 2));
    return;
  }
  try {

    const schema = { timestamp: new Date().toISOString(), tables: {}, table_list: [] };
    const { rows: tableList } = await client.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name
    `);
    schema.table_list = (tableList || []).map((r) => r.table_name);

    for (const table of TABLES) {
      const { rows } = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table]
      );
      schema.tables[table] = rows || [];
    }
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'db_schema_snapshot.json'), JSON.stringify(schema, null, 2));
    console.log('[Phase1] Wrote docs/db_schema_snapshot.json');

    const { rows: triggers } = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      ORDER BY event_object_table, trigger_name
    `);
    fs.writeFileSync(path.join(docsDir, 'db_triggers_snapshot.json'), JSON.stringify({ timestamp: new Date().toISOString(), triggers: triggers || [] }, null, 2));
    console.log('[Phase1] Wrote docs/db_triggers_snapshot.json');

    const { rows: stockRoutines } = await client.query(`
      SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name ILIKE '%stock%' ORDER BY routine_name
    `);

    let variationSum = [];
    let negativeProduct = [];
    try {
      const v = await client.query(`SELECT variation_id, SUM(quantity) AS total FROM stock_movements GROUP BY variation_id LIMIT 500`);
      variationSum = v.rows || [];
    } catch (e) {
      variationSum = { error: e.message };
    }
    try {
      const n = await client.query(`
        SELECT product_id, SUM(quantity) AS total FROM stock_movements GROUP BY product_id HAVING SUM(quantity) < 0
      `);
      negativeProduct = n.rows || [];
    } catch (e) {
      negativeProduct = { error: e.message };
    }

    const anomaly = {
      timestamp: new Date().toISOString(),
      stock_functions: (stockRoutines || []).map((r) => r.routine_name),
      variation_sum_sample: variationSum,
      negative_stock_products: negativeProduct,
    };
    fs.writeFileSync(path.join(docsDir, 'inventory_anomaly_report.json'), JSON.stringify(anomaly, null, 2));
    console.log('[Phase1] Wrote docs/inventory_anomaly_report.json');
  } catch (err) {
    const msg = err.message || String(err);
    console.error('[Phase1]', msg, err.detail ? `— ${err.detail}` : '', err.hint ? `(${err.hint})` : '');
  } finally {
    await client.end();
  }
}

run();
