-- ============================================
-- CREATE DEMO USER IN SUPABASE AUTH
-- ============================================
-- Run this in Supabase SQL Editor
-- Note: This requires admin access to auth schema

-- First, ensure the user exists in public.users
INSERT INTO public.users (
  id,
  company_id,
  email,
  full_name,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'admin@dincollection.com',
  'Admin User',
  'admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = true;

-- Note: To create auth user, use Supabase Dashboard:
-- Authentication → Users → Add user
-- Email: admin@dincollection.com
-- Password: admin123
-- Auto Confirm: Yes
