-- ============================================================================
-- FIX: user_account_access (and user_branches) FK must reference auth.users(id)
-- Run this if you see: "Key (user_id)=(...) is not present in table \"users\""
-- (App sends auth_user_id; table was still FK to public.users.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_account_access: backfill user_id to auth_user_id, then FK → auth.users
-- ----------------------------------------------------------------------------
UPDATE public.user_account_access ua
SET user_id = u.auth_user_id
FROM public.users u
WHERE u.id = ua.user_id AND u.auth_user_id IS NOT NULL;

DELETE FROM public.user_account_access
WHERE user_id IN (SELECT id FROM public.users);

ALTER TABLE public.user_account_access
  DROP CONSTRAINT IF EXISTS user_account_access_user_id_fkey;

ALTER TABLE public.user_account_access
  ADD CONSTRAINT user_account_access_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- user_branches: same
-- ----------------------------------------------------------------------------
UPDATE public.user_branches ub
SET user_id = u.auth_user_id
FROM public.users u
WHERE u.id = ub.user_id AND u.auth_user_id IS NOT NULL;

DELETE FROM public.user_branches
WHERE user_id IN (SELECT id FROM public.users);

ALTER TABLE public.user_branches
  DROP CONSTRAINT IF EXISTS user_branches_user_id_fkey;

ALTER TABLE public.user_branches
  ADD CONSTRAINT user_branches_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
