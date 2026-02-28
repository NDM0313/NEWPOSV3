-- ============================================================================
-- IDENTITY / FK ORPHAN FIX RUNNER
-- Run in Supabase SQL Editor. Execute section by section; read results.
-- Goal: user_branches.user_id and user_account_access.user_id → auth.users(id) only.
-- ============================================================================

-- ----------------------------------------
-- STEP 0 — FREEZE + COLLECT "BAD UUID"
-- ----------------------------------------
-- Reproduce error from UI (branch or account save).
-- Copy the UUID from toast/log: Key (user_id)=(<BAD_UUID>) is not present...
-- Note: was it user_branches or user_account_access?
-- Use <BAD_UUID> in STEP 2.

-- ----------------------------------------
-- STEP 1 — PROVE WHAT EACH FK CURRENTLY REFERENCES (RUN FIRST)
-- ----------------------------------------
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname IN ('user_branches_user_id_fkey', 'user_account_access_user_id_fkey');

-- Expected (final state): both must show REFERENCES auth.users(id) ON DELETE CASCADE.
-- If any shows REFERENCES public.users(id) => mismatch confirmed.

-- ----------------------------------------
-- STEP 2 — CHECK BAD_UUID EXISTS WHERE?
-- ----------------------------------------
-- Replace <BAD_UUID> with the UUID from the error and run:

-- Does it exist in auth?
-- SELECT id, email FROM auth.users WHERE id = '<BAD_UUID>'::uuid;

-- Does it exist in public profile (as id)?
-- SELECT id, email, auth_user_id FROM public.users WHERE id = '<BAD_UUID>'::uuid;

-- Is it an auth_user_id stored in public.users?
-- SELECT id, email, auth_user_id FROM public.users WHERE auth_user_id = '<BAD_UUID>'::uuid;

-- Interpretation:
-- If found in public.users.id but NOT in auth.users => profile-only / or old id stored.
-- If found in auth.users.id but FK points to public.users => constraint mismatch.
-- If public.users.auth_user_id is NULL for that user => unlinked (cannot assign access yet).

-- ----------------------------------------
-- STEP 3 — ORPHAN AUDIT (this is what blocks FK add)
-- ----------------------------------------
-- Orphans in user_branches: user_id not in auth.users
SELECT COUNT(*) AS orphans_user_branches
FROM public.user_branches ub
LEFT JOIN auth.users au ON au.id = ub.user_id
WHERE au.id IS NULL;

-- Orphans in user_account_access: user_id not in auth.users
SELECT COUNT(*) AS orphans_user_account_access
FROM public.user_account_access ua
LEFT JOIN auth.users au ON au.id = ua.user_id
WHERE au.id IS NULL;

-- If counts > 0, FK add to auth.users will fail until these are cleaned (STEP 4).

-- Optional: see the actual orphan rows
-- SELECT ub.id, ub.user_id, ub.branch_id FROM public.user_branches ub
-- LEFT JOIN auth.users au ON au.id = ub.user_id WHERE au.id IS NULL;
-- SELECT ua.id, ua.user_id, ua.account_id FROM public.user_account_access ua
-- LEFT JOIN auth.users au ON au.id = ua.user_id WHERE au.id IS NULL;

-- ----------------------------------------
-- STEP 4 — ONE-SHOT FIX (transaction): delete orphans → drop FKs → recreate to auth.users
-- ----------------------------------------
-- Run as postgres (or role with ALTER on these tables). Run entire block.

BEGIN;

-- 1) Delete orphans FIRST (otherwise FK add fails)
DELETE FROM public.user_branches ub
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ub.user_id);

DELETE FROM public.user_account_access ua
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ua.user_id);

-- 2) Drop old constraints
ALTER TABLE public.user_branches
  DROP CONSTRAINT IF EXISTS user_branches_user_id_fkey;

ALTER TABLE public.user_account_access
  DROP CONSTRAINT IF EXISTS user_account_access_user_id_fkey;

-- 3) Add correct constraints (auth.users)
ALTER TABLE public.user_branches
  ADD CONSTRAINT user_branches_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_account_access
  ADD CONSTRAINT user_account_access_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;

-- If this succeeds, re-run STEP 1 to confirm.

-- ----------------------------------------
-- STEP 5 — RE-VERIFY
-- ----------------------------------------
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname IN ('user_branches_user_id_fkey', 'user_account_access_user_id_fkey');

-- Must show REFERENCES auth.users(id) for both.

-- ----------------------------------------
-- STEP 6 — FIX REAL USER LINKAGE ("usman@yahoo.com" type cases)
-- ----------------------------------------
-- If public.users row exists but auth_user_id IS NULL:
--   - That user has no row in auth.users (no login identity).
--   - You cannot assign branch/account access until they exist in auth.
-- Action: Create/invite that email in Supabase Auth (Dashboard → Authentication → Users → Add user / Invite).
-- Then link profile to auth user (match by email):

UPDATE public.users p
SET auth_user_id = a.id
FROM auth.users a
WHERE p.email = a.email
  AND p.auth_user_id IS NULL;

-- After this, assign access in UI using auth uid (Settings → User → Branch/Account access).

-- ----------------------------------------
-- STEP 7 — FRONTEND HARD RULE (no SQL; see code)
-- ----------------------------------------
-- In Settings → User Management UI:
-- - When saving branch/account access, only use editingUser.auth_user_id.
-- - If auth_user_id is NULL: block save + show toast:
--   "User is not linked to authentication. Cannot assign branch/account access."
-- - Log: identityId being sent; editingUser.id (must never be sent).

-- ----------------------------------------
-- STEP 8 — FINAL TEST (manual)
-- ----------------------------------------
-- Pick a user that definitely exists in auth.users.
-- In UI: assign Branch + Account access and save. No FK error.
-- Create a Sale with that user: branch should load (via user_branches) and save should work.

-- Optional: manual insert test with valid auth uid
-- SELECT id, email FROM auth.users LIMIT 1;
-- SELECT id FROM public.branches LIMIT 1;
-- INSERT INTO public.user_branches (user_id, branch_id) VALUES ('<VALID_AUTH_UID>'::uuid, '<BRANCH_ID>'::uuid);
-- INSERT INTO public.user_account_access (user_id, account_id) VALUES ('<VALID_AUTH_UID>'::uuid, '<ACCOUNT_ID>'::uuid);

-- ----------------------------------------
-- USERS WITHOUT AUTH LINKAGE (report only)
-- ----------------------------------------
SELECT pu.id, pu.email, pu.full_name, pu.auth_user_id
FROM public.users pu
LEFT JOIN auth.users au ON pu.auth_user_id = au.id
WHERE pu.auth_user_id IS NULL OR au.id IS NULL;
-- Do NOT auto-create auth users. Create/invite in Auth, then run STEP 6 to link.
