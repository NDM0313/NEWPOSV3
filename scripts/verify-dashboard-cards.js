/**
 * Issue 05 verification: Compare dashboard RPC metrics to canonical source queries.
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

async function canonicalPeriod(client, companyId, start, end) {
  const salesCol = 'invoice_date';
  const purchCol = 'po_date';
  const expCol = 'expense_date';
  const r = await client.query(
    `SELECT
      (SELECT COALESCE(SUM(total), 0) FROM sales WHERE company_id = $1 AND status = 'final' AND (${salesCol})::date >= $2 AND (${salesCol})::date <= $3) AS revenue,
      (SELECT COALESCE(SUM(total), 0) FROM purchases WHERE company_id = $1 AND status IN ('final', 'received') AND (${purchCol})::date >= $2 AND (${purchCol})::date <= $3) AS purchases,
      (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE company_id = $1 AND status = 'paid' AND (${expCol})::date >= $2 AND (${expCol})::date <= $3) AS expenses,
      (SELECT COALESCE(SUM(due_amount), 0) FROM sales WHERE company_id = $1 AND status = 'final' AND COALESCE(due_amount, 0) > 0) AS receivables,
      (SELECT COALESCE(SUM(due_amount), 0) FROM purchases WHERE company_id = $1 AND status IN ('final', 'received') AND COALESCE(due_amount, 0) > 0) AS payables`,
    [companyId, start, end]
  );
  const row = r.rows[0];
  return {
    revenue: Number(row?.revenue ?? 0),
    purchases: Number(row?.purchases ?? 0),
    expenses: Number(row?.expenses ?? 0),
    receivables: Number(row?.receivables ?? 0),
    payables: Number(row?.payables ?? 0),
    profit: Number(row?.revenue ?? 0) - Number(row?.purchases ?? 0) - Number(row?.expenses ?? 0),
  };
}

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    const start = '2025-01-01';
    const end = '2026-12-31';

    for (const [label, companyId] of [
      ['NEW BUSINESS (c37b77cc)', NEW_BUSINESS],
      ['OLD BUSINESS (eb71d817)', OLD_BUSINESS],
    ]) {
      console.log('\n---', label, '---');
      const canonical = await canonicalPeriod(client, companyId, start, end);
      const rpc = await client.query(
        `SELECT get_dashboard_metrics($1::uuid, NULL, $2::date, $3::date) AS payload`,
        [companyId, start, end]
      );
      const payload = rpc.rows[0]?.payload;
      const m = payload?.metrics || {};
      const rev = Number(m.monthly_revenue ?? 0);
      const exp = Number(m.monthly_expenses ?? 0);
      const profit = Number(m.monthly_profit ?? 0);
      const rec = Number(m.receivables ?? 0);
      const pay = Number(m.payables ?? 0);

      console.log('Canonical (source queries):');
      console.log('  Revenue:', canonical.revenue.toFixed(2), '| Purchases+Expenses:', (canonical.purchases + canonical.expenses).toFixed(2), '| Profit:', canonical.profit.toFixed(2), '| Rec:', canonical.receivables.toFixed(2), '| Pay:', canonical.payables.toFixed(2));
      console.log('RPC (dashboard metrics):');
      console.log('  Revenue:', rev.toFixed(2), '| Expenses:', exp.toFixed(2), '| Profit:', profit.toFixed(2), '| Rec:', rec.toFixed(2), '| Pay:', pay.toFixed(2));
      const revOk = Math.abs(rev - canonical.revenue) < 0.02;
      const profitOk = Math.abs(profit - canonical.profit) < 0.02;
      const recOk = Math.abs(rec - canonical.receivables) < 0.02;
      const payOk = Math.abs(pay - canonical.payables) < 0.02;
      console.log('Match:', revOk && profitOk && recOk && payOk ? 'YES' : 'NO', revOk ? '' : '(revenue)', profitOk ? '' : '(profit)', recOk ? '' : '(rec)', payOk ? '' : '(pay)');
    }
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
