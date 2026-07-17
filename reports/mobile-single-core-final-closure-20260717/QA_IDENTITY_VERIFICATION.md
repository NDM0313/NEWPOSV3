# QA_IDENTITY_VERIFICATION.md

Generated: 2026-07-17 (resource-gated re-check)

## Credential env presence (values never logged)

| Variable | Status |
|----------|--------|
| `QA_BROWSER_EMAIL_SALESMAN` | **MISSING** |
| `QA_BROWSER_PASSWORD_SALESMAN` | **MISSING** |
| `QA_BROWSER_EMAIL_LIMITED` | **MISSING** |
| `QA_BROWSER_PASSWORD_LIMITED` | **MISSING** |
| `QA_BROWSER_EMAIL_BRANCH` | **MISSING** |
| `QA_BROWSER_PASSWORD_BRANCH` | **MISSING** |
| `QA_BROWSER_PASSWORD_CHINA` | AVAILABLE (admin only) |

## Verified Salesman identity (read-only)

| Field | Value |
|-------|--------|
| Masked email | `no***@yahoo.com` |
| User ID | `af1d7b5a-3f73-4268-8a4d-b0557c6d7a6d` |
| Role | **salesman** |
| Company | DIN BRIDAL |
| Active | true |
| `user_branches` count | **0** |

## Limited / branch identity search

| Search | Result |
|--------|--------|
| Active limited/easy/viewer/staff QA users | **None** → `QA_IDENTITY_NOT_AVAILABLE` |
| Staging/test emails (`%qa%`, `%test%`, `%mobile%`) | **None** |
| Inactive users | 1 inactive salesman (`ab***@yahoo.com` / DIN BRIDAL) — wrong role |
| Active roles present | admin (5), salesman (7) only |

## Temp user approval

Phrase `APPROVE_CREATE_TEMP_MOBILE_QA_USERS`: **NOT SUPPLIED**

Plan prepared (not executed): `TEMP_QA_USER_PLAN.md` via approved `create-erp-user` workflow.
