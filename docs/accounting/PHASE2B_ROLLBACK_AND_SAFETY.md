# Phase 2B — Rollback and safety matrix

Applies to cleanup batches in `PHASE2B_CLEANUP_BATCHES.md`. Each proposed action must have **why safe**, **rollback**, **dependency check**, **data retention**, and **audit impact**.

---

## Batch 1 — Documentation / archive notes

| Aspect | Detail |
|--------|--------|
| **Why safe** | No runtime or schema change. |
| **Rollback** | Git revert documentation commits. |
| **Dependency check** | None beyond doc link correctness. |
| **Data retention** | N/A |
| **Audit / history** | Improves traceability; no loss. |

---

## Batch 2 — Remove dead mobile `AccountingModule.tsx`

| Aspect | Detail |
|--------|--------|
| **Why safe** | `erp-mobile-app/src/App.tsx` routes to `AccountsModule`, not `AccountingModule` (import lines ~30, ~451). |
| **Rollback** | `git checkout -- path` or revert PR. |
| **Dependency check** | `rg AccountingModule erp-mobile-app/src` — must be empty or only re-export shim if kept temporarily. |
| **Data retention** | N/A (frontend only). |
| **Audit / history** | Git history retains file content. |

---

## Batch 3 — Stub / dead `ledgerService.ts` changes

| Aspect | Detail |
|--------|--------|
| **Why safe (if deleting file)** | No imports of `getOrCreateLedger` / `addLedgerEntry` outside `ledgerService.ts` (grep 2026-03-30). |
| **Rollback** | Restore file from git. |
| **Dependency check** | Re-run grep; run TypeScript build + tests. |
| **Data retention** | N/A for repo file; **DB** `ledger_*` tables unaffected. |
| **Audit / history** | Git preserves prior implementation. |

**Do not** delete `accountingCanonicalGuard.ts`.

---

## Batch 4 — DB inventory (read-only)

| Aspect | Detail |
|--------|--------|
| **Why safe** | SELECT-only against catalog + aggregates. |
| **Rollback** | N/A (no mutation). |
| **Dependency check** | Use read replica if required by policy. |
| **Data retention** | No change. |
| **Audit / history** | Read queries may appear in DB audit logs — acceptable. |

---

## Batch 5 — DB DROP or privilege revoke (future approved window only)

| Aspect | Detail |
|--------|--------|
| **Why safe** | Only after the review checklist in `PHASE2B_DROP_CANDIDATES_REVIEW.md` is complete. |
| **Rollback** | Restore from backup (logical dump or PITR); or re-CREATE TABLE from migration history + replay backup tables (`backup_cr_*`, `backup_pf145_*`) if those snapshots exist. |
| **Dependency check** | FK graph, triggers, views, RLS policies; application smoke on payments + journals + dashboard RPCs. |
| **Data retention** | **Irreversible** row loss if no backup — mandate backup **before** DROP. |
| **Audit / history** | May destroy historical duplicate subledger rows — finance must sign retention policy. |

---

## Company reset scripts (`scripts/company_reset_*.sql`)

| Aspect | Detail |
|--------|--------|
| **Why “safe”** | Only when intentionally resetting a **non-prod** or agreed tenant; **never** “cleanup” by accident. |
| **Rollback** | Depends on prior `company_reset_backup.sql` run; restore from `backup_cr_*`. |
| **Dependency check** | Lists all touched tables including `ledger_*` and `worker_ledger_entries`. |
| **Audit** | Destroys operational history for that company scope. |

---

## Live spine regression smoke (after any code Batch 2–3)

Minimum checks aligned with Phase 2A:

- Worker payment: `payments` → `journal_entries` → `journal_entry_lines` → `worker_ledger_entries`
- `get_customer_ledger_sales` with branch param
- `get_financial_dashboard_metrics` AR/AP basis vs `get_contact_balances_summary`

Record results in `PHASE2A_QA_EVIDENCE.md`-style addendum or new Phase 2B evidence file when executed.

---

## Summary

| Batch type | Default rollback |
|------------|------------------|
| Docs | Git revert |
| Frontend delete | Git revert |
| DB inventory | N/A |
| DB DROP | **Backup restore** only |

**This planning pass did not execute Batch 5 or any destructive SQL.**
