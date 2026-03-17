/**
 * Issue 07: Verify Sales Profit report – revenue from sales.total, cost from line items.
 * NEW BUSINESS: c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee
 * OLD BUSINESS: eb71d817-b87e-4195-964b-7b5321b480f5
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
  console.log('No DATABASE_URL');
  process.exit(0);
}

const NEW_BUSINESS = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
const OLD_BUSINESS = 'eb71d817-b87e-4195-964b-7b5321b480f5';

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    const start = '2020-01-01';
    const end = '2026-12-31';

    for (const [label, companyId] of [
      ['NEW BUSINESS (c37b77cc)', NEW_BUSINESS],
      ['OLD BUSINESS (eb71d817)', OLD_BUSINESS],
    ]) {
      console.log('\n---', label, '---');

      const salesRes = await client.query(
        `SELECT s.id, s.invoice_no, s.invoice_date, s.total, c.name AS customer_name
         FROM sales s
         LEFT JOIN contacts c ON c.id = s.customer_id
         WHERE s.company_id = $1 AND s.status = 'final'
           AND s.invoice_date >= $2 AND s.invoice_date <= $3
         ORDER BY s.invoice_date DESC
         LIMIT 20`,
        [companyId, start, end]
      );
      const sales = salesRes.rows || [];
      if (sales.length === 0) {
        console.log('No final sales in range. Total revenue: 0, cost: 0, profit: 0.');
        continue;
      }

      const saleIds = sales.map((s) => s.id);
      let items = [];
      const hasSalesItems = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_items'`
      );
      const itemsTable = hasSalesItems.rows?.length ? 'sales_items' : 'sale_items';
      const itemsRes = await client.query(
        `SELECT si.sale_id, si.quantity, si.unit_price, si.total, si.product_id,
                COALESCE(p.cost_price, 0) AS cost_price
         FROM ${itemsTable} si
         LEFT JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ANY($1::uuid[])`,
        [saleIds]
      );
      items = itemsRes.rows || [];

      const costBySale = {};
      saleIds.forEach((id) => (costBySale[id] = 0));
      items.forEach((row) => {
        const costPerUnit = Number(row.cost_price) || 0;
        const cost = costPerUnit * (Number(row.quantity) || 0);
        costBySale[row.sale_id] = (costBySale[row.sale_id] || 0) + cost;
      });

      let totalRevenue = 0;
      let totalCost = 0;
      sales.forEach((s) => {
        const revenue = Number(s.total) ?? 0;
        const cost = costBySale[s.id] ?? 0;
        totalRevenue += revenue;
        totalCost += cost;
      });
      const totalProfit = totalRevenue - totalCost;

      console.log('Sales in range:', sales.length);
      console.log('Total revenue (from sales.total):', totalRevenue.toFixed(2));
      console.log('Total cost (from line items × product cost):', totalCost.toFixed(2));
      console.log('Total profit:', totalProfit.toFixed(2));

      if (sales.length > 0) {
        const sample = sales[0];
        const rev = Number(sample.total) ?? 0;
        const cost = costBySale[sample.id] ?? 0;
        console.log('\nSample sale:', sample.invoice_no, '| date:', sample.invoice_date, '| revenue:', rev.toFixed(2), '| cost:', cost.toFixed(2), '| profit:', (rev - cost).toFixed(2));
      }
    }
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
