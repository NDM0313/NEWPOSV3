# ROLE_GATES.md

## Salesman identity (read-only verified)

| Field | Value |
|-------|-------|
| Email | `noman@yahoo.com` |
| Role | salesman |
| Active | true |
| Company | DIN BRIDAL |
| User id | `af1d7b5a-3f73-4268-8a4d-b0557c6d7a6d` |
| `user_branches` rows | **0** |

## Live Salesman RLS

**Status:** `NOT_RUN_CREDENTIAL_GATED`

Required env vars missing:

* `QA_BROWSER_EMAIL_SALESMAN`
* `QA_BROWSER_PASSWORD_SALESMAN`

## Limited-user gate

**Status:** `QA_IDENTITY_NOT_AVAILABLE`

Active roles in production: `admin` (5), `salesman` (7). Active Limited/easy/viewer count: **0**.

Path A (`APPROVE_CREATE_TEMP_MOBILE_QA_USERS`): **not supplied**  
Path B (`APPROVE_MOBILE_QA_ROLE_GATES_NOT_APPLICABLE`): **not supplied**

Do **not** classify as PASS or formal N/A without Path B phrase.

## Branch-restricted gate

**Status:** `QA_IDENTITY_NOT_AVAILABLE`

Salesman under test has zero branch assignments. Four other users have some `user_branches` rows, but no approved branch-restricted QA identity was designated. Path A/B not supplied.

## Admin RLS

**Status:** `HISTORICAL_PASS_NOT_RE_RUN`

Admin live RLS PASS was recorded before `a7471520` (final-closure pack). Product changes in `a7471520` were client invalidation + fail-loud UI — server RLS contracts unchanged. Fresh Admin live RLS was **not** re-executed this phase (no Admin browser password env present). Not claimed as new-head Admin PASS.
