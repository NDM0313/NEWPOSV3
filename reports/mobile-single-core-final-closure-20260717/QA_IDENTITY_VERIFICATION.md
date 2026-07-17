# QA_IDENTITY_VERIFICATION.md

Generated: 2026-07-17T13:33:03.780Z

## Read-only production records

| Masked email | User ID | Role | Company | Active |
|---|---|---|---|---|
| di***@yahoo.com | 5257707c-710e-4b94-9767-d53e3aa4e3e9 | admin | DIN CHINA | true |
| no***@yahoo.com | af1d7b5a-3f73-4268-8a4d-b0557c6d7a6d | salesman | DIN BRIDAL | true |

**noman@yahoo.com** verified as `salesman` / DIN BRIDAL / active (not assumed from email alone).

## Credential availability

| Role | Env email var | Password var | Status |
|---|---|---|---|
| Admin DIN CHINA | din@yahoo.com | QA_BROWSER_PASSWORD_CHINA | AVAILABLE |
| Salesman | QA_BROWSER_EMAIL_SALESMAN | QA_BROWSER_PASSWORD_SALESMAN | MISSING |
| Limited | QA_BROWSER_EMAIL_LIMITED | QA_BROWSER_PASSWORD_LIMITED | MISSING |
| Branch | QA_BROWSER_EMAIL_BRANCH | QA_BROWSER_PASSWORD_BRANCH | MISSING |
