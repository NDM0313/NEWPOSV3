-- ============================================================================
-- CONTACTS: Ensure worker type + contacts create/delete in role_permissions
-- ============================================================================
-- PART 1: contact_type enum — add 'worker' if missing
-- PART 2: role_permissions — contacts.view, create, edit, delete (no separate contacts.worker)
-- ============================================================================

-- 1. Add 'worker' to contact_type enum if it exists and does not have worker
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_type') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'contact_type' AND e.enumlabel = 'worker'
    ) THEN
      ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'worker';
      RAISE NOTICE 'contact_type: added worker';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'contact_type worker: %', SQLERRM;
END $$;

-- 2. Ensure contacts has create and delete in role_permissions (view, edit already in seed)
INSERT INTO public.role_permissions (role, module, action, allowed)
VALUES
  ('owner', 'contacts', 'create', true),
  ('owner', 'contacts', 'delete', true),
  ('admin', 'contacts', 'create', true),
  ('admin', 'contacts', 'delete', true),
  ('manager', 'contacts', 'create', true),
  ('manager', 'contacts', 'delete', true),
  ('user', 'contacts', 'create', true),
  ('user', 'contacts', 'delete', false)
ON CONFLICT (role, module, action) DO NOTHING;
