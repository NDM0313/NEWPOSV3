/**
 * One-time repair script via direct PostgreSQL:
 * 1. Fix duplicate sale stock movements
 * 2. Add missing shipping charges to AR journal entries
 *
 * Usage: node scripts/repair-shipping-ar-and-stock.mjs
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
loadEnv();

// Try multiple connection strings (self-hosted Supabase may use different host)
const DB_URLS = [
  process.env.DATABASE_ADMIN_URL,
  process.env.DATABASE_POOLER_URL,
  process.env.DATABASE_URL,
  // Self-hosted: try the API host on port 5432 and 6543 (pooler)
  `postgresql://postgres:${encodeURIComponent('khan313ndm313')}@supabase.dincouture.pk:5432/postgres?sslmode=disable`,
  `postgresql://postgres:${encodeURIComponent('khan313ndm313')}@supabase.dincouture.pk:6543/postgres?sslmode=disable`,
].filter(Boolean);

let client;
for (const url of DB_URLS) {
  try {
    const host = new URL(url).hostname;
    console.log(`Trying ${host}...`);
    const ssl = url.includes('sslmode=disable') ? false : { rejectUnauthorized: false };
    const c = new pg.Client({ connectionString: url, ssl, connectionTimeoutMillis: 8000 });
    await c.connect();
    client = c;
    console.log(`Connected via ${host}\n`);
    break;
  } catch (e) {
    console.log(`  Failed: ${e.message}`);
  }
}
if (!client) { console.error('Could not connect to any database. Please provide DATABASE_ADMIN_URL.'); process.exit(1); }

const COMPANY_ID = '375fa03b-8e1e-46d3-9cfe-1cc20c02b473';

async function run() {
  // ============================
  // PART 1: Fix duplicate sale stock movements
  // ============================
  console.log('=== PART 1: Fix duplicate sale stock movements ===\n');

  // 1a: Count before
  const { rows: beforeCount } = await client.query(`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE LOWER(TRIM(movement_type)) = 'sale') as sale_count,
           COUNT(*) FILTER (WHERE LOWER(TRIM(movement_type)) = 'sale_cancelled') as cancelled_count
    FROM stock_movements WHERE company_id = $1 AND reference_type = 'sale'
  `, [COMPANY_ID]);
  console.log('Before:', beforeCount[0]);

  // 1b: Remove duplicate 'sale' movements (keep oldest per product/variation per sale)
  const { rowCount: d1 } = await client.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY reference_id, product_id, COALESCE(variation_id::text, ''), LOWER(TRIM(movement_type))
        ORDER BY created_at ASC
      ) AS rn FROM stock_movements
      WHERE company_id = $1 AND reference_type = 'sale' AND LOWER(TRIM(movement_type)) = 'sale'
    ) DELETE FROM stock_movements WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
  `, [COMPANY_ID]);
  console.log(`Deleted ${d1} duplicate sale movements`);

  // 1c: Remove duplicate 'sale_cancelled'
  const { rowCount: d2 } = await client.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY reference_id, product_id, COALESCE(variation_id::text, ''), LOWER(TRIM(movement_type))
        ORDER BY created_at ASC
      ) AS rn FROM stock_movements
      WHERE company_id = $1 AND reference_type = 'sale' AND LOWER(TRIM(movement_type)) = 'sale_cancelled'
    ) DELETE FROM stock_movements WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
  `, [COMPANY_ID]);
  console.log(`Deleted ${d2} duplicate sale_cancelled movements`);

  // 1d: Remove sync artifacts (positive qty 'sale' movements)
  const { rowCount: d3 } = await client.query(`
    DELETE FROM stock_movements
    WHERE company_id = $1 AND reference_type = 'sale'
      AND LOWER(TRIM(movement_type)) = 'sale' AND quantity > 0
  `, [COMPANY_ID]);
  console.log(`Deleted ${d3} sync artifact movements (positive qty sale)`);

  // 1e: Count after
  const { rows: afterCount } = await client.query(`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE LOWER(TRIM(movement_type)) = 'sale') as sale_count,
           COUNT(*) FILTER (WHERE LOWER(TRIM(movement_type)) = 'sale_cancelled') as cancelled_count
    FROM stock_movements WHERE company_id = $1 AND reference_type = 'sale'
  `, [COMPANY_ID]);
  console.log('After:', afterCount[0]);

  // ============================
  // PART 2: Fix missing shipping in AR
  // ============================
  console.log('\n=== PART 2: Fix missing shipping charges in AR ===\n');

  const { rows: salesWithShipping } = await client.query(`
    SELECT s.id, s.invoice_no, s.total, s.shipment_charges, s.branch_id,
           je.id as je_id,
           (SELECT SUM(jel.debit) FROM journal_entry_lines jel
            JOIN accounts a ON a.id = jel.account_id
            WHERE jel.journal_entry_id = je.id AND jel.debit > 0
              AND (a.code LIKE 'AR-%' OR a.code = '1100' OR LOWER(a.type) LIKE '%receivable%')
           ) as ar_debit_in_je,
           (SELECT jel.account_id FROM journal_entry_lines jel
            JOIN accounts a ON a.id = jel.account_id
            WHERE jel.journal_entry_id = je.id AND jel.debit > 0
              AND (a.code LIKE 'AR-%' OR a.code = '1100' OR LOWER(a.type) LIKE '%receivable%')
            LIMIT 1
           ) as ar_account_id
    FROM sales s
    JOIN journal_entries je ON je.reference_type = 'sale' AND je.reference_id = s.id AND (je.is_void IS NOT TRUE)
    WHERE s.company_id = $1 AND COALESCE(s.shipment_charges, 0) > 0 AND s.status = 'final'
    ORDER BY s.created_at DESC
  `, [COMPANY_ID]);

  console.log(`Found ${salesWithShipping.length} final sales with shipping`);

  // Find Shipping Income account (4110)
  const { rows: shipAcct } = await client.query(
    `SELECT id FROM accounts WHERE company_id = $1 AND code = '4110' LIMIT 1`, [COMPANY_ID]
  );
  const shipAccountId = shipAcct[0]?.id;
  if (!shipAccountId) { console.log('No Shipping Income (4110) account found — skipping Part 2'); }

  for (const sale of salesWithShipping) {
    if (!shipAccountId) break;
    const shipping = parseFloat(sale.shipment_charges) || 0;
    const arDebit = parseFloat(sale.ar_debit_in_je) || 0;
    const expectedAr = parseFloat(sale.total) + shipping;
    const gap = Math.round((expectedAr - arDebit) * 100) / 100;

    console.log(`  ${sale.invoice_no}: total=${sale.total} ship=${shipping} AR=${arDebit} expect=${expectedAr} gap=${gap}`);

    if (gap <= 0.01) { console.log('    → OK'); continue; }
    if (!sale.ar_account_id) { console.log('    → No AR account in JE'); continue; }

    const entryNo = `JE-SHIP-REPAIR-${sale.invoice_no}`;
    const { rows: existing } = await client.query(
      `SELECT id FROM journal_entries WHERE company_id = $1 AND entry_no = $2 AND (is_void IS NOT TRUE) LIMIT 1`,
      [COMPANY_ID, entryNo]
    );
    if (existing.length) { console.log('    → Already repaired'); continue; }

    const desc = `Shipping AR correction ${sale.invoice_no}: +Rs ${gap}`;
    const { rows: newJe } = await client.query(`
      INSERT INTO journal_entries (company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit)
      VALUES ($1, $2, $3, CURRENT_DATE, $4, 'sale_adjustment', $5, $6, $6) RETURNING id
    `, [COMPANY_ID, sale.branch_id, entryNo, desc, sale.id, gap]);

    await client.query(`
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
        ($1, $2, $3, 0, $4), ($1, $5, 0, $3, $6)
    `, [newJe[0].id, sale.ar_account_id, gap, `AR shipping +Rs ${gap}`, shipAccountId, `Shipping income Rs ${gap}`]);

    console.log(`    ✓ Repair JE created: Dr AR Rs.${gap} / Cr Shipping Rs.${gap}`);
  }

  console.log('\n=== REPAIR COMPLETE ===');
  await client.end();
}

run().catch((err) => { console.error('REPAIR FAILED:', err); process.exit(1); });
