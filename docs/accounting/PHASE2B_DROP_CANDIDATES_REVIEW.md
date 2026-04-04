# Phase 2B — DROP candidates (review only)

**STOP** — This document **does not authorize** any `DROP` or destructive script. It lists **candidates** for a future, separately approved DB cleanup window.

**Updated:** 2026-04-05 (Batch 4 live ingest — COMPLETE)

Preconditions for **any** candidate:

1. `PHASE2B_LEGACY_INVENTORY.md` matches **target** database (`information_schema`).
2. No application code in `src/` or `erp-mobile-app/src/` reads the table for live UX (re-grep before DROP; include `.from('…')` and any raw SQL strings).
3. Ops / BI confirms no external dependency.
4. Full backup + `PHASE2B_ROLLBACK_AND_SAFETY.md` path agreed.

---

## Batch 4 — DB inventory (read-only)

**Authoritative runbook:** [PHASE2B_DB_INVENTORY_REPORT.md](./PHASE2B_DB_INVENTORY_REPORT.md)

**Status:** **COMPLETE** (2026-04-05) — live findings in inventory **§8** / **§9.4**. **Verified:** `journal_entry_lines.account_id` → **`accounts.id`**; **no** live FK from `journal_entry_lines.account_id` to `chart_accounts.id`.

**Tier 1 posture (live-aware):** Remains **DROP_CANDIDATE_REVIEW** — **not** auto-approved. The spine is **not** blocked by a `journal_entry_lines` → `chart_accounts` FK, but Tier 1 still has **internal FKs** to `chart_accounts`, **triggers** (`update_account_balance`, `update_updated_at_column`), and **RLS**. Row counts for most Tier 1 tables are **0** in the verified target; dropping still requires DBA + product + engineering approval and full dependency handling (see Tier 1 table).

**Spine FK migration (Batch 5 prereq):** **Not required** for repointing `journal_entry_lines` away from `chart_accounts` — live DB already references **`accounts`**. Any future Tier 1 `DROP` still needs its **own** plan (dependent FKs/triggers/RLS).

**Batch 5:** **Not approved** in this pass.

**Destructive action approved:** **NO**

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
