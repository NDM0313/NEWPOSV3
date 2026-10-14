# Create Business OTP E2E

**Status:** `BLOCKED_OTP_CODE_MISSING`

## Environment

| Variable | Status |
|----------|--------|
| `QA_CREATE_BUSINESS_OTP_EMAIL` | Set — `k***+1@gmail.com` (fix `.env` typo `@ygmail.com` → `@gmail.com`) |
| `QA_CREATE_BUSINESS_OTP_PASSWORD` | Set (not logged) |
| `QA_CREATE_BUSINESS_OTP_CODE` | **Not set** |

Not a forbidden production email.

## This run

Full browser E2E **not re-run** — blocked on missing OTP code (automation cannot read Gmail inbox).

## Prior validated state (`78db4d03`)

| Check | Result |
|-------|--------|
| OTP phase reached | **Yes** |
| Immediate session before verify | **No** |
| Auth `user_confirmation_requested` | **Yes** |
| Business created | **No** |
| Auth-only cleanup | **Done** |

## To complete E2E

```powershell
$env:QA_CREATE_BUSINESS_OTP_EMAIL = "khan5955+1@gmail.com"
$env:QA_CREATE_BUSINESS_OTP_CODE = "<6-digit-from-inbox>"
```

Re-run signup → verify → business **OTP QA Business 2026-06-30** → bootstrap cleanup.

Prior evidence: [`reports/create-business-otp-e2e-after-sender-name-20260630/`](../create-business-otp-e2e-after-sender-name-20260630/)
