-- ============================================================================
-- CONTACTS: worker type, contact_groups table, worker_role column
-- ============================================================================
-- Fixes: 404 on contact_groups, 400 when creating worker contacts
-- Run this in Supabase SQL Editor if contact creation fails or contact_groups 404.
-- ============================================================================

-- 1. Add 'worker' to contact_type enum if missing (avoids 400 on type=worker)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'contact_type' AND e.enumlabel = 'worker'
  ) THEN
    ALTER TYPE contact_type ADD VALUE 'worker';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- contact_type may not exist; app may use text type
  WHEN duplicate_object THEN
    NULL; -- already exists
  WHEN OTHERS THEN
    RAISE NOTICE 'contact_type worker: %', SQLERRM;
END $$;

-- 2. Create contact_groups table if not exists (fixes 404)
CREATE TABLE IF NOT EXISTS contact_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('customer', 'supplier', 'worker')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name, type)
);
CREATE INDEX IF NOT EXISTS idx_contact_groups_company_type ON contact_groups(company_id, type);
CREATE INDEX IF NOT EXISTS idx_contact_groups_active ON contact_groups(is_active) WHERE is_active = true;

-- 3. Add group_id to contacts if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN group_id UUID REFERENCES contact_groups(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_contacts_group_id ON contacts(group_id);
  END IF;
END $$;

-- 4. Add contact_person to contacts if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN contact_person VARCHAR(255);
  END IF;
END $$;

-- 5. Add worker_role to contacts if missing (for worker contacts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'worker_role'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN worker_role VARCHAR(100);
  END IF;
END $$;

-- 6. Add business_name if missing (supplier)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'business_name'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN business_name VARCHAR(255);
  END IF;
END $$;
