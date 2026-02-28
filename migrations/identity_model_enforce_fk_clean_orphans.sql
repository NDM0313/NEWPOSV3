-- ============================================================================
-- IDENTITY MODEL: Enforce auth.users FK and remove orphan rows
-- Run after identity_model_auth_user_id / fix_user_account_access_fk_to_auth_users.
-- Safe to run multiple times (idempotent).
-- ============================================================================

-- 1) Remove orphan rows (user_id not in auth.users)
DELETE FROM public.user_account_access ua
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ua.user_id);

DELETE FROM public.user_branches ub
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ub.user_id);

-- 2) Ensure FK points to auth.users (in case old schema or partial run)
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
