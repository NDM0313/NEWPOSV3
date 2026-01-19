-- ============================================================================
-- FIX: Link Auth User to Database User
-- ============================================================================
-- This script links an existing auth.users entry to public.users table
-- Run this AFTER creating user in Supabase Dashboard → Authentication → Users

-- Step 1: Verify auth user exists
DO $$
DECLARE
  auth_user_id UUID;
  auth_user_email TEXT;
  auth_user_confirmed BOOLEAN;
BEGIN
  -- Check if user exists in auth.users
  SELECT 
    id,
    email,
    (email_confirmed_at IS NOT NULL) as confirmed
  INTO 
    auth_user_id,
    auth_user_email,
    auth_user_confirmed
  FROM auth.users
  WHERE email = 'admin@dincollection.com'
  LIMIT 1;
  
  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION '❌ ERROR: User not found in auth.users table. Please create user in Supabase Dashboard → Authentication → Users first.';
  END IF;
  
  IF NOT auth_user_confirmed THEN
    RAISE WARNING '⚠️ WARNING: User email is not confirmed. Login may fail.';
  END IF;
  
  RAISE NOTICE '✅ Auth user found: ID=%, Email=%, Confirmed=%', auth_user_id, auth_user_email, auth_user_confirmed;
  
  -- Step 2: Update or insert in public.users
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
    auth_user_id,
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
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
  
  RAISE NOTICE '✅ Linked auth user to public.users table';
  
END $$;

-- Step 3: Verify the link
SELECT 
  'Verification' as step,
  au.id as auth_id,
  au.email as auth_email,
  au.email_confirmed_at,
  pu.id as public_id,
  pu.email as public_email,
  pu.role,
  pu.is_active,
  CASE 
    WHEN au.id = pu.id THEN '✅ LINKED CORRECTLY'
    ELSE '❌ ID MISMATCH'
  END as status
FROM auth.users au
INNER JOIN public.users pu ON au.id = pu.id
WHERE au.email = 'admin@dincollection.com';
