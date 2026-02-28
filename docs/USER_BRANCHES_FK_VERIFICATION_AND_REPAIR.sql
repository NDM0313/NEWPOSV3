-- ============================================================================
-- user_branches FK verification and data repair
-- Run on Supabase SQL Editor (or VPS DB) to verify schema and fix missing rows.
-- ============================================================================

-- ------------------------------
-- STEP 1 — Confirm FK target
-- ------------------------------
SELECT
  conname,
  conrelid::regclass AS table_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'user_branches_user_id_fkey';
-- Expected: user_branches.user_id REFERENCES public.users(id)

-- ------------------------------
-- STEP 2 — Counts (quick check)
-- ------------------------------
SELECT count(*) AS auth_users FROM auth.users;
SELECT count(*) AS public_users FROM public.users;

-- ------------------------------
-- STEP 3 — Auth users missing in public.users (root cause of FK)
-- ------------------------------
SELECT au.id AS auth_user_id, au.email, au.created_at
FROM auth.users au
LEFT JOIN public.users u ON u.auth_user_id = au.id
WHERE u.id IS NULL
ORDER BY au.email;

-- Example: check specific user
-- SELECT id, auth_user_id, email, full_name FROM public.users WHERE email = 'arslan@yahoo.com';

-- ------------------------------
-- STEP 4 — Repair: create missing public.users (run per company)
-- ------------------------------
-- Replace <COMPANY_ID> with the actual company UUID. Run once per company that has
-- auth users without a public.users row.
/*
INSERT INTO public.users (id, auth_user_id, company_id, email, full_name, role, is_active)
SELECT
  gen_random_uuid(),
  au.id,
  '<COMPANY_ID>'::uuid,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  'staff',
  true
FROM auth.users au
LEFT JOIN public.users u ON u.auth_user_id = au.id
WHERE u.id IS NULL
  AND au.email IS NOT NULL
  AND au.email != '';
*/

-- ------------------------------
-- STEP 5 — After repair: assign default branch (optional)
-- ------------------------------
-- After inserting missing users, assign them to a branch via Settings → Users → Edit → Branch Access,
-- or run (replace placeholders):
/*
INSERT INTO public.user_branches (user_id, branch_id, is_default)
SELECT u.id, '<BRANCH_ID>'::uuid, true
FROM public.users u
WHERE u.auth_user_id IN (SELECT id FROM auth.users)
  AND NOT EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = u.id)
LIMIT 1;
*/

-- ------------------------------
-- Acceptance: no FK on branch save
-- ------------------------------
-- 1) Admin opens Settings → Users → Edit user → assign branch → Save → no FK error.
-- 2) Salesman sees assigned branch and can save sales.
