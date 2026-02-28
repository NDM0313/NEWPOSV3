-- ============================================================================
-- BRANCH ASSIGNMENT VERIFICATION (run on VPS / self-hosted DB)
-- ============================================================================
-- Use this to verify why a salesman sees "No branch available".
--
-- IMPORTANT: Replace the UUID in the CTE below with the salesman's auth user id.
-- Get it from: browser console [SALE FORM BRANCH DEBUG] -> uid, or auth.users.id in DB.
-- Format: 8-4-4-4-12 hex, e.g. 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- ============================================================================

-- 1) Does the user exist in public.users and what is their branch assignment?
WITH vars AS (
  SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid AS salesman_auth_uid  -- <-- REPLACE with real auth UID
)
SELECT u.id, u.email, u.full_name, u.role, u.company_id, u.auth_user_id,
       (SELECT json_agg(json_build_object('branch_id', ub.branch_id, 'is_default', ub.is_default))
        FROM user_branches ub WHERE ub.user_id = u.id) AS assigned_branches
FROM public.users u
CROSS JOIN vars v
WHERE u.id = v.salesman_auth_uid OR u.auth_user_id = v.salesman_auth_uid;

-- 2) Direct user_branches rows for this user (use id from step 1 result as user_id):
-- SELECT * FROM user_branches WHERE user_id = 'paste-public-users-id-uuid-here'::uuid;

-- 3) get_user_branch_id() returns correct branch?
--    (Must run as the role/jwt of the salesman, e.g. via PostgREST with their token.)
SELECT get_user_branch_id();

-- 4) Branches the user should see (run with salesman JWT):
-- SELECT id, name, code FROM branches
-- WHERE company_id = get_user_company_id()
--   AND (get_user_role() = 'admin' OR has_branch_access(id));

-- 5) If user_branches is empty for this user, assign a branch (as admin). Use id from step 1 and a real branch id:
-- INSERT INTO user_branches (user_id, branch_id, is_default)
-- VALUES ('paste-public-users-id-here'::uuid, 'paste-branch-uuid-here'::uuid, true)
-- ON CONFLICT (user_id, branch_id) DO UPDATE SET is_default = EXCLUDED.is_default;
