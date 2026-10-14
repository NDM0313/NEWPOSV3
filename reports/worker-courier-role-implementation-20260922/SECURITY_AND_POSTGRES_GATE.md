# Security and PostgreSQL gate — worker/courier role model

**Date:** 2026-09-22  
**Branch:** `feat/worker-courier-role-model-implementation`  
**Starting SHA (provisional):** `7f07317037b3b42ade4e4c8d303a536ac8fab20f`  
**Prior claimed verdict:** `PROSPECTIVE_ROLE_MODEL_ENGINEERING_READY`  
**Reclassified as:** `PROVISIONAL_NOT_READY_FOR_STAGING_CUTOVER` until this gate closed.

## Original security finding

Several role-account functions are `SECURITY DEFINER` and accept client-supplied `p_company_id`. The initial migration did not prove that an authenticated caller belongs to / is operating in that company before privileged account creation/update.

Affected surfaces:

| Function | Risk |
|----------|------|
| `_ensure_worker_advance_subaccount(uuid, uuid)` | Cross-tenant WA leaf create/update |
| `_ensure_worker_payable_subaccount(uuid, uuid)` | Cross-tenant WP leaf create/update |
| `get_or_create_courier_payable_account(uuid, uuid, text)` | Cross-tenant 2030/203x create/update; null-contact attack |
| `_resolve_worker_payment_debit_account(uuid, uuid, boolean)` | Bypass via ensure wrappers |
| `get_contact_party_gl_balances(uuid, uuid, date)` | Cross-tenant ledger read |

**Assumption rejected:** RLS does not protect writes inside `SECURITY DEFINER` functions.

## Authorization mechanism chosen

Canonical pattern (aligned with journal account guard):

1. `_party_role_account_effective_role()` — session role via `current_setting('role')` / `session_user`; **never** client GUCs as privilege proof.
2. `_party_role_account_assert_company_access(p_company_id)`:
   - `authenticated` → `get_user_company_id()` must equal `p_company_id` or raise `insufficient_privilege` (`42501`).
   - `service_role` / `postgres` / `supabase_admin` → allowed.
   - all other roles → forbidden.
3. Architecture: **Option A** — client-callable SECURITY DEFINER entrypoints self-authorize before any mutation.
4. Wrong role: fail-loud (`WORKER_*_ROLE_REQUIRED` / `COURIER_ACCOUNT_ROLE_REQUIRED`) — **no** silent control fallback for browser callers.
5. Courier: `p_contact_id IS NULL` → `COURIER_ACCOUNT_CONTACT_REQUIRED`; new leaf requires `contacts.type = courier` (no name heuristics).

## Effective ACL matrix (after migration + re-apply)

Isolated Postgres 15 catalog check (`has_function_privilege` + `proacl`):

| Function | prosecdef | PUBLIC | anon | authenticated | service_role |
|----------|-----------|--------|------|---------------|--------------|
| `_ensure_worker_advance_subaccount` | t | f | f | t | t |
| `_ensure_worker_payable_subaccount` | t | f | f | t | t |
| `get_or_create_courier_payable_account` | t | f | f | t | t |
| `_resolve_worker_payment_debit_account` | t | f | f | t | t |
| `get_contact_party_gl_balances` | t | f | f | t | t |
| `_party_role_account_assert_company_access` | f | f | f | f | f (owner-only) |
| `_party_role_account_effective_role` | f | f | f | f | f (owner-only) |

`CREATE OR REPLACE` preserves unsafe ACLs historically — mitigation: **explicit `REVOKE ALL … FROM PUBLIC/anon` + `GRANT EXECUTE` to intended roles after every replace**. Migration re-apply verified deterministic.

## Cross-company / anon / same-company results

| Test | Result |
|------|--------|
| Auth Co A → WA/WP/courier/resolver/GL Co A | PASS |
| Auth Co A → WA/WP/courier/resolver/GL Co B | FAIL `42501` PARTY_ROLE_ACCOUNT_FORBIDDEN; **0 mutations** on Co B |
| Auth Co A + Co B contact on Co A | FAIL wrong-company contact |
| Auth null-contact courier | FAIL `COURIER_ACCOUNT_CONTACT_REQUIRED` |
| Anon WA / courier EXECUTE | DENIED |
| Supplier → WA/WP/courier leaf | FAIL role required (fail-loud) |
| Ordinary supplier AP | PASS `AP-*` |
| DHL existing 2031 resolve | PASS same id, no duplicate |
| Worker lifecycle residuals | WA=600 WP=0 TB=0 |
| Courier lifecycle | 203x balanced; no AP-SUP |
| service_role path | PASS |

## Actual PostgreSQL result

| Item | Value |
|------|--------|
| Runner | Docker `postgres:15` via `run_isolated_pg.sh` |
| Evidence | `reports/worker-courier-role-implementation-20260922/verification/EVIDENCE.md` |
| Marker | **`ROLE_MODEL_POSTGRES_REGRESSION_PASS`** |
| Production DB | **NOT USED** |

## CI

| Item | Value |
|------|--------|
| Workflow YAML (shipped in evidence) | `reports/worker-courier-role-implementation-20260922/worker-courier-role-model-regression.yml` |
| Install path | copy to `.github/workflows/` after token has `workflow` scope |
| Scope | feature branch only; no deploy |
| Push blocker this session | GitHub OAuth token lacked `workflow` scope (`refusing to allow an OAuth App to create or update workflow`) |
| Local isolated PG | **PASS** (authoritative gate this phase) |
| GHA run URL | **NOT_EXECUTED** (workflow file not on default Actions path until scope refresh) |

To enable CI later:

```bash
gh auth refresh -h github.com -s repo,workflow,read:org,gist
cp reports/worker-courier-role-implementation-20260922/worker-courier-role-model-regression.yml \
  .github/workflows/
git add .github/workflows/worker-courier-role-model-regression.yml && git commit && git push
```

## Client tests

| Suite | Result |
|-------|--------|
| `journalPartyPosting.node.test.ts` | PASS (5) via `tsx --test` |
| `partyRoleAccountRouting.node.test.ts` | PASS (4) via `tsx --test` |
| Combined | **9/9 PASS** |

## Remaining limitations

1. Production / staging migration still **not** applied (intentional).
2. Contact type flips (DHL/KIRAN/SHAHMIM) still owner-gated.
3. Full JWT/E2E against live Supabase auth not executed (SET ROLE + `get_user_company_id` stub mirrors JE-guard isolated pattern).
4. `_resolve_worker_payment_debit_account` not yet wired into every payment RPC (TS paths leaf-aware).

## Final gate verdict (this document)

Ready for staging cutover engineering only when ALL of: SECURITY DEFINER company auth proven, ACL safe, cross-company fail, real PG PASS, client PASS, no production mutation.

See commit message / return block for `PROSPECTIVE_ROLE_MODEL_ENGINEERING_READY_FOR_STAGING` vs `NOT_READY`.
