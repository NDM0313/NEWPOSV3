-- MM User Branch Access Deep Fix (idempotent)
-- Scope: company 375fa03b-8e1e-46d3-9cfe-1cc20c02b473, email mm@yahoo.com
-- Goal:
-- 1) Ensure users.auth_user_id is linked correctly
-- 2) Migrate wrong user_branches rows keyed by public.users.id -> auth_user_id
-- 3) Guarantee at least one valid branch assignment in multi-branch mode
-- 4) Keep single-branch mode deterministic (UI can safely show Auto)

BEGIN;

WITH target_company AS (
  SELECT '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'::uuid AS company_id
),
target_user AS (
  SELECT u.*
  FROM public.users u
  JOIN target_company tc ON tc.company_id = u.company_id
  WHERE lower(u.email) = lower('mm@yahoo.com')
  ORDER BY u.created_at DESC NULLS LAST
  LIMIT 1
),
auth_match AS (
  SELECT au.id AS auth_user_id
  FROM auth.users au
  WHERE lower(au.email) = lower('mm@yahoo.com')
  ORDER BY au.created_at DESC
  LIMIT 1
)
UPDATE public.users u
SET auth_user_id = am.auth_user_id,
    updated_at = NOW()
FROM target_user tu
JOIN auth_match am ON TRUE
WHERE u.id = tu.id
  AND (u.auth_user_id IS NULL OR u.auth_user_id <> am.auth_user_id);

-- Migrate mistaken mappings where user_branches.user_id used public.users.id.
WITH target_company AS (
  SELECT '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'::uuid AS company_id
),
target_user AS (
  SELECT u.id AS public_user_id, u.auth_user_id
  FROM public.users u
  JOIN target_company tc ON tc.company_id = u.company_id
  WHERE lower(u.email) = lower('mm@yahoo.com')
  ORDER BY u.created_at DESC NULLS LAST
  LIMIT 1
),
migrate_rows AS (
  SELECT ub.branch_id, tu.auth_user_id
  FROM public.user_branches ub
  JOIN target_user tu ON ub.user_id = tu.public_user_id
  WHERE tu.auth_user_id IS NOT NULL
)
INSERT INTO public.user_branches (user_id, branch_id)
SELECT mr.auth_user_id, mr.branch_id
FROM migrate_rows mr
ON CONFLICT DO NOTHING;

WITH target_company AS (
  SELECT '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'::uuid AS company_id
),
target_user AS (
  SELECT u.id AS public_user_id, u.auth_user_id
  FROM public.users u
  JOIN target_company tc ON tc.company_id = u.company_id
  WHERE lower(u.email) = lower('mm@yahoo.com')
  ORDER BY u.created_at DESC NULLS LAST
  LIMIT 1
)
DELETE FROM public.user_branches ub
USING target_user tu
WHERE ub.user_id = tu.public_user_id
  AND tu.auth_user_id IS NOT NULL;

-- Remove invalid branch links for this user (branches from other companies / inactive).
WITH target_company AS (
  SELECT '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'::uuid AS company_id
),
target_user AS (
  SELECT u.auth_user_id
  FROM public.users u
  JOIN target_company tc ON tc.company_id = u.company_id
  WHERE lower(u.email) = lower('mm@yahoo.com')
  ORDER BY u.created_at DESC NULLS LAST
  LIMIT 1
)
DELETE FROM public.user_branches ub
USING target_user tu
WHERE ub.user_id = tu.auth_user_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.branches b
    JOIN target_company tc ON tc.company_id = b.company_id
    WHERE b.id = ub.branch_id
      AND COALESCE(b.is_active, TRUE) = TRUE
  );

-- Multi-branch safety: if no assignment remains, assign first active company branch.
WITH target_company AS (
  SELECT '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'::uuid AS company_id
),
target_user AS (
  SELECT u.auth_user_id
  FROM public.users u
  JOIN target_company tc ON tc.company_id = u.company_id
  WHERE lower(u.email) = lower('mm@yahoo.com')
  ORDER BY u.created_at DESC NULLS LAST
  LIMIT 1
),
company_branches AS (
  SELECT b.id
  FROM public.branches b
  JOIN target_company tc ON tc.company_id = b.company_id
  WHERE COALESCE(b.is_active, TRUE) = TRUE
  ORDER BY b.created_at NULLS LAST, b.name
),
branch_stats AS (
  SELECT COUNT(*)::int AS branch_count FROM company_branches
),
first_branch AS (
  SELECT id AS branch_id FROM company_branches LIMIT 1
),
has_assignment AS (
  SELECT COUNT(*)::int AS assigned_count
  FROM public.user_branches ub
  JOIN target_user tu ON tu.auth_user_id = ub.user_id
)
INSERT INTO public.user_branches (user_id, branch_id)
SELECT tu.auth_user_id, fb.branch_id
FROM target_user tu
JOIN first_branch fb ON TRUE
JOIN branch_stats bs ON TRUE
JOIN has_assignment ha ON TRUE
WHERE tu.auth_user_id IS NOT NULL
  AND bs.branch_count > 1
  AND ha.assigned_count = 0
ON CONFLICT DO NOTHING;

COMMIT;

-- Post-check (safe to run anytime)
WITH target_company AS (
  SELECT '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'::uuid AS company_id
),
target_user AS (
  SELECT u.id AS public_user_id, u.auth_user_id, u.role, u.is_active, u.email
  FROM public.users u
  JOIN target_company tc ON tc.company_id = u.company_id
  WHERE lower(u.email) = lower('mm@yahoo.com')
  ORDER BY u.created_at DESC NULLS LAST
  LIMIT 1
)
SELECT
  tu.email,
  tu.role,
  tu.is_active,
  tu.public_user_id,
  tu.auth_user_id,
  (
    SELECT COUNT(*)
    FROM public.branches b
    JOIN target_company tc ON tc.company_id = b.company_id
    WHERE COALESCE(b.is_active, TRUE) = TRUE
  ) AS active_company_branches,
  (
    SELECT COUNT(*)
    FROM public.user_branches ub
    WHERE ub.user_id = tu.auth_user_id
  ) AS assigned_user_branches;
