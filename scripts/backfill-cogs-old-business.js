/**
 * Issue 08: One-time backfill COGS for existing finalized sales (OLD BUSINESS).
 * Creates Dr COGS Cr Inventory journal entry for each final sale that has line-item cost but no COGS posted.
 * Safe: only inserts new JEs with reference_type='sale_cogs'; skips if already posted.
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

const OLD_BUSINESS = 'eb71d817-b87e-4195-964b-7b5321b480f5';

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    const hasSalesItems = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_items'`
    );
    const itemsTable = hasSalesItems.rows?.length ? 'sales_items' : 'sale_items';

    const sales = await client.query(
      `SELECT s.id, s.invoice_no, s.company_id, s.branch_id
       FROM sales s
       WHERE s.company_id = $1 AND s.status = 'final'
       ORDER BY s.invoice_date`,
      [OLD_BUSINESS]
    );
    if (!sales.rows?.length) {
      console.log('No final sales for OLD BUSINESS.');
      return;
    }

    const cogsAccount = await client.query(
      `SELECT id, name FROM accounts WHERE company_id = $1 AND code = '5000' AND is_active = true LIMIT 1`,
      [OLD_BUSINESS]
    );
    const invAccount = await client.query(
      `SELECT id, name FROM accounts WHERE company_id = $1 AND code = '1200' AND is_active = true LIMIT 1`,
      [OLD_BUSINESS]
    );
    const cogsId = cogsAccount.rows?.[0]?.id;
    let invId = invAccount.rows?.[0]?.id;
    const cogsName = cogsAccount.rows?.[0]?.name || 'Cost of Production';
    let invName = invAccount.rows?.[0]?.name || 'Inventory';
    if (!cogsId) {
      console.log('COGS (5000) account missing. Create account first.');
      return;
    }
    if (!invId) {
      try {
        await client.query(
          `INSERT INTO accounts (id, company_id, code, name, type, is_active) 
           VALUES (gen_random_uuid(), $1, '1200', 'Inventory', 'asset', true)`,
          [OLD_BUSINESS]
        );
      } catch (e) {
        // Ignore duplicate
      }
      const newInv = await client.query(`SELECT id, name FROM accounts WHERE company_id = $1 AND code = '1200' LIMIT 1`, [OLD_BUSINESS]);
      invId = newInv.rows?.[0]?.id;
      invName = newInv.rows?.[0]?.name || 'Inventory';
      if (!invId) {
        console.log('Could not create Inventory (1200) account.');
        return;
      }
      console.log('Created Inventory (1200) account for OLD BUSINESS.');
    }

    let created = 0;
    let skipped = 0;
    for (const sale of sales.rows) {
      const existing = await client.query(
        `SELECT 1 FROM journal_entries WHERE company_id = $1 AND reference_type = 'sale_cogs' AND reference_id = $2 LIMIT 1`,
        [sale.company_id, sale.id]
      );
      if (existing.rows?.length) {
        skipped++;
        continue;
      }

      const items = await client.query(
        `SELECT si.quantity, COALESCE(p.cost_price, 0) AS cost_price
         FROM ${itemsTable} si
         LEFT JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = $1`,
        [sale.id]
      );
      let totalCogs = 0;
      (items.rows || []).forEach((r) => {
        totalCogs += (Number(r.quantity) || 0) * (Number(r.cost_price) || 0);
      });
      totalCogs = Math.round(totalCogs * 100) / 100;
      if (totalCogs <= 0) {
        skipped++;
        continue;
      }

      const entryNo = `JE-COGS-${sale.invoice_no}-${Date.now()}`;
      const entryDate = new Date().toISOString().slice(0, 10);
      const jeRes = await client.query(
        `INSERT INTO journal_entries (id, company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'sale_cogs', $6)
         RETURNING id`,
        [sale.company_id, sale.branch_id || null, entryNo, entryDate, `COGS backfill – ${sale.invoice_no}`, sale.id]
      );
      const jeId = jeRes.rows[0].id;
      const hasAccountName = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journal_entry_lines' AND column_name = 'account_name'`
      );
      if (hasAccountName.rows?.length) {
        await client.query(
          `INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, account_name, debit, credit, description)
           VALUES (gen_random_uuid(), $1, $2, $7, $3, 0, $4), (gen_random_uuid(), $1, $5, $8, 0, $3, $6)`,
          [jeId, cogsId, totalCogs, `Cost of Goods Sold – ${sale.invoice_no}`, invId, `Inventory – sale ${sale.invoice_no}`, cogsName, invName]
        );
      } else {
        await client.query(
          `INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit, description)
           VALUES (gen_random_uuid(), $1, $2, $3, 0, $4), (gen_random_uuid(), $1, $5, 0, $3, $6)`,
          [jeId, cogsId, totalCogs, `Cost of Goods Sold – ${sale.invoice_no}`, invId, `Inventory – sale ${sale.invoice_no}`]
        );
      }
      created++;
    }
    console.log('Backfill COGS OLD BUSINESS: created', created, 'entries, skipped', skipped);
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
