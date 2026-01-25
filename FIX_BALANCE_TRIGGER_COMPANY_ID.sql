-- Fix account balance trigger to properly handle company_id

CREATE OR REPLACE FUNCTION update_account_balance_from_journal()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
  v_company_id UUID;
BEGIN
  -- Determine which account to update
  IF TG_OP = 'DELETE' THEN
    v_account_id := OLD.account_id;
    -- Get company_id from journal entry
    SELECT je.company_id INTO v_company_id
    FROM journal_entries je
    WHERE je.id = OLD.journal_entry_id;
  ELSE
    v_account_id := NEW.account_id;
    -- Get company_id from journal entry
    SELECT je.company_id INTO v_company_id
    FROM journal_entries je
    WHERE je.id = NEW.journal_entry_id;
  END IF;
  
  -- Update account balance from all journal entry lines for this company
  UPDATE accounts
  SET balance = COALESCE((
    SELECT SUM(jel.debit - jel.credit)
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = v_account_id
      AND je.company_id = accounts.company_id
  ), 0)
  WHERE id = v_account_id;
  
  -- If DELETE, also need to handle the old account
  IF TG_OP = 'DELETE' AND OLD.account_id != COALESCE(NEW.account_id, OLD.account_id) THEN
    UPDATE accounts
    SET balance = COALESCE((
      SELECT SUM(jel.debit - jel.credit)
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.account_id = OLD.account_id
        AND je.company_id = accounts.company_id
    ), 0)
    WHERE id = OLD.account_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Test: Insert a test journal entry line and verify balance updates
-- (This will be handled automatically by the trigger)
