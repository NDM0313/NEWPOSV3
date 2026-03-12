-- ============================================================================
-- COURIER SINGLE IDENTITY: BACKFILL (run in one go — no separate enum step needed)
-- ============================================================================
-- Creates contacts as type = 'supplier' to avoid enum "unsafe use" (courier added later).
-- After this succeeds, run courier_single_identity_enum_only.sql then
-- courier_single_identity_set_courier_type.sql to set type = 'courier'. Safe to run multiple times.
-- ============================================================================

-- 1. Ensure column exists (in case first migration was skipped)
DO $$
BEGIN
  ALTER TABLE couriers ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS idx_couriers_contact_id ON couriers(contact_id) WHERE contact_id IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'courier_single_identity_backfill: Could not alter couriers: %', SQLERRM;
END $$;

-- Backfill: couriers with account_id get contact_id from account or new contact
-- Use type = 'supplier' for new contacts so this runs without needing 'courier' in the enum yet
DO $$
DECLARE
  r RECORD;
  v_contact_id UUID;
BEGIN
  FOR r IN
    SELECT c.id AS courier_id, c.company_id, c.name, c.account_id
    FROM couriers c
    WHERE c.account_id IS NOT NULL AND (c.contact_id IS NULL OR NOT EXISTS (SELECT 1 FROM contacts ct WHERE ct.id = c.contact_id))
  LOOP
    SELECT a.contact_id INTO v_contact_id FROM accounts a WHERE a.id = r.account_id;
    IF v_contact_id IS NOT NULL THEN
      UPDATE couriers SET contact_id = v_contact_id WHERE id = r.courier_id;
    ELSE
      -- Look up by company + name (any type) or create as 'supplier' so we don't need 'courier' in same transaction
      SELECT id INTO v_contact_id FROM contacts WHERE company_id = r.company_id AND TRIM(name) = TRIM(r.name) LIMIT 1;
      IF v_contact_id IS NULL THEN
        INSERT INTO contacts (company_id, type, name, is_active, opening_balance, credit_limit, payment_terms)
        VALUES (r.company_id, 'supplier', TRIM(r.name), true, 0, 0, 0)
        RETURNING id INTO v_contact_id;
      END IF;
      IF v_contact_id IS NOT NULL THEN
        UPDATE accounts SET contact_id = v_contact_id WHERE id = r.account_id;
        UPDATE couriers SET contact_id = v_contact_id WHERE id = r.courier_id;
      END IF;
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'courier_single_identity_backfill: Backfill loop: %', SQLERRM;
END $$;

-- Set courier.contact_id from account.contact_id where account exists and courier.contact_id is null
DO $$
BEGIN
  UPDATE couriers c
  SET contact_id = a.contact_id
  FROM accounts a
  WHERE c.account_id = a.id AND a.contact_id IS NOT NULL AND c.contact_id IS NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'courier_single_identity_backfill: Final update: %', SQLERRM;
END $$;
