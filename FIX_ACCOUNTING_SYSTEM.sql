-- ============================================================================
-- COMPREHENSIVE ACCOUNTING SYSTEM FIX
-- ============================================================================

-- Step 1: Fix Accounts Receivable (code 2000 should be asset, not liability)
-- Update existing account if it exists with wrong type
UPDATE accounts 
SET name = 'Accounts Receivable', type = 'asset'
WHERE code = '2000' AND (name != 'Accounts Receivable' OR type != 'asset');

-- Create Accounts Receivable if it doesn't exist (for all companies)
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT DISTINCT company_id FROM companies
  LOOP
    -- Check if Accounts Receivable exists for this company
    IF NOT EXISTS (
      SELECT 1 FROM accounts 
      WHERE company_id = company_record.company_id 
      AND code = '2000'
    ) THEN
      INSERT INTO accounts (company_id, code, name, type, balance, is_active)
      VALUES (company_record.company_id, '2000', 'Accounts Receivable', 'asset', 0, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Step 2: Ensure Cash (1000) and Bank (1010) exist for all companies
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT DISTINCT company_id FROM companies
  LOOP
    -- Cash Account
    IF NOT EXISTS (
      SELECT 1 FROM accounts 
      WHERE company_id = company_record.company_id 
      AND code = '1000'
    ) THEN
      INSERT INTO accounts (company_id, code, name, type, balance, is_active)
      VALUES (company_record.company_id, '1000', 'Cash', 'asset', 0, true)
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Bank Account
    IF NOT EXISTS (
      SELECT 1 FROM accounts 
      WHERE company_id = company_record.company_id 
      AND code = '1010'
    ) THEN
      INSERT INTO accounts (company_id, code, name, type, balance, is_active)
      VALUES (company_record.company_id, '1010', 'Bank', 'asset', 0, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Step 3: Add payment_id column to journal_entries if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entries' 
    AND column_name = 'payment_id'
  ) THEN
    ALTER TABLE journal_entries 
    ADD COLUMN payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_journal_entries_payment 
    ON journal_entries(payment_id);
  END IF;
END $$;

-- Step 4: Update existing journal entries to link to payments
-- Link journal entries to payments where reference_type = 'sale' and reference_id matches
UPDATE journal_entries je
SET payment_id = p.id
FROM payments p
WHERE je.reference_type = 'sale'
  AND je.reference_id = p.reference_id
  AND p.reference_type = 'sale'
  AND je.payment_id IS NULL;

-- Step 5: Ensure payment_account_id is NOT NULL constraint (add check)
-- Note: We'll enforce this in application code, not as DB constraint
-- to allow flexibility during migration

-- Step 6: Verify foreign keys exist
DO $$
BEGIN
  -- Verify payments.payment_account_id → accounts.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'payments_payment_account_id_fkey'
  ) THEN
    ALTER TABLE payments
    ADD CONSTRAINT payments_payment_account_id_fkey 
    FOREIGN KEY (payment_account_id) REFERENCES accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 7: Create index for faster payment lookups by sale
CREATE INDEX IF NOT EXISTS idx_payments_reference_sale 
ON payments(reference_type, reference_id) 
WHERE reference_type = 'sale';

-- Verification queries
SELECT 'Accounts Receivable' as check_name, COUNT(*) as count 
FROM accounts WHERE code = '2000' AND type = 'asset'
UNION ALL
SELECT 'Cash Accounts', COUNT(*) FROM accounts WHERE code = '1000'
UNION ALL
SELECT 'Bank Accounts', COUNT(*) FROM accounts WHERE code = '1010'
UNION ALL
SELECT 'Journal Entries with Payment Link', COUNT(*) 
FROM journal_entries WHERE payment_id IS NOT NULL;
