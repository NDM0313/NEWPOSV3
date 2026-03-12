-- ============================================================================
-- Run AFTER courier_single_identity_enum_only.sql and couriers_table (or couriers_table_and_shipment_weight.sql).
-- ============================================================================
-- Safe to run even if enum not added yet (UPDATE skipped). Safe if couriers table does not exist yet (skipped).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'couriers')
     AND EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'contact_type' AND e.enumlabel = 'courier') THEN
    UPDATE contacts SET type = 'courier' WHERE id IN (SELECT contact_id FROM couriers WHERE contact_id IS NOT NULL);
  END IF;
END $$;
