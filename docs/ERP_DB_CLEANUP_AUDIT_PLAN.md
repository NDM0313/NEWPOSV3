# ERP Database Cleanup Audit Plan (NO DELETION YET)

**Date:** 2026-03-14  
**Status:** Audit only. Do NOT run any DROP or TRUNCATE in production until approved.

---

## Purpose

Identify unused, duplicate, or test tables and recommend archive-first / safe-delete candidates. No direct deletion of production tables in this step.

---

## 1. Unused tables (candidates)

Tables that may no longer be referenced by the current application code. Verify against live codebase before any action.

| Table / view | Notes | Code reference check |
|--------------|--------|----------------------|
| `studio_orders` | Legacy studio flow; may be replaced by studio_productions + studio_production_stages | studioService.ts (create, list, delete) – still referenced |
| `studio_order_items` | Legacy | studioService.ts |
| `job_cards` | Legacy job card flow | studioService.ts |
| `employee_ledger` | Separate from worker_ledger_entries | employeeService.ts |
| `employees` | May overlap with workers/contacts | employeeService.ts |
| `erp_document_number_audit` | Audit only | NumberAuditTable.tsx |
| `activity_logs` | Optional feature | activityLogService.ts |
| `feature_flags` | Feature toggles | featureFlagsService.ts |

**Action:** Run a full codebase grep for each table name (e.g. `.from('table_name')`) and confirm. If zero references and table is not used by RLS/triggers, mark as "archive-first candidate".

---

## 2. Duplicate / legacy tables

Tables that duplicate or overlap with another source of truth.

| Primary (keep) | Duplicate / legacy | Notes |
|----------------|--------------------|--------|
| `sales_items` | `sale_items` | Code uses sales_items first, fallback to sale_items in several services (saleAccountingService, studioProductionService, packingListService). Migrate any remaining data then deprecate sale_items. |
| `ledger_master` + `ledger_entries` | Used for supplier/user ledgers only | worker_ledger_entries is separate (workers). Not duplicate but be aware of two ledger systems. |
| `studio_productions` + `studio_production_stages` | `studio_orders` + `studio_order_items` | Current app uses productions; studio_orders may be legacy. Verify no critical data in studio_orders before archive. |

**Action:** Confirm which table is authorative per domain. Document migration path (copy data if needed), then plan deprecation of legacy table only after migration and code switch.

---

## 3. Test / temp tables

Tables created for testing or one-off fixes that should not hold production data.

| Table | Notes |
|-------|--------|
| (None clearly named in migrations) | Audit seed/truncate scripts: deploy/truncate-all-data.sql, seed/truncate_all.sql – ensure they are not run in production by mistake. |

**Action:** Review any table created in a "test" or "fix" migration; if they exist in production and are unused, mark as archive-first.

---

## 4. Code references (how to verify)

- **Frontend / API:** `grep -r "from\('[table_name']\)" src/` (or `\.from\("table_name"\)`).
- **Migrations / SQL:** `grep -rl "table_name" migrations/ deploy/ seed/`.
- **RLS / triggers:** Check if table is used in policy or trigger on another table.

---

## 5. Safe delete candidates (after verification)

Only after confirming unused and no RLS/trigger dependency:

- None recommended in this audit. Re-run the code reference check per table above; then list tables with zero references and no dependency as "safe delete candidates" in a follow-up.

---

## 6. Archive-first recommendations

1. **sale_items:** If all code paths use sales_items and no critical data remains in sale_items, archive sale_items (e.g. rename to sale_items_archive or export to backup then drop) only after backup and verification.
2. **studio_orders / studio_order_items:** If fully superseded by studio_productions and stages, export data, then rename to _archive or drop in a separate change request.
3. **employee_ledger / employees:** If the app uses only workers + worker_ledger_entries for studio and accounting, document whether employees/employee_ledger are still required; if not, archive-first.

---

## 7. Constraints (reminder)

- Do NOT delete tables that are referenced by RLS policies, triggers, or foreign keys from active tables without a migration plan.
- Preserve company_id / branch_id scoping when merging or archiving.
- Keep journal_entries, journal_entry_lines, worker_ledger_entries, accounts, and all accounting-related tables intact.
- Run this audit in a copy of the DB or read-only when possible.

---

## 8. Next steps

1. Run code-reference verification for each table in sections 1 and 2.
2. For duplicate tables (e.g. sale_items): confirm migration completeness, then add to "archive-first" list with a concrete migration script (rename/backup, not delete).
3. Revisit this document after worker payment flow is stable and no cleanup has been run yet.
