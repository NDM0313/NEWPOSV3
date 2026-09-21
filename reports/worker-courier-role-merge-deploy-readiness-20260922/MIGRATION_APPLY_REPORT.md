# Capability migration apply report

**Host:** `dincouture-vps` / container `supabase-db`  
**Runner:** `bash deploy/run-migrations-vps.sh`  
**Repo HEAD at apply:** `356819d0759948f1583c3b9f22e9dded4d9f2529`  
**DB migrate user:** `supabase_admin`

## Pre-apply dry discovery

Using the same APPLIED `|name|` pipe logic as `run-migrations-vps.sh`:

```
WOULD_RUN: 20260922120000_worker_courier_role_model_account_domain.sql
WOULD_RUN: 20260922130000_record_payment_worker_role_leaf_debit.sql
WOULD_RUN: 20260922140000_record_payment_company_auth_and_acl.sql
```

No unrelated historical migrations would re-run.

## Apply results

| Migration | Result | `schema_migrations.applied_at` (UTC) |
|-----------|--------|--------------------------------------|
| `20260922120000_worker_courier_role_model_account_domain.sql` | APPLY / OK | `2026-09-21 21:14:57.034608+00` |
| `20260922130000_record_payment_worker_role_leaf_debit.sql` | APPLY / OK | `2026-09-21 21:14:57.509071+00` |
| `20260922140000_record_payment_company_auth_and_acl.sql` | APPLY / OK | `2026-09-21 21:14:57.999031+00` |

Bookkeeping: **exactly one row each**.

## Repeat discovery / second runner pass

During subsequent `deploy/deploy.sh` migrate phase, all three showed:

`SKIP (already applied)`

No duplicate function/account creation side effects observed for target parties.

## Verdict

`ROLE_MODEL_CAPABILITY_MIGRATIONS_APPLIED_PASS`
