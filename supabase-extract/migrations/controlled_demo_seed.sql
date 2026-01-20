-- ============================================================================
-- CONTROLLED DEMO SEED
-- ============================================================================
-- This script creates demo data ONLY when explicitly called
-- Demo data is marked with is_demo = true
-- This does NOT run automatically on app start
-- ============================================================================

-- ============================================================================
-- 1. DEMO COMPANY
-- ============================================================================

INSERT INTO companies (
  id,
  name,
  email,
  phone,
  address,
  city,
  state,
  country,
  tax_number,
  is_active,
  is_demo,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Din Collection (Demo)',
  'demo@dincollection.com',
  '+92-300-1234567',
  '123 Main Street, Saddar',
  'Karachi',
  'Sindh',
  'Pakistan',
  'NTN-123456789',
  true,
  true, -- Mark as demo
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  is_demo = true,
  updated_at = NOW();

-- ============================================================================
-- 2. DEMO BRANCHES
-- ============================================================================

INSERT INTO branches (
  id,
  company_id,
  name,
  code,
  phone,
  address,
  city,
  is_active,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000011'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Main Branch (HQ) - Demo',
    'HQ',
    '+92-300-1234567',
    '123 Main Street, Saddar',
    'Karachi',
    true,
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000012'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'DHA Branch - Demo',
    'DHA',
    '+92-300-7654321',
    '456 DHA Phase 5',
    'Karachi',
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  updated_at = NOW();

-- ============================================================================
-- 3. DEMO USER (Optional - only if auth user exists)
-- ============================================================================
-- Note: This assumes an auth user with email 'demo@dincollection.com' exists
-- If not, this will fail silently (user must be created via Supabase Auth first)

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
  'Demo company created' as status,
  id,
  name,
  email,
  is_demo
FROM companies 
WHERE is_demo = true;

SELECT 
  'Demo branches created' as status,
  COUNT(*) as branch_count
FROM branches b
JOIN companies c ON b.company_id = c.id
WHERE c.is_demo = true;
