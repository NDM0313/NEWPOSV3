# User Creation Flow — Verification

## Architecture (Self-Hosted)

```
Admin (logged in) → Frontend AddUserModal
  → userService.createUserWithAuth()
  → supabase.functions.invoke('create-erp-user', { headers: { Authorization: Bearer <session.access_token> } })
  → Kong (supabase.dincouture.pk) → Edge Function
  → Edge function: validates JWT, checks admin role, uses SERVICE_ROLE_KEY
  → Creates auth user + ERP profile with auth_user_id
```

## Fixes Applied

1. **Frontend** (`userService.ts`): Explicitly passes `Authorization: Bearer ${session.access_token}` to all Edge Function calls. Throws if no session.
2. **Edge function** (`create-erp-user`): Debug log for Authorization header. Uses client JWT for `getUser()`, SERVICE_ROLE_KEY for `auth.admin.createUser()` and DB insert.
3. **Deploy**: Edge functions deployed to `/root/supabase/docker/volumes/functions/` on every deploy.

## How to Test

1. Log in as admin at https://erp.dincouture.pk
2. Go to Settings → Users → Add User
3. Fill form, choose "Set temporary password" and enter a password (min 6 chars)
4. Click Save

If it fails with "Missing authorization" → session is not available. Check browser console for errors.

## Verify Edge Function Logs

```bash
ssh dincouture-vps "docker logs supabase-edge-functions --tail 50 2>&1"
```

Look for `[create-erp-user] Authorization: Bearer eyJ...` or `MISSING`.

## Test with curl (Admin Token)

1. Get access token from browser: DevTools → Application → Local Storage → `sb-<project>-auth-token` → copy `access_token`
2. Run:

```bash
curl -X POST https://supabase.dincouture.pk/functions/v1/create-erp-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"email":"test@example.com","full_name":"Test User","role":"staff","company_id":"YOUR_COMPANY_ID","temporary_password":"test123"}' 
```

Replace `YOUR_ACCESS_TOKEN`, `YOUR_ANON_KEY`, `YOUR_COMPANY_ID`.
