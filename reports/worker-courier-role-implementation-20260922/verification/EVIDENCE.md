# Worker/courier role-model — isolated Postgres evidence

- Generated: 2026-09-21T20:24:56Z
- Production writes: none
- Runner: Docker postgres:15
- Migrations: 20260922120000 + 20260922130000 + 20260922140000
- Regression: reports/worker-courier-role-implementation-20260921/postgres_regression.sql

## 1. Minimal schema
## minimal_schema
- minimal_schema: OK
## payment_stubs
- payment_stubs: OK
## 2. Role-model + payment leaf + company-auth migrations
## migration_domain
- migration_domain: OK
## migration_leaf
- migration_leaf: OK
## migration_auth
- migration_auth: OK
## migration_auth_rerun
- migration_auth_rerun: OK
## 3. Full ACL + cross-company + lifecycle + payment RPC security
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
NOTICE:  PASS: WA ensure+idempotent id=37c236b0-6183-4194-b2dd-7d4fe839a329
NOTICE:  PASS: WP ensure+idempotent id=e5e0646b-0275-4c56-8d85-d9d52f32b974
NOTICE:  PASS: courier ensure+idempotent id=5733057d-0ef4-4414-b07e-f9030b491897
NOTICE:  PASS: DHL PK distinct resolve id=a4f19720-0c94-432f-a85f-4cb6a763b9fa
NOTICE:  PASS: supplier WA fail-loud
NOTICE:  PASS: supplier WP fail-loud
NOTICE:  PASS: null-contact courier blocked
NOTICE:  PASS: supplier courier role gate
NOTICE:  PASS: ordinary supplier AP leaf id=91ec6aa7-434d-4067-9d91-d4ca5d189090
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
NOTICE:  === PAYMENT RPC ACL MATRIX ===
NOTICE:  ACL record_payment_with_accounting(p_company_id uuid, p_branch_id uuid, p_payment_type payment_type, p_reference_type character varying, p_reference_id uuid, p_amount numeric, p_payment_method payment_method_enum, p_payment_date date, p_payment_account_id uuid, p_reference_number character varying, p_notes text, p_created_by uuid): prosecdef=t anon=f auth=t svc=t public=f proacl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
NOTICE:  ACL record_payment_with_accounting(p_company_id uuid, p_branch_id uuid, p_payment_type payment_type, p_reference_type character varying, p_reference_id uuid, p_amount numeric, p_payment_method payment_method_enum, p_payment_date date, p_payment_account_id uuid, p_reference_number character varying, p_notes text, p_created_by uuid, p_worker_stage_id uuid): prosecdef=t anon=f auth=t svc=t public=f proacl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
NOTICE:  PASS: PAYMENT_RPC_ACL_PASS
NOTICE:  PASS: cross-company payment blocked sqlstate=42501 msg=PARTY_ROLE_ACCOUNT_FORBIDDEN: limited to caller company scope
NOTICE:  PASS: cross-company payment no mutation
NOTICE:  PASS: same-company worker payment → WA leaf
NOTICE:  PASS: ordinary supplier payment via RPC
NOTICE:  PASS: anon payment execute denied
NOTICE:  PASS: service_role payment path
 ROLE_MODEL_PAYMENT_RPC_SECURITY_PASS
NOTICE:  ROLE_MODEL_PAYMENT_RPC_SECURITY_PASS
 ROLE_MODEL_POSTGRES_REGRESSION_PASS
- regression: OK
## Verdict
- ROLE_MODEL_POSTGRES_REGRESSION_PASS
- ROLE_MODEL_PAYMENT_RPC_SECURITY_PASS
- PAYMENT_RPC_ACL_PASS
- Production migrate: NOT EXECUTED
- Production mutations: NONE
