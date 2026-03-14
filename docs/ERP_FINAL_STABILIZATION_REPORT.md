# ERP Final Stabilization Report

**Date:** 2026-03-13  
**Scope:** Reporting alignment, payments indexes, dashboard RPC, legacy documentation, accounting guardrail verification.

---

## 1. What was changed

### Phase 1 — Reporting alignment

- **accountingReportsService.ts:** Added helper `getSaleLineItems(selectColumns, saleIds)` that tries **sales_items** first, then **sale_items**. Updated `getSalesProfit`, `getProfitByProduct`, `getProfitByCategory`, `getProfitByCustomer` to use it. Reporting now aligns with canonical table **sales_items** while keeping fallback for legacy deployments.
- **docs/ERP_REPORTING_ALIGNMENT.md** — Created.

### Phase 2 — Payments indexes

- **migrations/erp_payments_indexes_safe.sql** — Added (idempotent): `idx_payments_company_id`, `idx_payments_company_payment_date`, `idx_payments_company_created_at`, `idx_payments_reference`. All use `CREATE INDEX IF NOT EXISTS`.
- **docs/ERP_PAYMENTS_INDEX_AUDIT.md** — Created (verification query and rollback notes).

### Phase 3 — Dashboard RPC

- **migrations/erp_get_dashboard_metrics_rpc.sql** — New RPC `get_dashboard_metrics(p_company_id, p_branch_id, p_start_date, p_end_date)` returning metrics (via existing get_financial_dashboard_metrics), sales_by_category, low_stock_items.
- **financialDashboardService.ts** — Added `getDashboardMetrics()`, `DashboardMetricsPayload`, `DashboardLowStockItem`; fallback to separate calls if RPC fails.
- **Dashboard.tsx** — Replaced three loading effects (financial, sales-by-category, low stock) with one effect calling `getDashboardMetrics()`; single `loading` state; alerts still loaded separately.
- **docs/ERP_DASHBOARD_RPC_IMPLEMENTATION.md** — Created.

### Phase 4 — Legacy structure documentation

- **docs/ERP_LEGACY_STRUCTURE_NOTES.md** — Documents sale_items, chart_accounts, document_sequences as legacy; ledger and studio v2/v3 as keep.
- **migrations/erp_legacy_table_comments.sql** — Optional `COMMENT ON TABLE` for sale_items, chart_accounts, document_sequences.

### Phase 5 — Accounting guardrail

- **docs/ERP_ACCOUNTING_GUARDRAIL_CHECK.md** — Verification that all posting uses accounts + journal_entries + journal_entry_lines; no posting to chart_accounts/account_transactions; reports use canonical structures.

---

## 2. What was verified

- Reporting reads: **sales_items** first, **sale_items** fallback (no exclusive use of sale_items in reports).
- Payments table: Index migration is idempotent; audit doc describes how to confirm existing indexes.
- Dashboard: Single RPC path with fallback; query count reduced when RPC is available.
- Legacy: sale_items, chart_accounts, document_sequences documented; no drops.
- Accounting: All listed flows post through accountingService.createEntry or DB logic into journal_entries/journal_entry_lines; chart_accounts not used for posting.

---

## 3. What remains intentionally untouched

- **sale_items** — Not dropped; still used as fallback and by triggers/RLS.
- **chart_accounts** — Not dropped; not used by app; documented as legacy.
- **document_sequences** — Not dropped; still used by credit note/refund/return numbering until migrated.
- **Studio v2/v3 tables** — Not removed; optional when feature flags are on.
- **ledger_master** / **ledger_entries** / **worker_ledger_entries** — Kept; subsidiary ledgers.
- No renames, no destructive cleanup, no accounting architecture rewrite.

---

## 4. Migrations created

| Migration | Purpose |
|-----------|---------|
| **erp_payments_indexes_safe.sql** | Payments indexes (company_id, company_id+payment_date, company_id+created_at, reference_type+reference_id). |
| **erp_get_dashboard_metrics_rpc.sql** | RPC get_dashboard_metrics. |
| **erp_legacy_table_comments.sql** | Optional COMMENT ON TABLE for legacy tables. |

---

## 5. Rollback notes

- **Reporting:** Revert accountingReportsService.ts (remove getSaleLineItems, use .from('sale_items') again in the four methods).
- **Payments indexes:** `DROP INDEX IF EXISTS idx_payments_reference;` (and same for other three) only if needed; see ERP_PAYMENTS_INDEX_AUDIT.md.
- **Dashboard:** Revert Dashboard.tsx and financialDashboardService.ts to previous multi-call behavior; drop function: `DROP FUNCTION IF EXISTS get_dashboard_metrics(UUID, UUID, DATE, DATE);`
- **Legacy comments:** Comments can be cleared with `COMMENT ON TABLE ... IS NULL;` if desired.

---

## 6. Performance impact summary

- **Dashboard:** When get_dashboard_metrics is available, dashboard load uses **1 RPC + 1 alerts call** instead of 4–13 calls (financial + sales-by-category + low-stock + alerts). Faster initial load and fewer round-trips.
- **Reports:** Same number of queries; reads now prefer sales_items (canonical), which may align better with write path and cache behavior.
- **Payments:** New indexes improve list/filter and reference lookups; no change to application code.

---

## 7. Remaining optional future work

- Migrate credit note / refund / return numbering from document_sequences to erp_document_sequences.
- Add trigger or equivalent for **sales_items** (e.g. trigger_calculate_sale_totals) if consolidating fully to sales_items and deprecating writes to sale_items.
- Consider including alerts in get_dashboard_metrics to reduce to a single dashboard call (optional).

---

## 8. Migration Apply + Verify Status

**Date applied/verified:** 2026-03-13

### Applied

All three stabilization migrations were applied via the project migration runner (`node scripts/run-migrations.js`):

- **erp_get_dashboard_metrics_rpc.sql** — Applied. Function `get_dashboard_metrics` created.
- **erp_legacy_table_comments.sql** — Applied. Comments set on sale_items, chart_accounts, document_sequences.
- **erp_payments_indexes_safe.sql** — Applied. Indexes idx_payments_company_id, idx_payments_company_payment_date, idx_payments_company_created_at, idx_payments_reference created.

All are recorded in `schema_migrations`.

### Verified (direct from DB)

- **Dashboard RPC:** Function exists in `pg_proc` with signature `(p_company_id uuid, p_branch_id uuid DEFAULT NULL, p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL)`. Test call returned JSON; callable.
- **Payments indexes:** All four required index patterns present (company_id; company_id + payment_date; company_id + created_at; reference_type + reference_id). Pre-existing indexes (e.g. idx_payments_company, idx_payments_reference_sale) also present; no conflicts.
- **Legacy comments:** sale_items, chart_accounts, and document_sequences have the documented legacy comments.

Full apply/verify details: **docs/ERP_MIGRATION_APPLY_VERIFY_REPORT.md**. Re-verification script: `node scripts/erp-migration-verify.js`.

---

*End of final stabilization report.*
