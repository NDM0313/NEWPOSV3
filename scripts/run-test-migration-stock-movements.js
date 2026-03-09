/**
 * Run test migration fix_sale_stock_movements_test.sql and validate stock movements on sale final.
 * Use TEST database only. Env: .env.local with DATABASE_ADMIN_URL, DATABASE_POOLER_URL, or DATABASE_URL.
 *
 * Usage: node scripts/run-test-migration-stock-movements.js
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
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_ADMIN_URL ||
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error('No TEST_DATABASE_URL/DATABASE_ADMIN_URL/DATABASE_POOLER_URL/DATABASE_URL in .env.local');
  process.exit(1);
}

const testMigrationPath = path.join(root, 'migrations', 'test', 'fix_sale_stock_movements_test.sql');

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('[1/4] Applying test migration: fix_sale_stock_movements_test.sql');
    const sql = fs.readFileSync(testMigrationPath, 'utf8');
    await client.query(sql);
    console.log('[1/4] Migration applied.\n');

    console.log('[2/4] Finding a non-final sale with line items...');
    let saleId = null;
    const fromSalesItems = await client.query(`
      SELECT s.id FROM sales s
      INNER JOIN sales_items si ON si.sale_id = s.id
      WHERE s.status IS DISTINCT FROM 'final' AND (s.status IS NULL OR s.status != 'final')
      LIMIT 1
    `);
    if (fromSalesItems.rows.length > 0) {
      saleId = fromSalesItems.rows[0].id;
    }
    if (!saleId) {
      const fromSaleItems = await client.query(`
        SELECT s.id FROM sales s
        INNER JOIN sale_items si ON si.sale_id = s.id
        WHERE s.status IS DISTINCT FROM 'final' AND (s.status IS NULL OR s.status != 'final')
        LIMIT 1
      `);
      if (fromSaleItems.rows.length > 0) saleId = fromSaleItems.rows[0].id;
    }
    if (!saleId) {
      console.log('[2/4] No non-final sale with items found. Skipping live validation.');
      console.log('      To validate manually: UPDATE sales SET status = \'final\' WHERE id = \'<sale_id>\';');
      console.log('      Then: SELECT * FROM stock_movements WHERE reference_type = \'sale\' AND reference_id = \'<sale_id>\';');
      return;
    }
    console.log('[2/4] Using sale_id:', saleId);

    const beforeCount = await client.query(
      'SELECT COUNT(*) AS c FROM stock_movements WHERE reference_type = $1 AND reference_id = $2',
      ['sale', saleId]
    );
    const countBefore = parseInt(beforeCount.rows[0].c, 10);

    console.log('[3/4] Setting sale to final (trigger should create stock_movements)...');
    await client.query('UPDATE sales SET status = $1 WHERE id = $2', ['final', saleId]);

    const afterCount = await client.query(
      'SELECT COUNT(*) AS c FROM stock_movements WHERE reference_type = $1 AND reference_id = $2',
      ['sale', saleId]
    );
    const countAfter = parseInt(afterCount.rows[0].c, 10);

    const movements = await client.query(
      `SELECT id, product_id, quantity, movement_type, notes FROM stock_movements
       WHERE reference_type = $1 AND reference_id = $2 ORDER BY created_at`,
      ['sale', saleId]
    );

    console.log('[4/4] Validation:');
    console.log('      stock_movements before final:', countBefore);
    console.log('      stock_movements after final:', countAfter);
    console.log('      Rows:', movements.rows.length);

    const hasSaleOut = movements.rows.some((r) => (r.movement_type || '').toLowerCase() === 'sale' && Number(r.quantity) < 0);
    if (countAfter > countBefore && hasSaleOut) {
      console.log('\nResult: PASS — Trigger created sale OUT movement(s) when sale was finalized.');
      movements.rows.forEach((r, i) => {
        console.log(`  [${i + 1}] product_id=${r.product_id} quantity=${r.quantity} type=${r.movement_type}`);
      });
    } else if (countAfter > countBefore) {
      console.log('\nResult: PARTIAL — New movements created but no SALE/negative quantity found. Check movement_type/quantity.');
      movements.rows.forEach((r, i) => {
        console.log(`  [${i + 1}] product_id=${r.product_id} quantity=${r.quantity} type=${r.movement_type}`);
      });
    } else {
      console.log('\nResult: FAIL — No new stock_movements after finalizing sale. Trigger may not have run or sale had no items.');
    }
  } catch (err) {
    console.error('Error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
