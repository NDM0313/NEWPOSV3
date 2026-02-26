# Localhost Login Debug Guide

**Issue:** Auth login succeeds, but ERP profile lookup fails with "User profile not found" / "Create a business" on localhost. Production (https://erp.dincouture.pk) works.

---

## STEP 1 — Confirm Environment

### 1.1 Check local `.env` file

Create `.env` in project root (copy from `.env.example`):

```
VITE_SUPABASE_URL=https://supabase.dincouture.pk
VITE_SUPABASE_ANON_KEY=<same-as-production>
```

**Important:** Localhost must point to `https://supabase.dincouture.pk` (not erp.dincouture.pk). The anon key must match the one used by Kong on the VPS.

### 1.2 Runtime log

On localhost dev, open browser console. You should see:

```
[SUPABASE] VITE_SUPABASE_URL at runtime: https://supabase.dincouture.pk
[SUPABASE] Resolved supabaseUrl: https://supabase.dincouture.pk
```

If you see a different URL or `undefined`, fix `.env` and restart `npm run dev`.

---

## STEP 2 — Verify Auth User

After login, check console for:

```
[AUTH] AUTH USER (after getSession): { user_id: "...", email: "...", has_session: true, auth_uid: "..." }
```

**Confirm:**
- `user_id` exists (UUID format)
- `user_id` matches `auth.users.id` in the database

---

## STEP 3 — ERP Profile Lookup

The query fetches from `public.users` (not `erp_users`):

```ts
supabase.from('users')
  .select('id, company_id, role, is_active')
  .or(`id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
  .limit(1)
  .maybeSingle()
```

**Debug logs (localhost):**
```
[FETCH USER DATA] Looking for ERP profile with auth_user_id or id: <AUTH_USER_UUID>
[FETCH USER DATA] Query: users WHERE id.eq.<UUID> OR auth_user_id.eq.<UUID>
[FETCH USER DATA] Result: { data: {...} | null, error: {...} | null }
```

**Check:**
- `data` is null → no matching row (see STEP 4)
- `error` present → RLS or permission issue (see STEP 5)
- `auth_user_id` column is used in the `.or()` clause

---

## STEP 4 — Database Verification

On VPS, run:

```bash
ssh dincouture-vps
```

Then connect to DB and run (replace `AUTH_USER_UUID` with the `user_id` from console):

```sql
-- Replace AUTH_USER_UUID with the auth user id from console log
SELECT id, auth_user_id, email, company_id, role, is_active
FROM public.users
WHERE auth_user_id = 'AUTH_USER_UUID'
   OR id = 'AUTH_USER_UUID';

-- Also verify auth.users has this user
SELECT id, email FROM auth.users WHERE id = 'AUTH_USER_UUID';
```

**Confirm:**
- Row exists in `public.users`
- `auth_user_id` matches `auth.users.id` (or `users.id` for legacy users)
- `company_id` is not null

---

## STEP 5 — RLS Check

Temporarily disable RLS to isolate policy issues:

```sql
-- On VPS: docker exec -i supabase-db psql -U postgres -d postgres
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
```

Test localhost login again. If it works → RLS policy issue.

**Re-enable after test:**
```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
```

**RLS policies (from migration):**
- `users_read_own_row`: `id = auth.uid() OR auth_user_id = auth.uid()`
- `users_update_own_profile`: same

For localhost, `auth.uid()` must return the logged-in user's UUID. If the JWT is invalid or from a different project, `auth.uid()` may be null.

---

## STEP 6 — Migration Consistency

Verify on production DB:

```sql
-- 1. auth_user_id column exists
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id';

-- 2. get_user_role supports auth_user_id
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_user_role';

-- 3. get_user_company_id supports auth_user_id
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_user_company_id';
```

---

## Common Causes (Localhost vs Production)

| Cause | Production | Localhost |
|-------|------------|-----------|
| Different anon key | Same (baked in build) | Wrong `.env` → different project/JWT |
| CORS / redirect | Same origin or configured | localhost → supabase.dincouture.pk may have CORS |
| auth.uid() in RLS | Valid JWT from Kong | JWT from wrong anon key → auth.uid() null |
| users.auth_user_id | Backfilled | Same DB, but RLS blocks if JWT wrong |

**Most likely:** Localhost `.env` has wrong or missing `VITE_SUPABASE_ANON_KEY`. Get the correct key from VPS:

```bash
ssh dincouture-vps "grep ANON_KEY /root/supabase/docker/.env | head -1"
# or from Kong
ssh dincouture-vps "docker exec supabase-kong printenv SUPABASE_ANON_KEY"
```

Copy that value to `.env` as `VITE_SUPABASE_ANON_KEY=...`.
