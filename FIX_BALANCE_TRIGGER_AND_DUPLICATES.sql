-- ============================================================================
-- FIX ACCOUNT BALANCE TRIGGER AND PREVENT DUPLICATE JOURNAL ENTRIES
-- ============================================================================

-- Fix account balance trigger to handle UPDATE and DELETE
CREATE OR REPLACE FUNCTION update_account_balance_from_journal()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- Determine which account to update
  IF TG_OP = 'DELETE' THEN
    v_account_id := OLD.account_id;
  ELSE
    v_account_id := NEW.account_id;
  END IF;
  
  -- Update account balance from all journal entry lines
  UPDATE accounts
  SET balance = COALESCE((
    SELECT SUM(jel.debit - jel.credit)
    FROM journal_entry_lines jel
    WHERE jel.account_id = v_account_id
  ), 0)
  WHERE id = v_account_id;
  
  -- If DELETE, also need to handle the old account
  IF TG_OP = 'DELETE' AND OLD.account_id != COALESCE(NEW.account_id, OLD.account_id) THEN
    UPDATE accounts
    SET balance = COALESCE((
      SELECT SUM(jel.debit - jel.credit)
      FROM journal_entry_lines jel
      WHERE jel.account_id = OLD.account_id
    ), 0)
    WHERE id = OLD.account_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_update_account_balance ON journal_entry_lines;
CREATE TRIGGER trigger_update_account_balance
AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION update_account_balance_from_journal();

-- Prevent duplicate journal entries from trigger
-- Modify auto_create_payment_journal_entry to check if entry already exists
CREATE OR REPLACE FUNCTION auto_create_payment_journal_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id UUID;
  v_customer_name VARCHAR;
  v_exists BOOLEAN;
BEGIN
  -- Only process sale payments
  IF NEW.reference_type = 'sale' AND NEW.reference_id IS NOT NULL THEN
    v_sale_id := NEW.reference_id;
    
    -- Check if journal entry already exists for this payment
    SELECT EXISTS(
      SELECT 1 FROM journal_entries je 
      WHERE je.payment_id = NEW.id
    ) INTO v_exists;
    
    -- Only create if doesn't exist (prevent duplicates)
    IF NOT v_exists THEN
      -- Get customer name
      SELECT customer_name INTO v_customer_name
      FROM sales
      WHERE id = v_sale_id;
      
      -- Create journal entry
      PERFORM create_payment_journal_entry(
        NEW.id,
        NEW.company_id,
        NEW.branch_id,
        v_sale_id,
        NEW.amount,
        NEW.payment_account_id,
        v_customer_name
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove duplicate journal entries if any exist
DELETE FROM journal_entry_lines jel1
WHERE EXISTS (
  SELECT 1 FROM journal_entry_lines jel2
  JOIN journal_entries je1 ON je1.id = jel1.journal_entry_id
  JOIN journal_entries je2 ON je2.id = jel2.journal_entry_id
  WHERE jel2.account_id = jel1.account_id
    AND jel2.debit = jel1.debit
    AND jel2.credit = jel1.credit
    AND je2.payment_id = je1.payment_id
    AND je2.payment_id IS NOT NULL
    AND jel2.id < jel1.id
);

-- Recalculate all balances
UPDATE accounts a
SET balance = COALESCE((
  SELECT SUM(jel.debit - jel.credit)
  FROM journal_entry_lines jel
  WHERE jel.account_id = a.id
), 0);

-- Verification
SELECT 
  'Balance Check' as check_name,
  a.code,
  a.name,
  a.balance,
  (SELECT SUM(jel.debit - jel.credit) FROM journal_entry_lines jel WHERE jel.account_id = a.id) as calculated
FROM accounts a
WHERE a.code IN ('1000', '1010', '2000', '4100', '5200')
  AND a.company_id = (SELECT id FROM companies LIMIT 1)
ORDER BY a.code;
