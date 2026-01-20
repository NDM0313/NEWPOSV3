-- ============================================================================
-- CLEANUP DEMO DATA
-- ============================================================================
-- This script deletes all demo data (companies with is_demo = true)
-- and all related data (branches, users, etc.)
-- ============================================================================

-- Delete in reverse order of dependencies

-- 1. Delete user_branches for demo companies
DELETE FROM user_branches ub
WHERE EXISTS (
  SELECT 1 FROM branches b
  JOIN companies c ON b.company_id = c.id
  WHERE b.id = ub.branch_id AND c.is_demo = true
);

-- 2. Delete users for demo companies
DELETE FROM users u
WHERE EXISTS (
  SELECT 1 FROM companies c
  WHERE c.id = u.company_id AND c.is_demo = true
);

-- 3. Delete branches for demo companies
DELETE FROM branches b
WHERE EXISTS (
  SELECT 1 FROM companies c
  WHERE c.id = b.company_id AND c.is_demo = true
);

-- 4. Delete demo companies (this will cascade delete related data via foreign keys)
DELETE FROM companies
WHERE is_demo = true;

-- Verification
SELECT 
  'Demo companies deleted' as status,
  COUNT(*) as remaining_demo_companies
FROM companies 
WHERE is_demo = true;
