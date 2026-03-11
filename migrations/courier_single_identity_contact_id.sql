-- ============================================================================
-- COURIER SINGLE IDENTITY: contact_id (PART 1–2, PART 7)
-- ============================================================================
-- Establishes contact_id as the single courier identity across ERP.
-- Flow: Contact (type=courier) → Account (contact_id) → Courier (contact_id, account_id)
-- Ledger views already use courier_id = accounts.contact_id; couriers now store it too.
-- Safe to run multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add contact_id to couriers
-- ----------------------------------------------------------------------------
ALTER TABLE couriers
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_couriers_contact_id ON couriers(contact_id) WHERE contact_id IS NOT NULL;
COMMENT ON COLUMN couriers.contact_id IS 'Single courier identity; same as accounts.contact_id for ledger. Filter/dropdown value = contact_id.';

-- ----------------------------------------------------------------------------
-- 2. Allow type = 'courier' on contacts (enum)
--    NOTE: New enum values cannot be used in the same transaction. Run
--    courier_single_identity_backfill.sql in a separate run after this commits.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_type') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'contact_type' AND e.enumlabel = 'courier') THEN
      ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'courier';
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN OTHERS THEN RAISE NOTICE 'contact_type courier: %', SQLERRM;
END $$;
