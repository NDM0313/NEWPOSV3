# Create Business OTP E2E execution

**Status:** BLOCKED (`OTP_CODE_NOT_PROVIDED`) — OTP gate **PASS**; full business creation **not completed**  
**Generated:** 2026-06-30  
**URL:** https://erp.dincouture.pk  
**Business name:** OTP QA Business 2026-06-30  
**Test email:** `k***+1@gmail.com` (corrected from `.env` typo `@ygmail.com`)

## Flow results

| Step | Result |
|------|--------|
| Wizard steps 1–5 | **PASS** |
| Submit signup once | **PASS** |
| Immediate dashboard before verification | **No** (`immediate_session_before_verification=false`) |
| OTP verification screen | **Yes** (`Verify your email`) |
| Auth audit | `user_confirmation_requested` (HTTP 200) |
| SMTP errors in auth logs | **None** |
| `email_confirmed_at` on signup | **null** |
| OTP code in env | **Not set** — automation cannot read Gmail inbox |
| OTP verify + business create | **Not completed** |
| Company created | **No** |

## IDs (pre-cleanup)

| Entity | ID |
|--------|-----|
| Auth user | `6a101ab0-f34d-4948-b6cb-20659b76e400` |
| Company | — (none) |

## Email / sender

- **Email dispatch (infra):** PASS — confirmation requested via Hostinger SMTP port 587
- **Inbox received:** not verified by automation — operator should confirm Gmail for ~12:40 UTC
- **Sender display NDM ERP SYSTEM:** not verified by automation — operator should confirm inbox From name

## Screenshot

`reports/create-business-otp-e2e-after-sender-name-20260630/screenshots/otp-waiting.png`

## Retry to complete E2E

```powershell
$env:QA_CREATE_BUSINESS_OTP_EMAIL = "khan5955+1@gmail.com"
$env:QA_CREATE_BUSINESS_OTP_PASSWORD = "..."  # not logged
$env:QA_CREATE_BUSINESS_OTP_CODE = "<6-digit-from-inbox>"
# Re-run signup or enter code on open OTP screen
```
