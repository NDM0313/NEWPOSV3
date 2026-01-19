-- ============================================================================
-- VERIFY AUTH USER EXISTS
-- ============================================================================
-- Run this in Supabase SQL Editor to check if user exists in auth.users

-- Check 1: Does user exist in auth.users?
SELECT 
  'auth.users check' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ USER EXISTS'
    ELSE '❌ USER MISSING'
  END as status,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as user_ids,
  STRING_AGG(email, ', ') as emails
FROM auth.users
WHERE email = 'admin@dincollection.com';

-- Check 2: Is email confirmed?
SELECT 
  'Email confirmation check' as check_type,
  id,
  email,
  email_confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ CONFIRMED'
    ELSE '❌ NOT CONFIRMED'
  END as status,
  created_at
FROM auth.users
WHERE email = 'admin@dincollection.com';

-- Check 3: Does user exist in public.users?
SELECT 
  'public.users check' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ USER EXISTS'
    ELSE '❌ USER MISSING'
  END as status,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as user_ids,
  STRING_AGG(email, ', ') as emails
FROM public.users
WHERE email = 'admin@dincollection.com';

-- Check 4: Are IDs linked correctly?
SELECT 
  'ID Link check' as check_type,
  au.id as auth_id,
  au.email as auth_email,
  au.email_confirmed_at,
  pu.id as public_id,
  pu.email as public_email,
  pu.role,
  CASE 
    WHEN au.id IS NULL THEN '❌ AUTH USER MISSING'
    WHEN pu.id IS NULL THEN '❌ PUBLIC USER MISSING'
    WHEN au.id = pu.id THEN '✅ CORRECTLY LINKED'
    ELSE '❌ ID MISMATCH'
  END as link_status
FROM auth.users au
FULL OUTER JOIN public.users pu ON au.id = pu.id
WHERE au.email = 'admin@dincollection.com' 
   OR pu.email = 'admin@dincollection.com';
