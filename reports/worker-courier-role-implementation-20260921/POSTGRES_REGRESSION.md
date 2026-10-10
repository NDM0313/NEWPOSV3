# PostgreSQL regression — worker/courier role model

**Script:** `postgres_regression.sql` (this folder)  
**Prerequisite migration:** `migrations/20260922120000_worker_courier_role_model_account_domain.sql`  
**Harness:** `reports/worker-courier-role-implementation-20260922/verification/run_isolated_pg.sh`  
**Minimal schema:** `…/20260922/verification/00_minimal_schema.sql`

## Coverage (actual migration functions — not approximations)

| Case | Expected |
|------|----------|
| ACL matrix PUBLIC/anon/auth/service_role | PUBLIC+anon deny; auth+service grant on entrypoints |
| WA first create | `WA-*` under 1180, `linked_contact_id` set |
| WA repeat | same id |
| WA wrong company / cross-company auth | `insufficient_privilege` / wrong-company; **0 mutations** |
| WA non-worker | fail-loud `WORKER_ADVANCE_ROLE_REQUIRED` (no control fallback) |
| WP create + idempotent | `WP-*` under 2010 |
| Courier create + repeat | one `203x`; both `contact_id` + `linked_contact_id` |
| Courier null contact | `COURIER_ACCOUNT_CONTACT_REQUIRED` |
| Courier non-courier type | `COURIER_ACCOUNT_ROLE_REQUIRED` |
| DHL existing 2031 | same id; no duplicate |
| Anon EXECUTE | denied |
| Authenticated same-company | succeeds |
| Supplier AP | still ensureable; no WA leaf |
| Worker lifecycle | WA residual 600; WP 0; TB 0 |
| Courier lifecycle | deposit/charge/settle on 203x; no AP-SUP |

## Execution status

| Item | Result |
|------|--------|
| Docker postgres:15 isolated | **EXECUTED 2026-09-22** |
| Marker | **`ROLE_MODEL_POSTGRES_REGRESSION_PASS`** |
| Evidence | `reports/worker-courier-role-implementation-20260922/verification/EVIDENCE.md` |
| Prior session | NOT_EXECUTED (Docker unavailable) — superseded |

Re-run:

```bash
bash reports/worker-courier-role-implementation-20260922/verification/run_isolated_pg.sh
```

**Production apply:** NO (forbidden this phase).
