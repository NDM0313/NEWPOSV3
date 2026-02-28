-- ============================================================================
-- IDENTITY MODEL: STEP-BY-STEP VERIFICATION AND FIX
-- Run in Supabase SQL Editor. Execute section by section; read results before next.
-- ============================================================================

-- ----------------------------------------
-- STEP 1 — DATABASE STRUCTURE VERIFICATION
-- ----------------------------------------
SELECT tc.constraint_name, ccu.table_schema, ccu.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('user_account_access','user_branches')
  AND tc.constraint_type = 'FOREIGN KEY';

-- If any row shows table_schema = 'public' AND table_name = 'users' → run fix below.

-- STEP 1 FIX: Drop FKs to public.users and add FKs to auth.users
ALTER TABLE public.user_account_access
  DROP CONSTRAINT IF EXISTS user_account_access_user_id_fkey;
ALTER TABLE public.user_account_access
  ADD CONSTRAINT user_account_access_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_branches
  DROP CONSTRAINT IF EXISTS user_branches_user_id_fkey;
ALTER TABLE public.user_branches
  ADD CONSTRAINT user_branches_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Re-run STEP 1 query; ccu.table_schema should be 'auth', table_name 'users'.

-- ----------------------------------------
-- STEP 2 — ORPHAN DATA CHECK
-- ----------------------------------------
-- Orphans in user_account_access (user_id not in auth.users)
SELECT ua.id, ua.user_id, ua.account_id
FROM public.user_account_access ua
LEFT JOIN auth.users au ON ua.user_id = au.id
WHERE au.id IS NULL;

-- Orphans in user_branches
SELECT ub.id, ub.user_id, ub.branch_id
FROM public.user_branches ub
LEFT JOIN auth.users au ON ub.user_id = au.id
WHERE au.id IS NULL;

-- STEP 2 FIX: Delete orphans (run only after reviewing above)
DELETE FROM public.user_account_access ua
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ua.user_id);

DELETE FROM public.user_branches ub
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ub.user_id);

-- ----------------------------------------
-- STEP 3 — AUTH VS PUBLIC USER MISMATCH
-- ----------------------------------------
-- public.users with NULL auth_user_id or auth_user_id not in auth.users
SELECT pu.id, pu.email, pu.full_name, pu.auth_user_id
FROM public.users pu
LEFT JOIN auth.users au ON pu.auth_user_id = au.id
WHERE pu.auth_user_id IS NULL OR au.id IS NULL;

-- Do NOT auto-create auth users. Report only; link users manually or via invite.

-- ----------------------------------------
-- STEP 6 — MANUAL INSERT TEST (optional)
-- ----------------------------------------
-- Replace <VALID_AUTH_USER_ID> with a real auth.users.id; <ACCOUNT_ID> with real account id.
-- INSERT INTO public.user_account_access (user_id, account_id)
-- VALUES ('<VALID_AUTH_USER_ID>', '<ACCOUNT_ID>');
-- If this succeeds, DB is correct and issue is frontend only.
