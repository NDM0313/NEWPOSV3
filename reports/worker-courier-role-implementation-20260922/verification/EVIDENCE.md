# Worker/courier role-model — isolated Postgres evidence

- Generated: 2026-09-21T19:45:03Z
- Production writes: none
- Runner: Docker postgres:15
- Migration: migrations/20260922120000_worker_courier_role_model_account_domain.sql
- Regression: reports/worker-courier-role-implementation-20260921/postgres_regression.sql

## 1. Minimal schema
## minimal_schema
- minimal_schema: OK
## 2. Actual role-model migration
## migration
- migration: OK
## 3. Migration re-apply (idempotent functions/ACL)
## migration_rerun
- migration_rerun: OK
## 4. Full ACL + cross-company + lifecycle regression
## regression
NOTICE:  === ACL MATRIX ===
NOTICE:  ACL _ensure_worker_advance_subaccount(p_company_id uuid, p_contact_id uuid): prosecdef=t owner=postgres anon=f auth=t svc=t public=f proacl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
NOTICE:  ACL _ensure_worker_payable_subaccount(p_company_id uuid, p_contact_id uuid): prosecdef=t owner=postgres anon=f auth=t svc=t public=f proacl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
NOTICE:  ACL _party_role_account_assert_company_access(p_company_id uuid): prosecdef=f owner=postgres anon=f auth=f svc=f public=f proacl={postgres=X/postgres}
NOTICE:  ACL _party_role_account_effective_role(): prosecdef=f owner=postgres anon=f auth=f svc=f public=f proacl={postgres=X/postgres}
NOTICE:  ACL _resolve_worker_payment_debit_account(p_company_id uuid, p_worker_contact_id uuid, p_pay_to_payable boolean): prosecdef=t owner=postgres anon=f auth=t svc=t public=f proacl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
NOTICE:  ACL get_contact_party_gl_balances(p_company_id uuid, p_branch_id uuid, p_as_of_date date): prosecdef=t owner=postgres anon=f auth=t svc=t public=f proacl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
NOTICE:  ACL get_or_create_courier_payable_account(p_company_id uuid, p_contact_id uuid, p_contact_name text): prosecdef=t owner=postgres anon=f auth=t svc=t public=f proacl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
NOTICE:  PASS: ACL_MATRIX
NOTICE:  PASS: WA ensure+idempotent id=45221687-9874-469d-b0d1-84d5fbd1ceaf
NOTICE:  PASS: WP ensure+idempotent id=65667569-7e88-4e2d-86d2-79d7bbc974cb
NOTICE:  PASS: courier ensure+idempotent id=1cf225e5-b7b4-4a8e-a7b3-f819ce2bef67
NOTICE:  PASS: DHL PK distinct resolve id=5cfc0710-c562-4044-be0c-7ba14e0f44ec
NOTICE:  PASS: supplier WA fail-loud
NOTICE:  PASS: supplier WP fail-loud
NOTICE:  PASS: null-contact courier blocked
NOTICE:  PASS: supplier courier role gate
NOTICE:  PASS: ordinary supplier AP leaf id=387bbd6a-1d28-4224-a3e4-1ce26d844945
NOTICE:  PASS: worker payment resolver
NOTICE:  PASS: concurrency/unique-path WA stable
NOTICE:  PASS: authenticated same-company WA/WP/courier/resolver/GL
NOTICE:  PASS: cross-company WA blocked sqlstate=42501 msg=PARTY_ROLE_ACCOUNT_FORBIDDEN: limited to caller company scope
NOTICE:  PASS: cross-company WP blocked sqlstate=42501 msg=PARTY_ROLE_ACCOUNT_FORBIDDEN: limited to caller company scope
NOTICE:  PASS: cross-company courier blocked sqlstate=42501 msg=PARTY_ROLE_ACCOUNT_FORBIDDEN: limited to caller company scope
NOTICE:  PASS: cross-company resolver blocked sqlstate=42501 msg=PARTY_ROLE_ACCOUNT_FORBIDDEN: limited to caller company scope
NOTICE:  PASS: cross-company GL blocked sqlstate=42501 msg=PARTY_ROLE_ACCOUNT_FORBIDDEN: limited to caller company scope fingerprint=CO-B
NOTICE:  PASS: wrong-company contact WA blocked msg=WORKER_ADVANCE_WRONG_COMPANY: contact 22222222-2222-2222-2222-222222222222 does not belong to company aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
NOTICE:  PASS: auth null-contact courier blocked
NOTICE:  PASS: cross-company no mutation co_b_accounts=7
NOTICE:  PASS: anon WA execute denied
NOTICE:  PASS: anon courier execute denied
NOTICE:  PASS: service_role WA path
NOTICE:  PASS: worker lifecycle WA=600 WP=0 TB_diff=0
NOTICE:  PASS: courier lifecycle 203x balanced no AP leaf
NOTICE:  ROLE_MODEL_POSTGRES_REGRESSION_PASS
 ROLE_MODEL_POSTGRES_REGRESSION_PASS
- regression: OK
## Verdict
- ROLE_MODEL_POSTGRES_REGRESSION_PASS
- Production migrate: NOT EXECUTED
- Production mutations: NONE
