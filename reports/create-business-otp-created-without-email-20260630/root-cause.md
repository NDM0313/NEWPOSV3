# Root cause

**Classification:** `SIGNUP_AUTO_CONFIRM_ENABLED`

## What happened

1. Operator signed up via Create Business wizard with `k***+1@gmail.com`.
2. Production GoTrue has **`GOTRUE_MAILER_AUTOCONFIRM=true`**.
3. `auth.users.email_confirmed_at` was set **immediately** at signup (2026-06-30T10:42:19Z).
4. `supabase.auth.signUp` returned an **active session** (`hasSession=true`).
5. `businessService.createBusiness` only enters OTP phase when `needsEmailVerification` (= user exists **without** session). With autoconfirm, it skipped OTP and called `create_business_transaction` directly.

## Email delivery

SMTP points to internal `supabase-mail` with `fake_sender` — verification emails are **not delivered to real Gmail inboxes** even when autoconfirm is off. Operator not seeing email is expected in current infra.

## Code alignment

Frontend logic in `authSignupService.ts` / `businessService.ts` is **consistent with Supabase behavior** when autoconfirm is on. The gap is **production auth configuration**, not a missing OTP UI step.

## Fix (separate approval required)

- Set `GOTRUE_MAILER_AUTOCONFIRM=false` on production.
- Configure real SMTP (or Supabase-managed email) for OTP delivery.
- Re-test signup before any new QA signups.

Do **not** run another signup until autoconfirm/SMTP is fixed.
