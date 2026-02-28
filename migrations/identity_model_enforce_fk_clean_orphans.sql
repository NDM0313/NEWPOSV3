-- ============================================================================
-- IDENTITY MODEL: Clean orphans + enforce auth.users FK (single transaction)
-- Fixes: user_branches_user_id_fkey / user_account_access_user_id_fkey violations.
-- Safe to run multiple times (idempotent).
-- ============================================================================

BEGIN;

-- 4A) Delete orphan rows (user_id not in auth.users)
DELETE FROM public.user_branches ub
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ub.user_id);

DELETE FROM public.user_account_access ua
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ua.user_id);

-- 4B) Drop old FKs (whatever they reference)
ALTER TABLE public.user_branches
  DROP CONSTRAINT IF EXISTS user_branches_user_id_fkey;

ALTER TABLE public.user_account_access
  DROP CONSTRAINT IF EXISTS user_account_access_user_id_fkey;

-- 4C) Recreate FKs to auth.users(id) ONLY
ALTER TABLE public.user_branches
  ADD CONSTRAINT user_branches_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_account_access
  ADD CONSTRAINT user_account_access_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;
