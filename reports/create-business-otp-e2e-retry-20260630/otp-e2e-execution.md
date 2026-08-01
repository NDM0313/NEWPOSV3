# OTP E2E execution

**Status:** **OTP_E2E_BLOCKED_PRODUCTION_EMAIL**

## Configured identity (masked)

| Field | Value |
|-------|--------|
| Email | `d***@yahoo.com` — **rejected** (DIN CHINA production / monitoring account) |
| Business name | OTP QA Business 2026-06-30 |

## E2E steps

| Step | Result |
|------|--------|
| Open wizard / submit signup | **Not run** |
| steps → otp | **Not run** |
| OTP receive / verify | **Not run** |
| Business creation | **Not run** |

## Why blocked

`erp-mobile-app/.env` sets `QA_CREATE_BUSINESS_OTP_EMAIL` to the same address used for `QA_BROWSER_EMAIL_CHINA` (DIN CHINA production login). Running Create Business signup against this email would risk auth/session collision with live production data — explicitly forbidden.

## Operator fix

Replace with a **dedicated disposable inbox** (e.g. new Gmail/Outlook alias), then:

```powershell
$env:QA_CREATE_BUSINESS_OTP_EMAIL = "<disposable-test-only>"
$env:QA_CREATE_BUSINESS_OTP_PASSWORD = "<new-password>"
# after email arrives:
$env:QA_CREATE_BUSINESS_OTP_CODE = "<6-digit-code>"
```

Do **not** use: `admin@test.com`, `din@yahoo.com`, `ndm313@yahoo.com`, `zhd@dincouture.pk`.
