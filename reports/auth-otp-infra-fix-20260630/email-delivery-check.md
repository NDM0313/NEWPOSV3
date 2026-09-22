# Email delivery check

**Status:** SKIPPED  
**Reason:** SMTP infra fix not applied (`BLOCKED_MISSING_SMTP_CONFIG`)

## Result

No signup or resend test was run. Production still uses `supabase-mail` / `fake_sender` with `ENABLE_EMAIL_AUTOCONFIRM=true`.

## After unblock

1. Apply real SMTP + `ENABLE_EMAIL_AUTOCONFIRM=false`
2. Restart `supabase-auth`
3. Safe dry check: signup to disposable inbox only; stop before business creation; cleanup auth user if created
