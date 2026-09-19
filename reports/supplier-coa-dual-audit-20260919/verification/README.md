# Isolated PostgreSQL verification for journal account guard

Runs against a temporary Docker Postgres 15 — **not** production.

## How to run

```bash
bash reports/supplier-coa-dual-audit-20260919/verification/run_isolated_pg.sh
```

Evidence is written to `EVIDENCE.md` in this folder (no credentials, no prod dumps).

## What is covered (real SQL)

- Migration apply; missing backup seed notice (0 rows)
- Backup-present / identity mismatch / conflicting seed / repeat identical skip
- INSERT retired without map → reject; with map → remap + **line_id** in events
- UPDATE non-key cols preserved; `journal_entry_id` reassignment revalidated
- Wrong-company reject; legacy→non-AP role remap reject
- GUC/`journal_account_guard_internal` spoof does **not** authorize inactive restore
- Privileged `repair_restore` ticket path; unauthorized SET ROLE authenticated denied
- Catalog ACLs + real `SET ROLE authenticated` / `SET ROLE service_role`
- Resolver after trigger in same transaction
- Legitimate supplier / worker / courier posting + balance/totals helpers
- Actual `01_backup` / `02_apply` / `03_rollback` scripts including missing backup, repeat no-op, post-apply edit drift

## Scope labels

| Scope | Meaning |
|---|---|
| AUTOMATIC | `journal_account_verified_remaps` |
| HISTORICAL | IBRAHIM 2 lines in `backup_coa_limited_ibrahim_v1` |
| ID LACE | **NOT IMPLEMENTED** |

## Not covered here

- Live Supabase JWT HTTP matrix (labeled NOT EXECUTED)
- UI E2E
- Production migrate / historical repair apply
