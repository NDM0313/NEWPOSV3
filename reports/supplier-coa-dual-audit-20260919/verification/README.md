# Isolated PostgreSQL verification for journal account guard

Runs against a temporary Docker Postgres 15 — **not** production.

## How to run

```powershell
powershell -File reports/supplier-coa-dual-audit-20260919/verification/run_isolated_pg.ps1
```

Evidence: `EVIDENCE.md` (no credentials, no prod dumps).

## Covered (real SQL / real scripts)

- Migration + missing-backup seed notice
- Seed identity / conflict / repeat skip
- Remap + line_id events; GUC spoof rejected
- SET ROLE authenticated / service_role ACL matrix
- **Direct `_journal_account_guard_resolve_public_core` cross-company fail** (self-auth)
- Helper ACL inventory (core/internal/repair_internal/assert/tickets)
- **Atomic failed backup leaves no durable schema**
- Actual `01_backup` / `02_apply` / `03_rollback`
- **Backup rerun → BACKUP_EXISTS, preserves run_id + post_apply**
- Apply / repeat apply / drift / rollback / repeat rollback
- Supplier / worker / courier posting + balance helpers

## Scope

| Scope | Status |
|---|---|
| AUTOMATIC remaps | `journal_account_verified_remaps` |
| HISTORICAL repair | IBRAHIM 2 lines only |
| ID LACE | **NOT IMPLEMENTED** |

## Not covered / unverified

- Staging migrate apply
- Live Supabase JWT HTTP matrix
- UI E2E
- Production migrate / historical repair
