# Phase 2B — Legacy accounting freeze plan

**Status:** Planning only (no DB drops or destructive runs in this document).  
**Phase 2A source of truth:** `docs/accounting/PHASE2A_SIGNOFF.md` — **READY FOR PHASE 2B LEGACY FREEZE = YES**, with DB/runtime evidence in `docs/accounting/PHASE2A_QA_EVIDENCE.md` and `migrations/20260370_phase2a2_ledger_sales_branch_dashboard_contact_ar_ap.sql` applied on the verified environment.

**Related:** `PHASE2B_LEGACY_INVENTORY.md`, `PHASE2B_CLEANUP_BATCHES.md`, `PHASE2B_DROP_CANDIDATES_REVIEW.md`, `PHASE2B_ROLLBACK_AND_SAFETY.md`.

---

## 1. Objectives

1. **Freeze** legacy accounting storage and scripts so they are not treated as sources of truth for new features.
2. **Protect** the live spine verified in Phase 2A.
3. **Plan** safe, batched cleanup (repo + DB review) with explicit approval gates.

---

## 2. Protected live spine (do not break)

These are **PROTECTED_LIVE** for product behavior and Phase 2A evidence:

| Layer | Objects |
|--------|---------|
| **Tables** | `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations`, `worker_ledger_entries` |
| **RPCs / metrics (verified)** | `get_customer_ledger_sales(...)`, `get_financial_dashboard_metrics(company_id, branch_id)`, `get_contact_balances_summary`, `get_dashboard_metrics` (and callers in web/mobile per Phase 2A docs) |
| **Operational documents** | `sales`, `purchases`, `contacts`, `workers`, and other domains that feed GL or open-item views (see inventory for detail) |

**Engineering rules**

- No new reads of legacy tables for **GL truth** or primary UI totals (align with `src/app/services/accountingCanonicalGuard.ts`).
- New accounting features must extend the spine above or approved RPCs, not `chart_accounts` / `account_transactions` / duplicate supplier `ledger_*` subledger.

---

## 3. Legacy cluster — freeze semantics

| Item | Freeze treatment |
|------|------------------|
| **`chart_accounts`, `account_transactions`, `accounting_audit_logs`, `automation_rules`** | **Read-only at product level:** no new app code; **DB rows** retained until an approved archival/migration phase. Treat as **LEGACY_READONLY** / historical. |
| **`ledger_master`, `ledger_entries`** (supplier/user duplicate subledger) | **App:** `src/app/services/ledgerService.ts` is explicitly stubbed (no-op / empty reads); **no** `src/**/*.ts(x)` `.from('ledger_master')` or `.from('ledger_entries')` found in repo search (2026-03-30). **DB:** may still hold historical rows; **no drops** until inventory + stakeholder sign-off. Classify as **LEGACY_READONLY** (data) + **DROP_CANDIDATE_REVIEW** (eventual, after parity proof). |
| **`backup_cr_*`, `backup_pf145_*`** | **ARCHIVE_ONLY** — created by `scripts/company_reset_backup.sql` and `migrations/pf145_backup_tables_and_fingerprint.sql`; must never back live UI (`accountingCanonicalGuard` blocks `backup_*`). |

---

## 4. What becomes “read-only”

| Surface | Meaning |
|---------|---------|
| **Product application** | Legacy tables are not queried from `src/` or `erp-mobile-app/src/` for live flows (guard + Phase 2A scans; ledger stub). |
| **Database** | Physical RLS / revoke-write is **optional** and **not** done in Phase 2B first pass; requires DBA review so triggers or one-off repair jobs are not broken. Default freeze = **policy + code**, not forced DDL. |
| **New development** | Legacy names are **excluded** from design docs for new features; use spine + registry docs. |

---

## 5. Deprecated for future development

Document and treat as **deprecated**:

- Using `chart_accounts` / `account_transactions` as COA or posting truth (superseded by `accounts` + `journal_*`).
- Using supplier `ledger_master` / `ledger_entries` for new supplier balance UI (canonical path: purchases, payments, journals, `get_contact_balances_summary` where applicable).
- Running root-level migration scripts (`complete-migration.js`, `remove-duplicate-accounting-tables.js`) without a reviewed runbook — see `PHASE2B_CLEANUP_BATCHES.md`.

---

## 6. What must remain temporarily

| Category | Reason |
|----------|--------|
| **Legacy DB tables** | Audit trail, forensic queries, and gradual migration off duplicate subledgers. |
| **Backup tables** | Point-in-time recovery after company reset / PF-14.5 style operations. |
| **Audit SQL under `docs/audit/`** | Historical investigation playbooks. |
| **`scripts/company_reset_*.sql`** | Operational reset procedures; not “accounting feature” code but tied to same tables. |

---

## 7. Approvals before any DROP

See `PHASE2B_DROP_CANDIDATES_REVIEW.md`. No `DROP TABLE` on the legacy cluster until:

1. Row counts / dependents confirmed on **target** database.
2. No ETL, external report, or nightly job still reading those tables (ops confirmation).
3. Backup + rollback documented (`PHASE2B_ROLLBACK_AND_SAFETY.md`).

---

## 8. Deliverable checklist (this phase)

| Step | Owner | Done when |
|------|--------|-----------|
| Inventory published | Eng | `PHASE2B_LEGACY_INVENTORY.md` |
| Batches defined | Eng | `PHASE2B_CLEANUP_BATCHES.md` |
| Drop candidates listed (review-only) | Eng + DBA | `PHASE2B_DROP_CANDIDATES_REVIEW.md` |
| Rollback/safety | Eng | `PHASE2B_ROLLBACK_AND_SAFETY.md` |

**No low-risk non-destructive cleanup was applied in the authoring of these Phase 2B planning files** — documentation only.
