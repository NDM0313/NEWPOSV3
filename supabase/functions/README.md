# Supabase Edge Functions

Deploy these functions for full user creation + auth flow.

## 1. Test connectivity (if deploy fails)

```bash
supabase login
supabase projects list
supabase functions deploy hello --project-ref YOUR_PROJECT_REF --debug
```

If `hello` deploys, the issue is with the larger functions. If it fails, paste the `--debug` output.

## 2. Deploy

```bash
# From project root
supabase functions deploy create-erp-user --project-ref YOUR_PROJECT_REF
supabase functions deploy user-admin-actions --project-ref YOUR_PROJECT_REF
```

Requires `SUPABASE_SERVICE_ROLE_KEY` (set automatically in Supabase Cloud).

## 3. Alternative: Deploy via Dashboard

If CLI fails with "API error":

1. Supabase Dashboard → Project → Edge Functions → New Function
2. Name: `create-erp-user` → paste code from `create-erp-user/index.ts`
3. Repeat for `user-admin-actions`

## 4. Optional: Admin secret (production)

Set secret in Dashboard → Project Settings → Edge Functions:

```
ADMIN_SECRET=your-random-secret
```

Then add to your frontend when invoking:

```ts
headers: { 'X-Admin-Secret': 'your-random-secret' }
```

Functions can check this header for extra security.

## Functions

- **hello**: Minimal test (1 line)
- **create-erp-user**: Admin creates user with Auth (temp password or invite)
- **user-admin-actions**: Send reset email, set new password

## Fallback

If Edge Functions are not deployed, Add User falls back to ERP profile only (no login until invited).
