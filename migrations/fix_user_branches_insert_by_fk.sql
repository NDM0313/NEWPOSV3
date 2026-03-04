-- ============================================================================
-- FIX: user_branches insert FK violation (user_id not present in table "users")
-- ============================================================================
-- If your FK is to auth.users(id): user_id in user_branches must be auth.users.id
-- (i.e. public.users.auth_user_id). If FK is to public.users(id): use public.users.id.
--
-- Quick fix for arslan@yahoo.com (public id 23805eee-..., auth_user_id 64394cdc-...):
--   INSERT INTO public.user_branches (user_id, branch_id, is_default)
--   VALUES ('64394cdc-7e7c-418f-a64a-70df8c9b1a1e', '697b7975-7c52-4366-9846-732e3b7dbdbd', true);
-- Then logout and login again in the app.
-- ============================================================================

-- 1) See which table user_branches.user_id references
SELECT
  c.conname AS constraint_name,
  c.confrelid::regclass AS references_table
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relname = 'user_branches' AND c.conname = 'user_branches_user_id_fkey';
-- references_table = 'users' -> public.users(id)
-- references_table = 'auth.users' -> auth.users(id)

-- 2) Find the correct user_id for the salesman (replace with your UUID / email)
-- If FK is to public.users(id): use public id
-- If FK is to auth.users(id): use auth id (auth_user_id from public.users)

-- Example: 23805eee-edc8-4c54-9e5d-9786a3b1f945 was the value that failed.
-- Try both interpretations:

-- A) Treat 23805eee-... as AUTH user id → get public.users.id for the INSERT (when FK = public.users)
SELECT id AS public_user_id, auth_user_id, email, full_name
FROM public.users
WHERE auth_user_id = '23805eee-edc8-4c54-9e5d-9786a3b1f945';

-- B) Treat 23805eee-... as PUBLIC user id → get auth_user_id for the INSERT (when FK = auth.users)
SELECT id AS public_user_id, auth_user_id, email, full_name
FROM public.users
WHERE id = '23805eee-edc8-4c54-9e5d-9786a3b1f945';

-- 3) INSERT using the correct id (choose one)
-- If your FK is to public.users(id): use the id from step 2A (public_user_id)
-- If your FK is to auth.users(id): use the auth_user_id from step 2B

-- Example when FK = public.users(id) (use the id from 2A):
-- INSERT INTO public.user_branches (user_id, branch_id, is_default)
-- VALUES ('<public_user_id from 2A>', '697b7975-7c52-4366-9846-732e3b7dbdbd', true);

-- Example when FK = auth.users(id) (use auth_user_id from 2B):
-- INSERT INTO public.user_branches (user_id, branch_id, is_default)
-- VALUES ('<auth_user_id from 2B>', '697b7975-7c52-4366-9846-732e3b7dbdbd', true);

-- ============================================================================
-- ONE-SHOT FIX: Assign default branch using EITHER public id OR auth id
-- Replace the UUID and branch_id with your values. Runs regardless of FK target.
-- ============================================================================
DO $$
DECLARE
  v_user_id_for_insert uuid;
  v_branch_id uuid := '697b7975-7c52-4366-9846-732e3b7dbdbd';  -- change to your branch
  v_lookup uuid := '23805eee-edc8-4c54-9e5d-9786a3b1f945';     -- id or auth_user_id of the user
BEGIN
  -- If user_branches.user_id -> public.users(id): use public id
  SELECT id INTO v_user_id_for_insert FROM public.users WHERE id = v_lookup LIMIT 1;
  IF v_user_id_for_insert IS NOT NULL THEN
    INSERT INTO public.user_branches (user_id, branch_id, is_default)
    SELECT v_user_id_for_insert, v_branch_id, true
    WHERE NOT EXISTS (SELECT 1 FROM public.user_branches WHERE user_id = v_user_id_for_insert AND branch_id = v_branch_id);
    RAISE NOTICE 'Inserted user_branches with public user id %', v_user_id_for_insert;
    RETURN;
  END IF;
  -- If v_lookup is auth_user_id: get public id (for FK -> public.users)
  SELECT id INTO v_user_id_for_insert FROM public.users WHERE auth_user_id = v_lookup LIMIT 1;
  IF v_user_id_for_insert IS NOT NULL THEN
    INSERT INTO public.user_branches (user_id, branch_id, is_default)
    SELECT v_user_id_for_insert, v_branch_id, true
    WHERE NOT EXISTS (SELECT 1 FROM public.user_branches WHERE user_id = v_user_id_for_insert AND branch_id = v_branch_id);
    RAISE NOTICE 'Inserted user_branches with public user id % (resolved from auth_user_id)', v_user_id_for_insert;
    RETURN;
  END IF;
  -- If user_branches.user_id -> auth.users(id): use v_lookup as auth id (must exist in auth.users)
  INSERT INTO public.user_branches (user_id, branch_id, is_default)
  SELECT v_lookup, v_branch_id, true
  WHERE NOT EXISTS (SELECT 1 FROM public.user_branches WHERE user_id = v_lookup AND branch_id = v_branch_id);
  RAISE NOTICE 'Inserted user_branches with user_id % (as auth id)', v_lookup;
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'FK violation. Your user_branches.user_id references %. Resolve: SELECT id, auth_user_id, email FROM public.users WHERE id = ''23805eee-'' OR auth_user_id = ''23805eee-''; then use the correct id as user_id.', (SELECT c.confrelid::regclass FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid WHERE t.relname = 'user_branches' AND c.conname = 'user_branches_user_id_fkey' LIMIT 1);
END $$;
