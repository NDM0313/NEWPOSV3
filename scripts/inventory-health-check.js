/**
 * ERP Implementation Log — Phase 5: Inventory Health System
 * Detects: negative stock, missing movements, invalid variations, movement mismatch.
 * Output: docs/inventory_health_report.json
 * Usage: npm run inventory-health
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'docs', 'inventory_health_report.json');

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
  const report = {
    timestamp: new Date().toISOString(),
    connected: false,
    error: null,
    negative_stock: { by_product: [], by_variation: [], product_count: 0, variation_count: 0 },
    missing_movements: { products_with_zero_movements: [], count: 0 },
    invalid_variations: { movement_variation_not_found: [], count: 0 },
    movement_mismatch: { products_where_stock_differs_from_column: [], count: 0 },
  };

  if (!connectionString) {
    report.error = 'No DATABASE_URL in .env.local';
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log('[inventory-health] No DB URL — wrote stub to', outPath);
    return;
  }

  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    report.connected = true;
  } catch (connectErr) {
    report.error = connectErr.message || String(connectErr);
    if (connectErr.detail) report.error_detail = connectErr.detail;
    if (connectErr.hint) report.error_hint = connectErr.hint;
    if (connectErr.code) report.error_code = connectErr.code;
    console.error('[inventory-health] DB connect failed:', report.error, report.error_detail || '', report.error_hint || '');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log('[inventory-health] Wrote', outPath, '(connection failed)');
    return;
  }
  try {

    const q = (sql, params) => client.query(sql, params).catch((e) => ({ rows: [], error: e.message }));

    // Negative stock by product
    const negProduct = await q(`
      SELECT product_id, SUM(quantity) AS total FROM stock_movements GROUP BY product_id HAVING SUM(quantity) < 0 LIMIT 200
    `);
    report.negative_stock.by_product = negProduct.rows || [];
    report.negative_stock.product_count = (negProduct.rows || []).length;

    // Negative stock by variation (where variation_id is set)
    const negVar = await q(`
      SELECT variation_id, product_id, SUM(quantity) AS total
      FROM stock_movements WHERE variation_id IS NOT NULL
      GROUP BY variation_id, product_id HAVING SUM(quantity) < 0 LIMIT 200
    `);
    report.negative_stock.by_variation = negVar.rows || [];
    report.negative_stock.variation_count = (negVar.rows || []).length;

    // Products with zero movements (active products with no rows in stock_movements) — sample
    const zeroMov = await q(`
      SELECT p.id, p.name, p.sku FROM products p
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
      WHERE p.is_active = true AND sm.id IS NULL
      LIMIT 100
    `);
    report.missing_movements.products_with_zero_movements = (zeroMov.rows || []).slice(0, 50);
    report.missing_movements.count = (zeroMov.rows || []).length;

    // Movements with variation_id that doesn't exist in product_variations
    const invalidVar = await q(`
      SELECT sm.variation_id, sm.product_id, COUNT(*) AS cnt
      FROM stock_movements sm
      LEFT JOIN product_variations pv ON pv.id = sm.variation_id
      WHERE sm.variation_id IS NOT NULL AND pv.id IS NULL
      GROUP BY sm.variation_id, sm.product_id
      LIMIT 100
    `);
    report.invalid_variations.movement_variation_not_found = invalidVar.rows || [];
    report.invalid_variations.count = (invalidVar.rows || []).length;

    // Movement mismatch: only if products table has current_stock column
    const hasCurrentStock = await client.query(`
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'current_stock'
    `);
    if ((hasCurrentStock.rows || []).length > 0) {
      const mismatch = await q(`
        WITH movement_stock AS (
          SELECT product_id, SUM(quantity) AS movement_total FROM stock_movements GROUP BY product_id
        )
        SELECT p.id, p.current_stock AS column_stock, COALESCE(ms.movement_total, 0) AS movement_stock
        FROM products p
        LEFT JOIN movement_stock ms ON ms.product_id = p.id
        WHERE p.current_stock IS DISTINCT FROM COALESCE(ms.movement_total, 0)
        LIMIT 100
      `);
      report.movement_mismatch.products_where_stock_differs_from_column = mismatch.rows || [];
      report.movement_mismatch.count = (mismatch.rows || []).length;
    } else {
      report.movement_mismatch.note = 'products.current_stock column not present; skip mismatch check';
    }
  } catch (err) {
    report.error = err.message || String(err);
    if (err.detail) report.error_detail = err.detail;
    if (err.hint) report.error_hint = err.hint;
    console.error('[inventory-health]', report.error, report.error_detail || '', report.error_hint || '');
  } finally {
    await client.end();
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('[inventory-health] Wrote', outPath);
}

run();
