# 401 Unauthorized on Sign-In (Login)

When the login form shows **"Unauthorized"** and the console shows `[AUTH ERROR] Sign in failed: status: 401`, the failure is at **Supabase Auth (GoTrue)** — the email/password pair is rejected.

## Common causes

1. **Wrong password** – most common.
2. User not in `auth.users` (e.g. only in `public.users`).
3. Account not confirmed (`email_confirmed_at` null) if your project requires confirmation.
4. **GoTrue vs DB hash:** On VPS, if resetting the password in `auth.users` (e.g. with `crypt('123456', gen_salt('bf', 10))`) still gives 401, GoTrue may be using a different DB connection or bcrypt behaviour. Check GoTrue env (e.g. `GOTRUE_DB_*`) and that it points to the same Postgres as where you ran the UPDATE.

## Fix: reset password on VPS

Your app uses **https://supabase.dincouture.pk** (self-hosted). Reset the password directly in the database.

**Windows (PowerShell)** – from project root:

```powershell
.\scripts\vps-reset-user-password.ps1 -Email "ndm313@live.com" -Password "YourNewPassword"
```

**Linux/macOS (bash):**

```bash
bash scripts/vps-reset-user-password.sh ndm313@live.com 'YourNewPassword'
```

Then sign in at **localhost:5173** (or https://erp.dincouture.pk) with that email and the new password.

## Verify auth user exists

To check that the email exists in `auth.users`:

```bash
# Run check on VPS
Get-Content scripts/check-auth-user.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -t"
```

If no row is returned, the user exists only in `public.users` and needs to be created in `auth.users` (e.g. via sign-up flow or an admin script).
