/**
 * PF-05: Verify inventory valuation report data – product name/SKU resolution for NEW and OLD business.
 * Run: node scripts/pf05-verify-inventory-valuation.js
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1).replace(/\\'/g, "'");
    if (!process.env[key]) process.env[key] = val;
  }
}

const conn = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!conn) {
  console.log('No DATABASE_URL — skip.');
  process.exit(0);
}

const NEW_BUSINESS = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
const OLD_BUSINESS = 'eb71d817-b87e-4195-964b-7b5321b480f5';

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    for (const [label, companyId] of [['NEW BUSINESS', NEW_BUSINESS], ['OLD BUSINESS', OLD_BUSINESS]]) {
      console.log('\n---', label, '---');
      const r = await client.query(`
        WITH agg AS (
          SELECT product_id, SUM(quantity) AS qty
          FROM stock_movements
          WHERE company_id = $1
          GROUP BY product_id
          HAVING SUM(quantity) > 0
        )
        SELECT a.product_id, p.name AS product_name, p.sku,
               (p.name IS NULL OR TRIM(COALESCE(p.name,'')) = '') AS name_blank,
               (p.sku IS NULL OR TRIM(COALESCE(p.sku,'')) = '') AS sku_blank
        FROM agg a
        LEFT JOIN products p ON p.id = a.product_id AND p.company_id = $1
        ORDER BY a.product_id
        LIMIT 15
      `, [companyId]);
      if (r.rows.length === 0) {
        console.log('No positive stock — valuation would be empty.');
        continue;
      }
      console.table(r.rows.map((x) => ({
        product_id: x.product_id?.slice(0, 8),
        product_name: x.product_name || '(null)',
        sku: x.sku || '(null)',
        name_blank: x.name_blank,
        sku_blank: x.sku_blank,
      })));
      const blankNames = r.rows.filter((x) => x.name_blank);
      const missingProduct = r.rows.filter((x) => !x.product_name && !x.sku);
      if (blankNames.length > 0 || missingProduct.length > 0) {
        console.log('Rows with blank name:', blankNames.length, '| Missing product:', missingProduct.length);
      } else {
        console.log('All sampled rows have product name/SKU resolvable.');
      }
    }
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
