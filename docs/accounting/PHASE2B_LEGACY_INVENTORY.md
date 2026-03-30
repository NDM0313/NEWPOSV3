# Phase 2B — Legacy accounting inventory

**Generated:** 2026-03-30  
**Method:** Repository grep of `src/`, `erp-mobile-app/src/`, plus representative `migrations/`, `scripts/`, `docs/` references. **Not** a live DB catalog — run `information_schema` / row-count scripts on each environment before any DROP.

**Classifier key:** **PROTECTED_LIVE** | **LEGACY_READONLY** | **ARCHIVE_ONLY** | **DROP_CANDIDATE_REVIEW**

---

## A) Live accounting spine — PROTECTED_LIVE

| Object | Runtime use (evidence) | Notes |
|--------|-------------------------|--------|
| `accounts` | Widespread `accountingService`, COA UI | GL COA |
| `journal_entries`, `journal_entry_lines` | AccountingContext, posting services, dashboard GL cards | Canonical GL |
| `payments` | Worker/supplier payment flows, Roznamcha | Phase 2A worker chain verified |
| `payment_allocations` | Migrations `20260355`–`20260361` etc.; app services as deployed | AR/AP allocation parity phase |
| `worker_ledger_entries` | `erp-mobile-app/src/api/accounts.ts`, `src/app/services/studioProductionService.ts`, `workerPaymentService.ts`, etc. | **Not** the same as `ledger_entries` |
| **RPCs (Phase 2A verified)** | `get_customer_ledger_sales`, `get_financial_dashboard_metrics`, `get_contact_balances_summary`, `get_dashboard_metrics` | See `PHASE2A_QA_EVIDENCE.md` |

Supporting operational tables (non-exhaustive; still **PROTECTED_LIVE** for product): `sales`, `purchases`, `contacts`, `workers`, `studio_productions`, … — only listed where they feed accounting UX.

---

## B) Legacy table cluster — classification

### B.1 `chart_accounts`, `account_transactions`, `accounting_audit_logs`, `automation_rules`

| Dimension | Finding |
|-----------|---------|
| **App TS (`src/`, `erp-mobile-app/src/`)** | **No** `.from('…')` queries located; only **guard** strings in `src/app/services/accountingCanonicalGuard.ts` (lines ~26–27, ~100–101) — deny-list, not DB reads. |
| **Root scripts** | `complete-migration.js` **creates** these; `remove-duplicate-accounting-tables.js` lists drops; `verify-accounting-integrity.js` checks **existence** only. |
| **Classification** | **LEGACY_READONLY** (if present in DB). **DROP_CANDIDATE_REVIEW** after environment inventory + approval. |

### B.2 `ledger_master`, `ledger_entries` (supplier/user subledger — not `worker_ledger_entries`)

| Dimension | Finding |
|-----------|---------|
| **App TS** | **No** `.from('ledger_master')` / `.from('ledger_entries')` in `src/**/*.ts(x)` or `erp-mobile-app/**/*.ts(x)` (search 2026-03-30). |
| **Stub** | `src/app/services/ledgerService.ts` — header states duplicate subledger removed from app; `getOrCreateLedger` / `addLedgerEntry` / `getLedgerEntries` return `null` / `[]`. **No other file imports** `getOrCreateLedger` (grep: only `ledgerService.ts`). |
| **DB / migrations** | `migrations/ledger_master_and_entries.sql`, `migrations/ledger_master_ledger_entries_rls_insert_update.sql`; walk-in consolidation migrations reference `ledger_master`. |
| **Ops / audit** | `scripts/run-supplier-ledger-verification.js`, `docs/audit/supplier_ledger_verification.sql`, `scripts/company_reset_*.sql` — **DB-dependent** scripts, not bundled in app bundle. |
| **Classification** | **LEGACY_READONLY** (historical rows). **DROP_CANDIDATE_REVIEW** only after proving no external consumer and supplier parity on journals + payments + contact summary. |

---

## C) Backup / archive tables — ARCHIVE_ONLY

| Pattern | Origin in repo | App behavior |
|---------|----------------|--------------|
| `backup_cr_*` | `scripts/company_reset_backup.sql` (e.g. `backup_cr_ledger_master`, `backup_cr_journal_entries`, …) | Guard treats `backup_cr` as forbidden for GL truth (`accountingCanonicalGuard.ts` ~28–29, ~103–104). |
| `backup_pf145_*` | `migrations/pf145_backup_tables_and_fingerprint.sql` (`backup_pf145_journal_entries`, `backup_pf145_journal_entry_lines`) | Same guard rule for `backup_pf145`. |

**Classification:** **ARCHIVE_ONLY** — retain for recovery; never wire to live UI.

---

## D) Dead / mock frontend files

| File | Evidence | Classification |
|------|----------|----------------|
| `erp-mobile-app/src/components/accounting/AccountingModule.tsx` | Not imported by `erp-mobile-app/src/App.tsx` (App uses `AccountsModule` ~line 30, ~451) | **ARCHIVE_ONLY** (repo) / remove in **Batch 2** after stakeholder OK (`PHASE2A_OPEN_ITEMS.md`). |
| `Figma Mobile ERP App Design/.../AccountingModule.tsx` | Design mirror | **ARCHIVE_ONLY** — exclude from production builds by default. |

---

## E) Scripts and migrations (not live app, but operational risk)

| Path | Role |
|------|------|
| `scripts/company_reset_backup.sql`, `company_reset_final.sql`, `company_reset_preview.sql`, `company_reset_verify.sql` | Destructive **when run**; references `ledger_master`, `ledger_entries`, `worker_ledger_entries`, `backup_cr_*` |
| `scripts/run-supplier-ledger-verification.js`, `scripts/run-real-duplicates-audit.js` | Audit legacy supplier ledger path in **DB** |
| `complete-migration.js`, `remove-duplicate-accounting-tables.js`, `repair-accounting-db.js` | **High risk** if executed on prod without review |
 Root `migrations/*.sql` | Historical DDL; **do not re-run** blindly |

**Classification:** **ARCHIVE_ONLY** as artifacts; **DROP_CANDIDATE_REVIEW** does **not** apply to repo files — only to DB objects after approval.

---

## F) Documentation superseded vs current

| Area | Guidance |
|------|----------|
| **Current** | Phase 2A set: `PHASE2A_SIGNOFF.md`, `PHASE2A_QA_EVIDENCE.md`, `PHASE2A_IMPLEMENTATION_REPORT.md`, link maps (`ACCOUNTING_LINK_MAP_*.md`). |
| **Archive / caution** | Older audit SQL under `docs/audit/` may assume `ledger_entries` as live path — cross-check with `ledgerService.ts` stub before following verbatim. |
| **Phase 2B** | This inventory + freeze plan supersede ad-hoc “delete legacy” notes unless updated. |

---

## G) Exact legacy items classified (summary table)

| Item | Class |
|------|--------|
| `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations`, `worker_ledger_entries` | **PROTECTED_LIVE** |
| Phase 2A RPCs (`get_customer_ledger_sales`, `get_financial_dashboard_metrics`, `get_contact_balances_summary`, `get_dashboard_metrics`) | **PROTECTED_LIVE** |
| `chart_accounts`, `account_transactions`, `accounting_audit_logs`, `automation_rules` | **LEGACY_READONLY** (DB) / **DROP_CANDIDATE_REVIEW** (eventual) |
| `ledger_master`, `ledger_entries` | **LEGACY_READONLY** (DB) / **DROP_CANDIDATE_REVIEW** (eventual) |
| `backup_cr_*`, `backup_pf145_*` | **ARCHIVE_ONLY** |
| `erp-mobile-app/src/components/accounting/AccountingModule.tsx` | **ARCHIVE_ONLY** (pending removal batch) |
| Historical migration/root scripts | **ARCHIVE_ONLY** (ops); treat as dangerous without runbook |
