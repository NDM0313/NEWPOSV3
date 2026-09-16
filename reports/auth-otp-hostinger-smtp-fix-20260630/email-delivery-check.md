# Email delivery dry check

**Generated:** 2026-06-30  
**Test email:** `k***+otp-infra-20260630@gmail.com` (disposable Gmail plus-address)

## Signup behavior (autoconfirm=false)

| Check | Result |
|-------|--------|
| Signup HTTP status | **200** |
| Auth audit action | **`user_confirmation_requested`** (not auto-confirm) |
| `email_confirmed_at` on signup | **null** (`confirmed=false` in DB) |
| Immediate session / access token | **No** |
| Company created | **No** (`company_count=0`) |
| SMTP errors in `supabase-auth` logs | **None** on port **587** |

## Cleanup

Test auth user `2765ad0a-5b3a-4237-b06c-b417b2cf5a84` deleted from `auth.users` and `auth.identities` after dry check. No company/bootstrap data existed.

## Inbox note

Automated run cannot read the Gmail inbox. Auth infra indicates successful confirmation-mail dispatch (no SMTP failure, confirmation flow engaged). Operator may confirm receipt in the test inbox for the signup window (~11:47 UTC).

## Port 465

Not attempted — port **587** succeeded without SMTP errors.
