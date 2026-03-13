/**
 * ERP Inventory Diagnostic — Database schema and stock analysis.
 * Outputs JSON to docs/erp-inventory-diagnostic-results.json
 * Usage: node scripts/erp-inventory-diagnostic.js
 * Requires: DATABASE_URL or DATABASE_POOLER_URL or DATABASE_ADMIN_URL in .env.local
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'docs', 'erp-inventory-diagnostic-results.json');

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
  const result = {
    timestamp: new Date().toISOString(),
    connected: false,
    error: null,
    database: {},
    detection: {},
  };

  if (!connectionString) {
    result.error = 'No DATABASE_URL/DATABASE_POOLER_URL/DATABASE_ADMIN_URL in .env.local';
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
    console.log('[DIAG] No DB URL — wrote stub to', outPath);
    return;
  }

  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    result.connected = true;
  } catch (connectErr) {
    result.error = connectErr.message || String(connectErr);
    if (connectErr.detail) result.error_detail = connectErr.detail;
    if (connectErr.hint) result.error_hint = connectErr.hint;
    if (connectErr.code) result.error_code = connectErr.code;
    console.error('[DIAG] DB connect failed:', result.error, result.error_detail || '', result.error_hint || '');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
    console.log('[DIAG] Wrote', outPath, '(connection failed)');
    return;
  }
  try {

    const q = (sql, label) => {
      try {
        return client.query(sql);
      } catch (e) {
        result.database[label] = { error: e.message };
        return { rows: [] };
      }
    };

    // 1) Table columns
    const productsCols = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' ORDER BY ordinal_position"
    );
    result.database.products_columns = productsCols.rows || [];

    const pvCols = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_variations' ORDER BY ordinal_position"
    );
    result.database.product_variations_columns = pvCols.rows || [];

    const smCols = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' ORDER BY ordinal_position"
    );
    result.database.stock_movements_columns = smCols.rows || [];

    const ibExists = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_balance'"
    );
    result.database.inventory_balance_exists = (ibExists.rows?.length ?? 0) > 0;
    if (result.database.inventory_balance_exists) {
      const ibCols = await client.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_balance' ORDER BY ordinal_position"
      );
      result.database.inventory_balance_columns = ibCols.rows || [];
    }

    // 2) Triggers on stock_movements / products
    const triggers = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table, action_statement
      FROM information_schema.triggers
      WHERE event_object_table IN ('stock_movements', 'products')
      ORDER BY event_object_table, trigger_name
    `);
    result.database.triggers = triggers.rows || [];

    // 3) Functions related to stock/inventory
    const funcs = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND (routine_name ILIKE '%stock%' OR routine_name ILIKE '%inventory%' OR routine_name ILIKE '%movement%')
      ORDER BY routine_name
    `);
    result.database.functions = funcs.rows || [];

    // 4) Stock by variation_id (if column exists)
    const hasVariationId = (smCols.rows || []).some((r) => r.column_name === 'variation_id');
    if (hasVariationId) {
      const byVar = await q(`
        SELECT variation_id, product_id, SUM(quantity) AS stock
        FROM stock_movements
        GROUP BY variation_id, product_id
        LIMIT 500
      `, 'aggregate_by_variation');
      result.database.aggregate_by_variation = (byVar.rows || []).slice(0, 100);
      const negative = await q(`
        SELECT variation_id, product_id, SUM(quantity) AS stock
        FROM stock_movements
        GROUP BY variation_id, product_id
        HAVING SUM(quantity) < 0
        LIMIT 100
      `, 'negative_stock_variation');
      result.detection.negative_stock_variation_count = (negative.rows || []).length;
      const nullVar = await q(`
        SELECT COUNT(*) AS c FROM stock_movements WHERE variation_id IS NULL
      `, 'null_variation_count');
      result.detection.null_variation_id_movements = parseInt(nullVar.rows?.[0]?.c ?? '0', 10);
    }

    // 5) Stock by product_id (all movements)
    const byProduct = await q(`
      SELECT product_id, SUM(quantity) AS stock
      FROM stock_movements
      GROUP BY product_id
      HAVING SUM(quantity) < 0
      LIMIT 100
    `, 'negative_stock_product');
    result.detection.negative_stock_product_count = (byProduct.rows || []).length;

    // 6) Products without variations but with movement rows (sample)
    const productsNoVar = await q(`
      SELECT p.id FROM products p
      LEFT JOIN product_variations pv ON pv.product_id = p.id
      WHERE pv.id IS NULL
      LIMIT 500
    `, 'products_without_variations');
    const ids = (productsNoVar.rows || []).map((r) => r.id).filter(Boolean);
    if (ids.length > 0) {
      const movCount = await client.query(
        `SELECT product_id, COUNT(*) AS cnt FROM stock_movements WHERE product_id = ANY($1::uuid[]) GROUP BY product_id LIMIT 50`,
        [ids.slice(0, 100)]
      ).catch(() => ({ rows: [] }));
      result.detection.products_without_variations_with_movements = (movCount.rows || []).length;
    }

    // 6b) Triggers on purchases (for PATCH/finalize debugging)
    const purchasesTriggers = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'purchases'
      ORDER BY trigger_name
    `);
    result.database.purchases_triggers = purchasesTriggers.rows || [];

    // 7) purchase_items / sale_items columns (if exist)
    try {
      const piCols = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_items' ORDER BY ordinal_position"
      );
      result.database.purchase_items_columns = (piCols.rows || []).map((r) => r.column_name);
    } catch (e) {
      result.database.purchase_items_columns = { error: e.message };
    }
    try {
      const siCols = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND (table_name = 'sale_items' OR table_name = 'sales_items') ORDER BY table_name, ordinal_position"
      );
      result.database.sale_items_columns = (siCols.rows || []).map((r) => r.column_name);
    } catch (e) {
      result.database.sale_items_columns = { error: e.message };
    }

  } catch (err) {
    result.error = err.message || String(err);
    if (err.detail) result.error_detail = err.detail;
    if (err.hint) result.error_hint = err.hint;
    console.error('[DIAG]', result.error, result.error_detail || '', result.error_hint || '');
  } finally {
    await client.end();
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log('[DIAG] Wrote', outPath);
}

run();
