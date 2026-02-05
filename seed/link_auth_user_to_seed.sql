-- Link your Supabase Auth user to the seed company so the app finds company_id/branch.
-- Run this once after fresh seed. Replace YOUR_AUTH_USER_ID with your actual auth user id
-- (from browser console error or Supabase Dashboard → Authentication → Users).
--
-- Example: If your auth user id is 3c400f55-5f4a-44ae-bcaa-b63e4b593e38, run:
--   \set auth_uid '3c400f55-5f4a-44ae-bcaa-b63e4b593e38'
--   \i link_auth_user_to_seed.sql
-- Or in SQL Editor, replace :auth_uid below with your id and run.

DO $$
DECLARE
  auth_uid UUID := '3c400f55-5f4a-44ae-bcaa-b63e4b593e38';  -- replace with your auth user id
  cid UUID;
  bid UUID;
BEGIN
  SELECT id INTO cid FROM companies LIMIT 1;
  SELECT id INTO bid FROM branches WHERE company_id = cid LIMIT 1;
  IF cid IS NULL THEN
    RAISE EXCEPTION 'No company found. Run fresh_data_seed.sql first.';
  END IF;

  INSERT INTO public.users (id, company_id, email, full_name, role, is_active)
  VALUES (auth_uid, cid, 'admin@seed.com', 'Admin User', 'admin', true)
  ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

  IF bid IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_branches') THEN
    INSERT INTO public.user_branches (user_id, branch_id, is_default)
    VALUES (auth_uid, bid, true)
    ON CONFLICT (user_id, branch_id) DO UPDATE SET is_default = true;
  END IF;

  RAISE NOTICE 'Linked auth user % to company % and branch %', auth_uid, cid, bid;
END $$;
