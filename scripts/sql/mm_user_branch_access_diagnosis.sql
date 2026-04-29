WITH company_row AS (
  SELECT id, name, email
  FROM public.companies
  WHERE id = '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'::uuid
),
company_branches AS (
  SELECT id, name, code, is_active, created_at
  FROM public.branches
  WHERE company_id = '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'::uuid
    AND COALESCE(is_active, TRUE) = TRUE
),
user_row AS (
  SELECT id, auth_user_id, email, role, is_active, created_at
  FROM public.users
  WHERE company_id = '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'::uuid
    AND lower(email) = lower('mm@yahoo.com')
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1
),
auth_row AS (
  SELECT id, email, created_at
  FROM auth.users
  WHERE lower(email) = lower('mm@yahoo.com')
  ORDER BY created_at DESC
  LIMIT 1
),
branch_rows AS (
  SELECT ub.user_id, ub.branch_id, b.name AS branch_name
  FROM public.user_branches ub
  LEFT JOIN public.branches b ON b.id = ub.branch_id
  WHERE ub.user_id IN (
    SELECT id FROM user_row
    UNION
    SELECT auth_user_id FROM user_row WHERE auth_user_id IS NOT NULL
  )
),
effective AS (
  SELECT
    ur.auth_user_id,
    CASE
      WHEN ur.auth_user_id IS NULL THEN NULL
      ELSE public.get_effective_user_branch(ur.auth_user_id)
    END AS effective_payload
  FROM user_row ur
)
SELECT jsonb_build_object(
  'company', (SELECT to_jsonb(c) FROM company_row c),
  'activeBranches', (SELECT COALESCE(jsonb_agg(to_jsonb(cb) ORDER BY cb.created_at), '[]'::jsonb) FROM company_branches cb),
  'user', (SELECT to_jsonb(u) FROM user_row u),
  'authUserByEmail', (SELECT to_jsonb(a) FROM auth_row a),
  'userBranchesRaw', (SELECT COALESCE(jsonb_agg(to_jsonb(br)), '[]'::jsonb) FROM branch_rows br),
  'effectiveBranchRpc', (SELECT effective_payload FROM effective)
) AS diagnosis;
