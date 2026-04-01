# Phase 2B — DROP candidates (review only)

**STOP** — This document **does not authorize** any `DROP` or destructive script. It lists **candidates** for a future, separately approved DB cleanup window.

**Updated:** 2026-04-01

Preconditions for **any** candidate:

1. `PHASE2B_LEGACY_INVENTORY.md` matches **target** database (`information_schema`).
2. No application code in `src/` or `erp-mobile-app/src/` reads the table for live UX (re-grep before DROP; include `.from('…')` and any raw SQL strings).
3. Ops / BI confirms no external dependency.
4. Full backup + `PHASE2B_ROLLBACK_AND_SAFETY.md` path agreed.

---

## Tier 1 — Legacy duplicate GL / meta cluster (DROP_CANDIDATE_REVIEW)

| Object | Repo rationale | Risk if dropped prematurely |
|--------|----------------|------------------------------|
| `chart_accounts` | App does not query; `accountingCanonicalGuard` forbids as GL truth | FKs from other legacy tables; old triggers; unknown ETL |
| `account_transactions` | Same | Same |
| `accounting_audit_logs` | No `src/` usage found | May hold compliance history |
| `automation_rules` | No `src/` usage found | Could be referenced by DB triggers — **verify** |
| `accounting_settings` | Part of the same legacy cluster created by prototype migrations/scripts | Unknown consumers / admin tooling |

**Approval tier:** DBA + product + engineering lead.

---

## Tier 2 — Duplicate supplier/user subledger (DROP_CANDIDATE_REVIEW)

| Object | Repo rationale | Risk if dropped prematurely |
|--------|----------------|------------------------------|
| `ledger_master` | App `ledgerService.ts` stubbed; no TS `.from('ledger_master')` | Historical supplier balance history; `scripts/company_reset_*` references; audit SQL |
| `ledger_entries` | Same | Same; reconciliation reports |

**Before Tier 2 DROP:** Prove supplier-facing balances match canonical path (payments + journals + `get_contact_balances_summary`) for **all** active suppliers or accept historical loss.

**Approval tier:** DBA + finance stakeholder + engineering lead.

---

## Tier 3 — Backup tables (DROP_CANDIDATE_REVIEW — usually “keep longest”)

| Pattern | Typical use | Notes |
|---------|-------------|--------|
| `backup_cr_*` | Post–company-reset snapshot | Drop only after legal/ops retention window |
| `backup_pf145_*` | Pre-void JE backup | Drop only after retention + confirmation duplicates resolved |

**Classification:** Normally **ARCHIVE_ONLY** / retain; DROP only for storage governance.

---

## Tier 4 — NOT drop candidates (explicit)

| Object | Reason |
|--------|--------|
| `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations`, `worker_ledger_entries` | **PROTECTED_LIVE** |
| `worker_ledger_entries` vs `ledger_entries` | **Different tables** — never conflate |

---

## Requires explicit approval before deletion

| Category | Examples |
|----------|----------|
| **Any Tier 1–2 table** | Full environment matrix, not “grep on laptop only” |
| **backup_* tables** | Retention policy |
| **Root scripts** | `remove-duplicate-accounting-tables.js`, `company_reset_final.sql` — **process** deletion from repo is separate from DB DROP |

---

## Review checklist (copy for ticket)

- [ ] `information_schema.tables` snapshot attached  
- [ ] FK / view / trigger dependency graph  
- [ ] Row counts (total + per company sample)  
- [ ] App bundle grep (no `.from('candidate')`)  
- [ ] ETL / report owner sign-off  
- [ ] Backup verified  
- [ ] Rollback SQL or restore plan attached  
