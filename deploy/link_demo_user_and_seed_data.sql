-- ============================================================================
-- Link demo user to company + ensure seed data so "no data" is fixed
--
-- On VPS (after copying this file and run_link_demo_and_seed.sh to /root/NEWPOSV3/deploy/):
--   cd /root/NEWPOSV3 && bash deploy/run_link_demo_and_seed.sh
-- From your PC (copy then run on VPS):
--   scp deploy/link_demo_user_and_seed_data.sql deploy/run_link_demo_and_seed.sh root@YOUR_VPS:/root/NEWPOSV3/deploy/
--   ssh root@YOUR_VPS "cd /root/NEWPOSV3 && bash deploy/run_link_demo_and_seed.sh"
-- ============================================================================

-- 1. Ensure demo company exists
INSERT INTO public.companies (id, name, email, phone, address, city, state, country, tax_number)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Din Collection',
  'info@dincollection.com',
  '+92-300-1234567',
  '123 Main Street, Saddar',
  'Karachi',
  'Sindh',
  'Pakistan',
  'NTN-123456789'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure main branch exists
INSERT INTO public.branches (id, company_id, name, code, phone, address, city, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000011'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Main Branch (HQ)',
  'HQ',
  '+92-300-1234567',
  '123 Main Street, Saddar',
  'Karachi',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 3. Link demo@dincollection.com (auth user) to demo company in public.users
INSERT INTO public.users (id, company_id, email, full_name, role, is_active)
SELECT
  au.id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Demo Admin'),
  'admin',
  true
FROM auth.users au
WHERE au.email = 'demo@dincollection.com'
ON CONFLICT (id) DO UPDATE SET
  company_id = EXCLUDED.company_id,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  is_active = EXCLUDED.is_active;

-- 4. Give demo user access to main branch (if user_branches table exists)
DO $$
BEGIN
  INSERT INTO public.user_branches (user_id, branch_id, is_default)
  SELECT au.id, '00000000-0000-0000-0000-000000000011'::uuid, true
  FROM auth.users au
  WHERE au.email = 'demo@dincollection.com'
  ON CONFLICT (user_id, branch_id) DO NOTHING;
EXCEPTION WHEN undefined_table THEN
  NULL; -- Schema has no user_branches (e.g. admin sees all branches)
END $$;

-- 5. If no contacts for demo company, insert sample contacts
DO $$
BEGIN
  IF (SELECT count(*) FROM public.contacts WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid) = 0 THEN
    INSERT INTO public.contacts (id, company_id, type, name, phone, email, address, city, opening_balance, current_balance, is_active)
    VALUES
      ('ct000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'customer', 'Ayesha Khan', '+92-300-1111111', 'ayesha@example.com', 'House 123, Block A, Gulshan-e-Iqbal', 'Karachi', 0, 0, true),
      ('ct000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'customer', 'Sara Ahmed', '+92-300-2222222', 'sara@example.com', 'Flat 456, DHA Phase 5', 'Karachi', 0, 0, true),
      ('ct000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'supplier', 'Fashion Fabrics Ltd', '+92-300-3333333', 'info@fashionfabrics.com', 'Shop 789, Cloth Market', 'Karachi', 0, 0, true),
      ('ct000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'supplier', 'Embroidery House', '+92-300-4444444', 'contact@embroideryhouse.com', 'Plaza ABC, Saddar', 'Karachi', 0, 0, true),
      ('ct000000-0000-0000-0000-000000000099'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'customer', 'Walk-in Customer', NULL, NULL, NULL, NULL, 0, 0, true);
  END IF;
END $$;
