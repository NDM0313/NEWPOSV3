# Legacy Accounting References Review

Tables: **`chart_accounts`**, **`account_transactions`**, **`accounting_audit_logs`**, **`automation_rules`**, **`ledger_master`**, **`ledger_entries`**.

Classification key: **active use** | **dead code** | **migration leftover** | **risky to remove** | **safe to replace**

---

## Application TypeScript (`src/`, `erp-mobile-app/src/`)

| Reference | File | Classification | Notes |
|-----------|------|----------------|-------|
| String literals `chart_accounts`, `account_transactions` | `src/app/services/accountingCanonicalGuard.ts` | **active use** (guard) | **Deny-list** / warnings — does **not** query DB |
| Comment-only / worker table | Multiple files mentioning `worker_ledger_entries` | **active use** | **Different table** from `ledger_entries`; canonical for studio/worker UX |
| `ledger_master` type names in **comments** | `src/app/context/AccountingContext.tsx` (worker sync comments) | **migration leftover** (text) | No `.from('ledger_master')` |
| Stub API | `src/app/services/ledgerService.ts` | **dead code** (runtime) | All exports return `null` / `[]`; **safe to replace** call sites over time — **risky to delete file** until grep confirms zero imports expecting behavior |
| **`chart_accounts` / `ledger_master` queries** | **None found** in `src/**/*.ts(x)` | — | Search performed 2026-03-30 |

| Reference | `erp-mobile-app` | Classification |
|-----------|------------------|----------------|
| `chart_accounts`, `ledger_master`, `ledger_entries`, `account_transactions` | **No matches** | N/A |

---

## SQL migrations (selected)

| File | Table mentions | Classification |
|------|----------------|----------------|
| `migrations/accounting_stabilization_phase1_legacy_comments.sql` | `chart_accounts` | **migration leftover** — COMMENT marks legacy |
| `migrations/erp_legacy_table_comments.sql` | legacy bundle | **migration leftover** |
| `migrations/ledger_master_and_entries.sql` | `ledger_master`, `ledger_entries` | **migration leftover** — defines historical schema |
| `migrations/ledger_master_ledger_entries_rls_insert_update.sql` | same | **migration leftover** |
| `docs/audit/*.sql`, `docs/accounting/*.sql` | various | **migration leftover** / ops docs |

---

## Scripts / one-off JS (repo root)

| File | Tables | Classification | Notes |
|------|--------|----------------|-------|
| `complete-migration.js` | Creates **`chart_accounts`**, **`account_transactions`**, **`accounting_audit_logs`**, **`automation_rules`** | **migration leftover** | Historical / dangerous to run against prod without review |
| `remove-duplicate-accounting-tables.js` | Lists drops for legacy cluster | **risky to remove** (script) | **Do not run** without phase 2 approval |
| `verify-migration.js` | Lists expected table names including legacy | **migration leftover** |
| `verify-accounting-integrity.js` | Checks if `chart_accounts` / `account_transactions` **exist** | **active use** (verification) | Prints “unused by app” |
| `erp-migration-verify.js` | Comment mentions `chart_accounts` | **migration leftover** |
| `repair-accounting-db.js` | references `ledger_entries` column | **risky to remove** | Maintenance |
| `scripts/run-supplier-ledger-verification.js` | SQL strings `ledger_master`, `ledger_entries` | **migration leftover** / audit | Validates **DB** legacy path |
| `scripts/company_reset_*.sql` | `ledger_master`, `ledger_entries`, backups | **migration leftover** | Destructive category |

---

## Documentation / audit SQL under `docs/`

| Area | Classification |
|------|----------------|
| `docs/audit/legacy_object_freeze_audit.sql` | **migration leftover** — explicitly labels canonical vs legacy |
| `docs/audit/supplier_ledger_*.sql` | **migration leftover** — traces `ledger_entries` |

---

## `backup_cr_*` / `backup_pf145_*`

| Location | Classification |
|----------|----------------|
| `scripts/company_reset_backup.sql` | Creates **`backup_cr_*`** from various tables including **`ledger_*`** | **migration leftover** — archive pattern, **risky to remove** |
| Not referenced from **`src/`** TS | No app runtime dependency found |

---

## Summary by table

| Table | Still used by app TS? | DB may exist? | Recommendation |
|-------|----------------------|---------------|----------------|
| `chart_accounts` | **No** | Yes (older envs) | Phase 2: DB inventory, then deprecate |
| `account_transactions` | **No** | Yes | Same |
| `accounting_audit_logs` | **No** | Yes | Same |
| `automation_rules` | **No** | Yes | Same |
| `ledger_master` | **No** (stubs only) | Yes (migrations) | Phase 2: confirm no external ETL |
| `ledger_entries` | **No** (stubs) | Yes | Same |
| `worker_ledger_entries` | **Yes** (web + mobile) | Yes | **Not** same as `ledger_entries`; keep |

