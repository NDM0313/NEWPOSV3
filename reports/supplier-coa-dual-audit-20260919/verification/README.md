# Isolated PostgreSQL verification for journal account guard

Runs against a temporary Docker Postgres 15 — **not** production.

## How to run

```bash
bash reports/supplier-coa-dual-audit-20260919/verification/run_isolated_pg.sh
```

Evidence is written to `EVIDENCE.md` in this folder (no credentials, no prod dumps).

## What is covered (real SQL)

- Migration apply atomicity (single transaction)
- Missing backup seed (0 rows + notice)
- Conflicting remap fails reviewably
- Valid remap inserts; repeat migration seed idempotent for identical maps
- INSERT retired without map → reject
- INSERT retired with map → remap + guard event
- UPDATE account_id same value only (other cols) → no remap
- UPDATE journal_entry_id with same account → re-validate company
- Wrong-company account → reject
- `allow_inactive_restore` GUC for rollback path
- Account / JE company_id reassignment blocked when lines exist
- PUBLIC execute revoked on resolver

## Not covered here

- Live Supabase JWT `authenticated` role matrix (labeled UNVERIFIED without staging project)
- Mobile/import client HTTP paths (same DB trigger covers inserts)
- UI E2E
