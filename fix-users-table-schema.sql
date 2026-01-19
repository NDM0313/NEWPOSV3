-- ============================================================================
-- FIX: Add missing company_id column to users table
-- ============================================================================
-- Error: column users.company_id does not exist (code: 42703)
-- This script adds the missing column if it doesn't exist

-- Step 1: Check if column exists, if not add it
DO $$
BEGIN
  -- Check if company_id column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'company_id'
  ) THEN
    -- Add company_id column
    ALTER TABLE public.users 
    ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    
    RAISE NOTICE '✅ Added company_id column to users table';
  ELSE
    RAISE NOTICE '✅ company_id column already exists';
  END IF;
END $$;

-- Step 2: Set default company_id for existing users (if any)
UPDATE public.users
SET company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE company_id IS NULL;

-- Step 3: Make company_id NOT NULL (after setting defaults)
DO $$
BEGIN
  -- Check if column is nullable
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'company_id'
    AND is_nullable = 'YES'
  ) THEN
    -- Make it NOT NULL
    ALTER TABLE public.users 
    ALTER COLUMN company_id SET NOT NULL;
    
    RAISE NOTICE '✅ Set company_id as NOT NULL';
  ELSE
    RAISE NOTICE '✅ company_id is already NOT NULL';
  END IF;
END $$;

-- Step 4: Verify the fix
SELECT 
  'Verification' as step,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('id', 'company_id', 'email', 'role', 'is_active')
ORDER BY ordinal_position;
