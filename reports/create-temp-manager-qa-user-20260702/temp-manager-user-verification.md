# Temp Manager QA user verification

**Status:** `SKIPPED` — no user created this run

Verification will run after successful apply in a follow-up run:

- auth user exists
- `public.users` row with `role=manager`, DIN BRIDAL company
- `user_branches` includes Main Branch (HQ)
- `is_active=true`
- no GL/business table changes
- no feature flag changes
