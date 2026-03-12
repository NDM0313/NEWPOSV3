/**
 * ERP Auto Health Monitor — generates docs/ERP_HEALTH_REPORT.md
 * Runs DB checks (tables, columns, variation stock source, purchase status enum),
 * then writes a structured report for AI/human review.
 *
 * Usage: node scripts/erp-health-report.js
 * Env: .env.local → DATABASE_URL / DATABASE_POOLER_URL / DATABASE_ADMIN_URL
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, 'docs', 'ERP_HEALTH_REPORT.md');

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

async function runHealthCheck(client) {
  const sqlPath = path.join(__dirname, 'erp_full_health_check.sql');
  if (!fs.existsSync(sqlPath)) return { rows: [], error: 'erp_full_health_check.sql not found' };
  const fullSql = fs.readFileSync(sqlPath, 'utf8');
  const sqlWithoutSelect = fullSql.includes('-- Structured report')
    ? fullSql.split('-- Structured report')[0].trim()
    : fullSql;
  await client.query(sqlWithoutSelect);
  const res = await client.query(
    `SELECT component AS "Component", status AS "Status", details AS "Details" FROM erp_health_result ORDER BY component`
  );
  return { rows: res.rows || [], error: null };
}

async function getVariationStockColumns(client) {
  const res = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_variations'
      AND column_name IN ('current_stock', 'stock', 'stock_quantity')
    ORDER BY column_name
  `);
  return (res.rows || []).map((r) => r.column_name);
}

async function getPurchaseStatusType(client) {
  const res = await client.query(`
    SELECT data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'status'
  `);
  if (res.rows && res.rows.length) return res.rows[0];
  return null;
}

async function getStockMovementsExists(client) {
  const res = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_movements'
  `);
  return res.rows && res.rows.length > 0;
}

async function getSchemaMigrationsCount(client) {
  try {
    const res = await client.query(`SELECT COUNT(*) AS c FROM schema_migrations`);
    return res.rows && res.rows[0] ? Number(res.rows[0].c) : 0;
  } catch {
    return null;
  }
}

function buildReport(healthRows, variationStockCols, purchaseStatusType, stockMovementsExists, migrationsCount) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const failCount = healthRows.filter((r) => r.Status === 'FAIL' || r.Status === 'ERROR').length;
  const overall = healthRows.find((r) => r.Component === 'OVERALL');

  let md = `# ERP Health Report\n\n`;
  md += `**Generated:** ${now}  \n`;
  md += `**Overall:** ${overall ? overall.Status : 'unknown'}\n\n`;
  md += `---\n\n`;

  md += `## 1. Inventory Health\n\n`;
  md += `| Check | Result |\n|-------|--------|\n`;
  md += `| product_variations stock column(s) | ${variationStockCols.length ? variationStockCols.join(', ') : 'none (use stock_movements aggregation)'} |\n`;
  md += `| stock_movements table | ${stockMovementsExists ? 'OK' : 'Missing'} |\n`;
  const invRows = healthRows.filter(
    (r) =>
      r.Component.includes('inventory') ||
      r.Component.includes('stock') ||
      r.Component === 'inventory_balance' ||
      r.Component === 'inventory_settings'
  );
  for (const r of invRows) {
    md += `| ${r.Component} | ${r.Status} |\n`;
  }
  md += `\n`;

  md += `## 2. API / Database Readiness\n\n`;
  md += `| Component | Status | Details |\n|------------|--------|--------|\n`;
  for (const r of healthRows) {
    if (r.Component === 'OVERALL') continue;
    md += `| ${r.Component} | ${r.Status} | ${r.Details || '—'} |\n`;
  }
  md += `\n`;

  md += `## 3. Purchase & Sales Schema\n\n`;
  md += `| Item | Value |\n|------|-------|\n`;
  md += `| purchases.status type | ${purchaseStatusType ? `${purchaseStatusType.data_type} (${purchaseStatusType.udt_name})` : 'column not found'} |\n`;
  md += `| schema_migrations count | ${migrationsCount != null ? migrationsCount : 'N/A'} |\n\n`;

  md += `## 4. Mobile vs Web Differences\n\n`;
  md += `- **Variation stock:** Mobile uses \`product_variations.stock\` → \`stock_quantity\` → aggregate from \`stock_movements\`. No \`current_stock\` (column may not exist).\n`;
  md += `- **Purchase status:** Mobile sends only \`status: 'final'\` on Mark as Final. DB enum must include \`final\`. Run \`SELECT unnest(enum_range(NULL::purchase_status));\` to confirm.\n`;
  md += `- **Packing:** Mobile uses \`packing_details\` (total_boxes, total_pieces, total_meters) on purchase_items.\n\n`;

  md += `## 5. Performance Warnings\n\n`;
  md += `- Run \`erp_full_health_check.sql\` and review RLS/column checks above.\n`;
  md += `- Ensure indexes exist on \`sales(company_id, status)\`, \`purchases(company_id)\`, \`stock_movements(reference_type, reference_id)\`, \`product_variations(product_id)\`.\n\n`;

  md += `## 6. Missing Features / Follow-ups\n\n`;
  if (failCount > 0) {
    md += `- **Failures to fix:** ${failCount} component(s) reported FAIL or ERROR in section 2.\n`;
  }
  md += `- Re-run: \`node scripts/erp-health-report.js\` after schema or env changes.\n`;

  return md;
}

async function main() {
  if (!connectionString) {
    console.log('[ERP Health] No DATABASE_URL in .env.local — skipping. Set DATABASE_URL or DATABASE_POOLER_URL.');
    const docsDir = path.dirname(reportPath);
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(
      reportPath,
      `# ERP Health Report\n\n**Generated:** ${new Date().toISOString()}\n\nNo DATABASE_URL configured. Set .env.local and re-run \`node scripts/erp-health-report.js\`.\n`
    );
    console.log('[ERP Health] Wrote', reportPath, '(no DB)');
    process.exit(0);
  }

  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const health = await runHealthCheck(client);
    const variationStockCols = await getVariationStockColumns(client);
    const purchaseStatusType = await getPurchaseStatusType(client);
    const stockMovementsExists = await getStockMovementsExists(client);
    const migrationsCount = await getSchemaMigrationsCount(client);

    const report = buildReport(
      health.rows,
      variationStockCols,
      purchaseStatusType,
      stockMovementsExists,
      migrationsCount
    );

    const docsDir = path.dirname(reportPath);
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(reportPath, report, 'utf8');
    console.log('[ERP Health] Report written to', reportPath);
  } catch (err) {
    console.error('[ERP Health] Error:', err.message);
    const errReport = `# ERP Health Report\n\n**Generated:** ${new Date().toISOString()}\n\n**Error:** ${err.message}\n`;
    try {
      const docsDir = path.dirname(reportPath);
      if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(reportPath, errReport, 'utf8');
    } catch (e) {
      console.error(e);
    }
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}

main();
