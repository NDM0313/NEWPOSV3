-- ============================================================================
-- Run AFTER courier_single_identity_enum_only.sql (in a separate query).
-- ============================================================================
-- 1. Run courier_single_identity_enum_only.sql in its own query first.
-- 2. Then run THIS file. Safe to run even if enum not added yet (UPDATE is skipped until then).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'contact_type' AND e.enumlabel = 'courier') THEN
    UPDATE contacts SET type = 'courier' WHERE id IN (SELECT contact_id FROM couriers WHERE contact_id IS NOT NULL);
  END IF;
END $$;
