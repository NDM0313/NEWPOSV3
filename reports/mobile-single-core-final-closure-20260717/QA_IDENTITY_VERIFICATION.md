# QA_IDENTITY_VERIFICATION.md

Generated: 2026-07-17T14:10:00.000Z (operational gates re-check)

## Credential env presence (values never logged)

| Variable | Status |
|----------|--------|
| `QA_BROWSER_EMAIL_SALESMAN` | **MISSING** |
| `QA_BROWSER_PASSWORD_SALESMAN` | **MISSING** |
| `QA_BROWSER_EMAIL_LIMITED` | **MISSING** |
| `QA_BROWSER_PASSWORD_LIMITED` | **MISSING** |
| `QA_BROWSER_EMAIL_BRANCH` | **MISSING** |
| `QA_BROWSER_PASSWORD_BRANCH` | **MISSING** |
| `QA_BROWSER_PASSWORD_CHINA` | AVAILABLE (admin) |
| `QA_BROWSER_PASSWORD_BRIDAL` | AVAILABLE (admin Bridal — not Salesman) |

## Read-only production identity verification

| Masked email | User ID | Role | Company | Active | `user_branches` count |
|---|---|---|---|---|---|
| `di***@yahoo.com` | `5257707c-710e-4b94-9767-d53e3aa4e3e9` | **admin** | DIN CHINA | true | 1 |
| `no***@yahoo.com` | `af1d7b5a-3f73-4268-8a4d-b0557c6d7a6d` | **salesman** | DIN BRIDAL | true | **0** |

**noman@yahoo.com** confirmed `salesman` / DIN BRIDAL / active via read-only SQL (not assumed from email).

## Role inventory (active users)

Production active roles present: **`admin` (5)** · **`salesman` (7)** only.

- No active `user` / limited / easy role accounts found.
- No non-admin user with a single-branch restriction pattern suitable for branch-restricted QA credentials.
- All 7 salesmen currently have **0** `user_branches` rows.

## Gate implications

| Role | Live auth possible? | Result |
|------|---------------------|--------|
| Admin | Yes (China password present) | Prior + re-check **PASS** |
| Salesman | No — password not in approved env | `NOT_RUN_CREDENTIAL_GATED` |
| Limited | No — no limited identity + no password | `NOT_RUN_CREDENTIAL_GATED` |
| Branch-restricted | No — no dedicated credentialed identity | `NOT_RUN_CREDENTIAL_GATED` |

Do **not** create users or assign passwords without explicit operator approval.
