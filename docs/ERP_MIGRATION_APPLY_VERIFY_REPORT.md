# ERP Migration Apply + Verify Report

**Date:** 2026-03-13  
**Scope:** erp_payments_indexes_safe.sql, erp_get_dashboard_metrics_rpc.sql, erp_legacy_table_comments.sql

---

## 1. Migrations found

| Migration | Path | Purpose |
|-----------|------|---------|
| erp_payments_indexes_safe.sql | migrations/erp_payments_indexes_safe.sql | Idempotent indexes on payments: company_id, company_id+payment_date, company_id+created_at, reference_type+reference_id |
| erp_get_dashboard_metrics_rpc.sql | migrations/erp_get_dashboard_metrics_rpc.sql | RPC get_dashboard_metrics(company_id, branch_id, start_date, end_date) → metrics, sales_by_category, low_stock_items |
| erp_legacy_table_comments.sql | migrations/erp_legacy_table_comments.sql | COMMENT ON TABLE for sale_items, chart_accounts, document_sequences (legacy) |

---

## 2. Migration tracking (schema_migrations)

All three migrations were **newly applied** in this run and are now recorded in `schema_migrations`:

| name | applied_at |
|------|------------|
| erp_get_dashboard_metrics_rpc.sql | 2026-03-13T00:44:09.756Z |
| erp_legacy_table_comments.sql | 2026-03-13T00:44:09.996Z |
| erp_payments_indexes_safe.sql | 2026-03-13T00:44:10.232Z |

**Command used:** `node scripts/run-migrations.js` (project migration runner).

---

## 3. What was applied

- **erp_get_dashboard_metrics_rpc.sql** — Applied. Created function `get_dashboard_metrics(p_company_id uuid, p_branch_id uuid DEFAULT NULL, p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL)`.
- **erp_legacy_table_comments.sql** — Applied. Set table comments on sale_items, chart_accounts, document_sequences.
- **erp_payments_indexes_safe.sql** — Applied. Created indexes: idx_payments_company_id, idx_payments_company_payment_date, idx_payments_company_created_at, idx_payments_reference (all with CREATE INDEX IF NOT EXISTS).

No migrations were skipped as “already applied” for these three; they had not been run before.

---

## 4. Verification (direct from DB)

### A. Dashboard RPC

- **Exists:** Yes. `pg_proc`: function `get_dashboard_metrics` in schema `public`.
- **Signature:** `p_company_id uuid, p_branch_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date`.
- **Callable:** Yes. Test call with null company UUID returned a JSON result (no error).

### B. Payments indexes

Verified via `pg_indexes` where `tablename = 'payments'`:

| indexname | Purpose |
|-----------|---------|
| idx_payments_company_id | company_id (new) |
| idx_payments_company_payment_date | company_id + payment_date (new) |
| idx_payments_company_created_at | company_id + created_at (new) |
| idx_payments_reference | reference_type + reference_id (new) |
| idx_payments_company | company_id (pre-existing) |
| idx_payments_date | payment_date DESC (pre-existing) |
| idx_payments_reference_sale | reference_type, reference_id WHERE reference_type = 'sale' (pre-existing) |
| payments_pkey | Primary key |
| payments_reference_number_unique | Unique (company_id, reference_number) |

**Required coverage:** company_id ✓, company_id + payment_date ✓, company_id + created_at ✓, reference_type + reference_id ✓. Both new and pre-existing indexes are present; duplicate on company_id (idx_payments_company and idx_payments_company_id) is harmless.

### C. Legacy table comments

Verified via `obj_description(reloid, 'pg_class')` for the three tables:

| table_name | comment |
|------------|---------|
| sale_items | LEGACY: Prefer sales_items for new code. Fallback for reads; triggers/RLS here. Do not drop. |
| chart_accounts | LEGACY: Posting uses accounts + journal_entries + journal_entry_lines. Not used by app. Do not drop. |
| document_sequences | LEGACY: Prefer erp_document_sequences. Still used by credit notes, refunds, returns until migrated. Do not drop. |

All three comments applied as intended.

---

## 5. Safe fixes made during apply

- None required. All three migrations ran successfully with no errors. The migration runner and idempotent SQL (CREATE INDEX IF NOT EXISTS, DO $$ IF NOT EXISTS ... CREATE FUNCTION) were sufficient.

---

## 6. Non-blocking warnings

- None. No duplicate-object errors (index/function/comment already existed under same or different name) and no owner/permission issues.

---

## 7. Commands / SQL used

- **Apply:** `node scripts/run-migrations.js` (from project root). Uses `DATABASE_ADMIN_URL` or `DATABASE_POOLER_URL` or `DATABASE_URL` from `.env.local`.
- **Verify:** `node scripts/erp-migration-verify.js` (ad-hoc script that queries pg_proc, pg_indexes, obj_description, schema_migrations and tests RPC call).

---

## 8. Rollback notes

- **Indexes:** To remove only the four new payment indexes:
  ```sql
  DROP INDEX IF EXISTS idx_payments_reference;
  DROP INDEX IF EXISTS idx_payments_company_created_at;
  DROP INDEX IF EXISTS idx_payments_company_payment_date;
  DROP INDEX IF EXISTS idx_payments_company_id;
  ```
  Do not drop if other code or migrations depend on them.

- **RPC:** To remove the function:
  ```sql
  DROP FUNCTION IF EXISTS get_dashboard_metrics(UUID, UUID, DATE, DATE);
  ```
  Frontend will then use the existing fallback (separate financial + sales-by-category + low-stock calls).

- **Comments:** To clear legacy comments:
  ```sql
  COMMENT ON TABLE sale_items IS NULL;
  COMMENT ON TABLE chart_accounts IS NULL;
  COMMENT ON TABLE document_sequences IS NULL;
  ```

- **schema_migrations:** Removing the three migration names from schema_migrations is optional and only for re-running the same migration files; it does not undo the created objects.

---

## 9. Functional verification (code)

- **Reporting:** accountingReportsService uses getSaleLineItems() (sales_items first, sale_items fallback) in getSalesProfit, getProfitByProduct, getProfitByCategory, getProfitByCustomer.
- **Dashboard:** financialDashboardService.getDashboardMetrics() calls get_dashboard_metrics RPC and falls back to separate getFinancialDashboardMetrics + getSalesByCategory + getLowStockProducts. Dashboard.tsx uses a single effect calling getDashboardMetrics(companyId, branchId, startDate, endDate).
- **Accounting:** No changes to posting path; all flows remain accounts + journal_entries + journal_entry_lines.

---

*Verification script used: scripts/erp-migration-verify.js (can be re-run for future checks).*
