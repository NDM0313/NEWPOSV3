# Phase 2B — Legacy freeze inventory (tables + code paths)

**Updated:** 2026-04-01  
**Method:** Repository scan (grep) of `src/`, `erp-mobile-app/src/`, plus targeted `migrations/`, `scripts/`, and `docs/` references. This is **not** a live DB catalog — run environment-specific `information_schema` inventory + dependency queries before **any** DB change.

**Classifier key:** **PROTECTED_LIVE** | **LEGACY_READONLY** | **ARCHIVE_ONLY** | **DROP_CANDIDATE_REVIEW**

---

## A) Live accounting spine — PROTECTED_LIVE

| Object | Runtime use evidence (exact files) | Notes |
|--------|-------------------------|--------|
| `accounts` | `src/app/services/accountingService.ts`, `src/app/services/accountService.ts`, `erp-mobile-app/src/api/accounts.ts` | Canonical COA table (not `chart_accounts`) |
| `journal_entries` | `src/app/services/documentPostingEngine.ts`, `src/app/services/accountingService.ts`, `erp-mobile-app/src/api/reports.ts` | Canonical GL header |
| `journal_entry_lines` | `src/app/services/accountingService.ts`, `src/app/services/accountingReportsService.ts`, `erp-mobile-app/src/api/accounts.ts` | Canonical GL lines |
| `payments` | `src/app/services/workerPaymentService.ts`, `src/app/services/supplierPaymentService.ts`, `erp-mobile-app/src/api/sales.ts` | Phase 2A worker posting chain verified |
| `payment_allocations` | `src/app/services/paymentAllocationService.ts`, `src/app/services/paymentLifecycleService.ts`, `erp-mobile-app/src/api/sales.ts` | Allocation-driven AR/AP parity |
| `worker_ledger_entries` | `src/app/services/workerAdvanceService.ts`, `src/app/services/studioProductionService.ts`, `erp-mobile-app/src/api/accounts.ts` | Distinct from legacy `ledger_entries` |
| Canonical/legacy guardrails | `src/app/services/accountingCanonicalGuard.ts` | Blocks legacy tables + backup tables as truth in dev/CI |
| **RPCs (Phase 2A verified)** | `src/app/services/customerLedgerApi.ts`, `src/app/services/financialDashboardService.ts`, `erp-mobile-app/src/api/customerLedger.ts`, `erp-mobile-app/src/api/financialDashboard.ts` | See `PHASE2A_QA_EVIDENCE.md` |

Supporting operational tables (non-exhaustive; still **PROTECTED_LIVE** for product): `sales`, `purchases`, `contacts`, `workers`, `studio_productions`, … — only listed where they feed accounting UX.

---

## B) Legacy table cluster — classification

### B.1 Duplicate COA + duplicate posting tables (`chart_accounts` cluster)

**Tables:** `chart_accounts`, `account_transactions`, `accounting_audit_logs`, `automation_rules`, `accounting_settings`

| Dimension | Finding |
|-----------|---------|
| **Runtime app reads (web + mobile)** | **No reads found** in runtime code. `src/` only references these names in the deny-list in [accountingCanonicalGuard.ts:L24-L106](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/src/app/services/accountingCanonicalGuard.ts#L24-L106). `erp-mobile-app/src/` contains no references. |
| **DB definitions / dependencies (repo)** | Primary legacy definition: [16_chart_of_accounts.sql](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/supabase-extract/migrations/16_chart_of_accounts.sql). Helper scripts: [complete-migration.js](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/complete-migration.js), [verify-migration.js](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/verify-migration.js), [remove-duplicate-accounting-tables.js](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/remove-duplicate-accounting-tables.js). |
| **DB-level coupling (from SQL)** | `account_transactions.account_id → chart_accounts.id` FK; `journal_entry_lines.account_id → chart_accounts.id` FK; `update_account_balance()` trigger/function updates `chart_accounts.current_balance` after inserts into `account_transactions` (in `16_chart_of_accounts.sql`). |
| **Deprecation markers (repo)** | Legacy comments: [accounting_stabilization_phase1_legacy_comments.sql](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/migrations/accounting_stabilization_phase1_legacy_comments.sql), [erp_legacy_table_comments.sql](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/migrations/erp_legacy_table_comments.sql). |
| **Classification** | **LEGACY_READONLY** (if present in DB). **DROP_CANDIDATE_REVIEW** only after environment inventory + dependency graph + retention sign-off. |

### B.2 `ledger_master`, `ledger_entries` (supplier/user subledger — not `worker_ledger_entries`)

| Dimension | Finding |
|-----------|---------|
| **Runtime app reads (web + mobile)** | **No reads found** in runtime code (`src/` and `erp-mobile-app/src/` contain no references to `ledger_master` / `ledger_entries`). |
| **Explicit app deactivation** | No-op stub: [ledgerService.ts:L1-L83](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/src/app/services/ledgerService.ts#L1-L83). |
| **DB / migrations** | [ledger_master_and_entries.sql](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/migrations/ledger_master_and_entries.sql) (drops+creates; FK `ledger_entries.ledger_id → ledger_master.id`), [ledger_master_ledger_entries_rls_insert_update.sql](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/migrations/ledger_master_ledger_entries_rls_insert_update.sql). |
| **Ops / audit** | [company_reset_backup.sql](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/scripts/company_reset_backup.sql#L60-L75), `scripts/run-supplier-ledger-verification.js`, `docs/audit/supplier_ledger_verification.sql`, `scripts/company_reset_*`. |
| **Classification** | **LEGACY_READONLY** (if present in DB). **DROP_CANDIDATE_REVIEW** only after proving no external consumer and supplier parity on canonical spine. |

---

## C) Backup / archive tables — ARCHIVE_ONLY

| Pattern | Origin in repo | App behavior |
|---------|----------------|--------------|
| `backup_cr_*` | [company_reset_backup.sql](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/scripts/company_reset_backup.sql) | Guard forbids backup tables as UI truth: [accountingCanonicalGuard.ts:L24-L106](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/src/app/services/accountingCanonicalGuard.ts#L24-L106). |
| `backup_pf145_*` | [pf145_backup_tables_and_fingerprint.sql:L23-L71](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/migrations/pf145_backup_tables_and_fingerprint.sql#L23-L71) | Same guard policy (backup tables never feed live UI). |

**Classification:** **ARCHIVE_ONLY** — retain for recovery; never wire to live UI.

---

## D) Dead / mock frontend files

| File | Evidence | Classification |
|------|----------|----------------|
| `erp-mobile-app/src/components/accounting/AccountingModule.tsx` | Not referenced by `erp-mobile-app/src/App.tsx` imports: [App.tsx:L21-L36](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/erp-mobile-app/src/App.tsx#L21-L36). | **ARCHIVE_ONLY** (repo) / candidate for Batch 2 deletion after approval |
| `Figma Mobile ERP App Design/src/components/accounting/AccountingModule.tsx` | Design mirror only (separate tree from shipped app) | **ARCHIVE_ONLY** |

---

## E) Scripts and migrations (not live app, but operational risk)

| Path | Role |
|------|------|
| `scripts/company_reset_backup.sql`, `scripts/company_reset_final.sql`, `scripts/company_reset_preview.sql`, `scripts/company_reset_verify.sql` | Destructive **when run**; touches many tables and includes legacy `ledger_*` |
| `scripts/run-supplier-ledger-verification.js`, `docs/audit/supplier_ledger_verification.sql` | Legacy supplier-ledger audits (DB-dependent) |
| [complete-migration.js](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/complete-migration.js), [verify-migration.js](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/verify-migration.js), [remove-duplicate-accounting-tables.js](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/remove-duplicate-accounting-tables.js) | Legacy COA/prototype scripts; treat as dangerous on prod |
| `migrations/*.sql` and `supabase-extract/migrations/*.sql` | Historical DDL/RPCs; do not re-run blindly |

**Classification:** **ARCHIVE_ONLY** as artifacts; **DROP_CANDIDATE_REVIEW** does **not** apply to repo files — only to DB objects after approval.

---

## F) Documentation superseded vs current

| Area | Guidance |
|------|----------|
| **Current Phase 2A** | `docs/accounting/PHASE2A_SIGNOFF.md`, `docs/accounting/PHASE2A_QA_EVIDENCE.md`, `docs/accounting/PHASE2A_IMPLEMENTATION_REPORT.md` |
| **Phase 2B** | This inventory + `PHASE2B_LEGACY_FREEZE_PLAN.md` + `PHASE2B_CLEANUP_BATCHES.md` + `PHASE2B_DROP_CANDIDATES_REVIEW.md` + `PHASE2B_ROLLBACK_AND_SAFETY.md` |
| **Archive / caution** | Older audit SQL under `docs/audit/` may assume `ledger_entries` is live runtime; confirm against [ledgerService.ts](file:///c:/Users/ndm31/dev/Corusr/NEW%20POSV3/src/app/services/ledgerService.ts#L1-L83) first |

---

## G) Exact legacy items classified (summary table)

| Item | Class |
|------|--------|
| `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations`, `worker_ledger_entries` | **PROTECTED_LIVE** |
| Phase 2A RPCs (`get_customer_ledger_sales`, `get_financial_dashboard_metrics`, `get_contact_balances_summary`, `get_dashboard_metrics`) | **PROTECTED_LIVE** |
| `chart_accounts`, `account_transactions`, `accounting_audit_logs`, `automation_rules`, `accounting_settings` | **LEGACY_READONLY** (DB) / **DROP_CANDIDATE_REVIEW** (eventual) |
| `ledger_master`, `ledger_entries` | **LEGACY_READONLY** (DB) / **DROP_CANDIDATE_REVIEW** (eventual) |
| `backup_cr_*`, `backup_pf145_*` | **ARCHIVE_ONLY** |
| `erp-mobile-app/src/components/accounting/AccountingModule.tsx` | **ARCHIVE_ONLY** (pending removal batch) |
| Historical migration/root scripts | **ARCHIVE_ONLY** (ops); treat as dangerous without runbook |
