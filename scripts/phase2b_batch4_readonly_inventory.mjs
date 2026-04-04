/**
 * Phase 2B Batch 4 — read-only DB inventory (SELECT / catalog only).
 * Uses process.env.DATABASE_URL if set; else reads DATABASE_URL from .env.local.
 * Run from repo root: node scripts/phase2b_batch4_readonly_inventory.mjs
 * Paste stdout into docs/accounting/PHASE2B_DB_INVENTORY_REPORT.md §9 (per environment).
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
let url = process.env.DATABASE_URL?.trim();
if (!url) {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Set DATABASE_URL or create .env.local with DATABASE_URL=");
    process.exit(1);
  }
  const env = fs.readFileSync(envPath, "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  if (!line) {
    console.error("DATABASE_URL not found in .env.local");
    process.exit(1);
  }
  url = line.slice("DATABASE_URL=".length).trim();
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

function printSection(name, rows) {
  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(rows, null, 2));
}

async function main() {
  await client.connect();

  const q1a = await client.query(`
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'chart_accounts','account_transactions','accounting_audit_logs','automation_rules','accounting_settings','ledger_master','ledger_entries'
  )
ORDER BY table_name`);
  printSection("2.1a_tier12_tables", q1a.rows);

  const q1b = await client.query(`
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE 'backup_cr\\_%' ESCAPE '\\' OR table_name LIKE 'backup_pf145\\_%' ESCAPE '\\')
ORDER BY table_name`);
  printSection("2.1b_backup_tables", q1b.rows);

  if (q1b.rows.length) {
    const parts = q1b.rows.map(
      (r) =>
        `SELECT '${r.table_name}' AS t, COUNT(*)::bigint AS row_count FROM "${r.table_name.replace(/"/g, '""')}"`
    );
    const q1c = await client.query(parts.join(" UNION ALL "));
    printSection("2.2b_backup_row_counts", q1c.rows);
  }

  const tier12 = new Set(
    q1a.rows.map((r) => r.table_name).filter(Boolean)
  );

  const countParts = [];
  for (const t of [
    "chart_accounts",
    "account_transactions",
    "accounting_audit_logs",
    "automation_rules",
    "accounting_settings",
    "ledger_master",
    "ledger_entries",
  ]) {
    if (tier12.has(t)) {
      countParts.push(
        `SELECT '${t}' AS t, COUNT(*)::bigint AS row_count FROM ${t}`
      );
    }
  }
  if (countParts.length) {
    const q2 = await client.query(countParts.join(" UNION ALL "));
    printSection("2.2_row_counts", q2.rows);
  } else {
    printSection("2.2_row_counts", []);
  }

  if (tier12.has("ledger_master")) {
    const q3a = await client.query(`
SELECT company_id, COUNT(*)::bigint AS n
FROM ledger_master
GROUP BY company_id
ORDER BY n DESC
LIMIT 20`);
    printSection("2.3_ledger_master_by_company", q3a.rows);
  }
  if (tier12.has("ledger_entries")) {
    const q3b = await client.query(`
SELECT company_id, COUNT(*)::bigint AS n
FROM ledger_entries
GROUP BY company_id
ORDER BY n DESC
LIMIT 20`);
    printSection("2.3_ledger_entries_by_company", q3b.rows);
  }

  const q24 = await client.query(`
SELECT
  tc.table_schema,
  tc.table_name AS child_table,
  kcu.column_name AS child_column,
  ccu.table_name AS parent_table,
  ccu.column_name AS parent_column,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_schema = 'public'
  AND ccu.table_name IN (
    'chart_accounts','account_transactions','ledger_master','ledger_entries',
    'accounting_audit_logs','automation_rules','accounting_settings'
  )
ORDER BY ccu.table_name, tc.table_name`);
  printSection("2.4_fk_referencing_legacy_parents", q24.rows);

  const q25 = await client.query(`
SELECT
  tc.table_name AS legacy_table,
  kcu.column_name AS column_name,
  ccu.table_name AS references_table,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'chart_accounts','account_transactions','ledger_master','ledger_entries',
    'accounting_audit_logs','automation_rules','accounting_settings'
  )
ORDER BY tc.table_name`);
  printSection("2.5_fk_from_legacy_tables", q25.rows);

  const q26 = await client.query(`
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND (
    definition ILIKE '%chart_accounts%'
    OR definition ILIKE '%account_transactions%'
    OR definition ILIKE '%ledger_master%'
    OR definition ILIKE '%ledger_entries%'
    OR definition ILIKE '%accounting_audit_logs%'
    OR definition ILIKE '%automation_rules%'
    OR definition ILIKE '%accounting_settings%'
  )
ORDER BY table_name`);
  printSection("2.6_views", q26.rows);

  const q27 = await client.query(`
SELECT
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN (
    'chart_accounts','account_transactions','accounting_audit_logs','automation_rules','accounting_settings','ledger_master','ledger_entries'
  )
ORDER BY event_object_table, trigger_name`);
  printSection("2.7_triggers", q27.rows);

  const q28 = await client.query(`
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'chart_accounts','account_transactions','accounting_audit_logs','automation_rules','accounting_settings','ledger_master','ledger_entries'
  )
ORDER BY tablename, policyname`);
  printSection("2.8_rls", q28.rows);

  const qCrit = await client.query(`
SELECT
  tc.constraint_name,
  tc.table_name AS child_table,
  kcu.column_name AS child_column,
  ccu.table_name AS parent_table,
  ccu.column_name AS parent_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'journal_entry_lines'
  AND kcu.column_name = 'account_id'
  AND ccu.table_name = 'chart_accounts'`);
  printSection("CRITICAL_journal_entry_lines_account_id_to_chart_accounts", qCrit.rows);

  const qJelAll = await client.query(`
SELECT
  tc.constraint_name,
  kcu.column_name AS child_column,
  ccu.table_name AS parent_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'journal_entry_lines'
ORDER BY kcu.ordinal_position`);
  printSection("journal_entry_lines_all_fks", qJelAll.rows);

  const q29 = await client.query(`
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
       pg_get_functiondef(p.oid) ILIKE '%chart_accounts%'
    OR pg_get_functiondef(p.oid) ILIKE '%ledger_master%'
    OR pg_get_functiondef(p.oid) ILIKE '%ledger_entries%'
    OR pg_get_functiondef(p.oid) ILIKE '%account_transactions%'
  )
ORDER BY p.proname`);
  printSection("2.9_functions_mentioning_legacy", q29.rows);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
