-- ============================================================================
-- User Access Settings — Verification script
-- Run in Supabase SQL Editor after applying migrations/rpc_assign_user_branches_fk_fix.sql
-- Replace placeholders with real UUIDs from your project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Confirm FK target (user_branches.user_id -> public.users.id)
-- ----------------------------------------------------------------------------
SELECT
  conname,
  conrelid::regclass AS table_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'user_branches_user_id_fkey';
-- Expected: REFERENCES public.users(id) or similar

-- ----------------------------------------------------------------------------
-- 2) RPC existence check (all three must exist)
-- ----------------------------------------------------------------------------
SELECT proname, oidvectortypes(proargtypes) AS args
FROM pg_proc
JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
WHERE n.nspname = 'public'
  AND proname IN ('get_public_user_id', 'set_user_branches', 'set_user_account_access');
-- Expected: 3 rows

-- ----------------------------------------------------------------------------
-- 3) Resolve user id (replace placeholders)
-- ----------------------------------------------------------------------------
-- SELECT get_public_user_id('<AUTH_UID_OR_PUBLIC_USER_ID>'::uuid, '<COMPANY_ID>'::uuid);
-- Example (use real UUIDs from your DB):
-- SELECT get_public_user_id('64394cdc-7e7c-410f-a64a-70df8c9b1a1e'::uuid, (SELECT company_id FROM public.users LIMIT 1));
-- Expected: single UUID (public.users.id)

-- ----------------------------------------------------------------------------
-- 4) Assign branches via RPC (replace placeholders; run as admin user/session)
-- ----------------------------------------------------------------------------
-- SELECT set_user_branches(
--   '<USER_ID_OR_AUTH_UID>'::uuid,
--   ARRAY['<BRANCH_ID>'::uuid],
--   '<BRANCH_ID>'::uuid,  -- default branch
--   '<COMPANY_ID>'::uuid
-- );
-- Example:
-- SELECT set_user_branches(
--   (SELECT id FROM public.users WHERE email = 'arslan@yahoo.com' LIMIT 1),
--   (SELECT ARRAY_AGG(id) FROM branches WHERE company_id = (SELECT company_id FROM public.users WHERE email = 'arslan@yahoo.com' LIMIT 1) LIMIT 1),
--   (SELECT id FROM branches WHERE company_id = (SELECT company_id FROM public.users WHERE email = 'arslan@yahoo.com' LIMIT 1) LIMIT 1),
--   (SELECT company_id FROM public.users WHERE email = 'arslan@yahoo.com' LIMIT 1)
-- );

-- ----------------------------------------------------------------------------
-- 5) Verify user_branches row exists and references public.users.id
-- ----------------------------------------------------------------------------
-- SELECT ub.*, u.id AS public_user_id, u.email
-- FROM user_branches ub
-- JOIN public.users u ON u.id = ub.user_id
-- WHERE u.email = 'arslan@yahoo.com';
-- Expected: rows with user_id = public.users.id (no auth.users.id)

-- ----------------------------------------------------------------------------
-- 6) set_user_account_access (replace placeholders)
-- ----------------------------------------------------------------------------
-- SELECT set_user_account_access(
--   '<USER_ID_OR_AUTH_UID>'::uuid,
--   ARRAY['<ACCOUNT_ID>'::uuid],
--   '<COMPANY_ID>'::uuid
-- );

-- ----------------------------------------------------------------------------
-- 7) Verify user_account_access
-- ----------------------------------------------------------------------------
-- SELECT uaa.*, u.id AS public_user_id, u.email
-- FROM user_account_access uaa
-- JOIN public.users u ON u.id = uaa.user_id
-- WHERE u.email = 'arslan@yahoo.com';
