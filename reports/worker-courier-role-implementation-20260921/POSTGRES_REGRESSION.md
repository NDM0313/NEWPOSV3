# PostgreSQL regression — worker/courier role model

**Script:** `postgres_regression.sql` (this folder)  
**Prerequisite migration:** `migrations/20260922120000_worker_courier_role_model_account_domain.sql`

## Coverage

| Case | Expected |
|------|----------|
| WA first create | `WA-*` under 1180, `linked_contact_id` set |
| WA repeat | same id |
| WA wrong company | `check_violation` |
| WA non-worker | returns 1180 control; no leaf |
| WP create + idempotent | `WP-*` under 2010 |
| Courier create + repeat | one `203x`; both `contact_id` + `linked_contact_id` |
| Courier A ≠ Courier B | distinct leaves |
| Supplier AP | still ensureable; no WA leaf |
| Worker lifecycle | WA residual 200 after apply; WP 0; TB 0 |
| Courier lifecycle | deposit/charge on 203x; no AP-SUP |

## Execution status (this machine)

| Item | Result |
|------|--------|
| Docker daemon | **Unavailable** (`Cannot connect to the Docker daemon`) |
| Isolated Postgres run | **NOT_EXECUTED** |
| Script readiness | **READY** |

Re-run when Docker (or another non-production Postgres) is available:

```bash
# Apply migration to isolated DB, then:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f reports/worker-courier-role-implementation-20260921/postgres_regression.sql
# Expect NOTICE: ROLE_MODEL_POSTGRES_REGRESSION_PASS
```

**Production apply:** NO (forbidden this phase).
