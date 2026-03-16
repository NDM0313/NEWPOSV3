# Create Business → Login "Create your business" Fix

## Problem

After creating a new business (with one branch) via **Create New Business**, login shows "Create your business" and console:  
`[FETCH USER DATA] User not found in public.users. User must create a business first.`

The app looks up `public.users` by `id = auth.uid()` OR `auth_user_id = auth.uid()`. The `create_business_transaction` RPC was only setting `users.id = p_user_id` and not setting `auth_user_id`, so on DBs that use `auth_user_id` for the link, the new user was not found after login.

## Quick fix (one-time SQL + app button)

1. **Run migration 61** in Supabase Dashboard → SQL Editor (project: dincouture / supabase.dincouture.pk):
   - Open `supabase-extract/migrations/61_rpc_link_auth_user_to_business.sql`
   - Copy the full contents and paste in SQL Editor → Run.

2. **In the app:** When you see "Create your business", click the green button **"I already created a business – fix my account"**. The page will reload and your business should load.

If the button says "function does not exist", run step 1 first.

**If you see "No business found for this email (Logged in as: your@email.com)"**  
→ No company exists in the DB for that email. Run the **one-time script** below (it creates the company + branch + user link so you can log in).

### One-time script when no company exists for your email

1. Open **Supabase → SQL Editor**.
2. Open the file **`docs/auth/one_time_create_user_and_business.sql`** in your project.
3. Set `v_email := 'your@email.com';` (e.g. `ndm313@live.com`) on line 21.
4. Copy the whole script and run it in SQL Editor.
5. Sign out in the app and sign in again — your business should load.

## Fixes (details)

### 1. For future signups (recommended)

Apply migration **60** so new businesses get `auth_user_id` set when the user row is created:

- **Path:** `supabase-extract/migrations/60_create_business_set_auth_user_id.sql`
- Run this migration on your Supabase project (SQL Editor or `supabase db push` / your deploy process).

### 2. For your current account (one-time)

If you already created a business with email `ndm313@live.com` (or your email) but still see "Create your business" after login, the `public.users` row is missing or not linked to your auth user. Use the one-time script below **once** on your Supabase DB (e.g. SQL Editor, as a role that can insert into `public.users` and read `auth.users`).

Replace `'ndm313@live.com'` with your actual sign-up email.

```sql
-- One-time: link auth user to existing business by email
-- Run in Supabase SQL Editor (service role or postgres).
DO $$
DECLARE
  v_auth_id UUID;
  v_email TEXT := 'ndm313@live.com';
  v_company_id UUID;
  v_branch_id UUID;
  v_name TEXT;
BEGIN
  SELECT id, COALESCE(raw_user_meta_data->>'full_name', email) INTO v_auth_id, v_name
  FROM auth.users WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email)) LIMIT 1;
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for email: %', v_email;
  END IF;

  -- Company created by create_business_transaction has email = sign-up email
  SELECT id INTO v_company_id FROM public.companies WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email)) LIMIT 1;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found for email: %. Create business first.', v_email;
  END IF;

  SELECT id INTO v_branch_id FROM public.branches WHERE company_id = v_company_id AND is_active = true LIMIT 1;

  INSERT INTO public.users (id, company_id, email, full_name, role, is_active, auth_user_id)
  VALUES (v_auth_id, v_company_id, v_email, v_name, 'admin', true, v_auth_id)
  ON CONFLICT (id) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    company_id = EXCLUDED.company_id,
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

  IF v_branch_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_branches') THEN
    INSERT INTO public.user_branches (user_id, branch_id, is_default)
    VALUES (v_auth_id, v_branch_id, true)
    ON CONFLICT (user_id, branch_id) DO UPDATE SET is_default = true;
  END IF;

  RAISE NOTICE 'Linked auth user % to company %', v_auth_id, v_company_id;
END $$;
```

After running it, sign out and sign in again; the app should load your business.

## Summary

| Fix | Purpose |
|-----|--------|
| **Migration 60** | New signups get `auth_user_id` set so login finds them in `public.users`. |
| **One-time SQL script** | Links your current auth user to the company that was created with your email so you can log in. |
