-- Fix: column "current_balance" does not exist
-- contacts: 03 schema has opening_balance only; triggers expect current_balance
-- accounts: has balance only; update_all_account_balances expects current_balance

-- 1. Add current_balance to contacts if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'current_balance'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN current_balance DECIMAL(15,2) DEFAULT 0;
    -- Initialize from opening_balance
    UPDATE public.contacts SET current_balance = COALESCE(opening_balance, 0) WHERE current_balance IS NULL;
  END IF;
END $$;

-- 2. Fix update_contact_balance_on_sale: use current_balance (now exists) or opening_balance as fallback
CREATE OR REPLACE FUNCTION update_contact_balance_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'final' AND NEW.customer_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='current_balance') THEN
      UPDATE contacts SET current_balance = COALESCE(current_balance, 0) + NEW.due_amount WHERE id = NEW.customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Fix update_contact_balance_on_purchase
CREATE OR REPLACE FUNCTION update_contact_balance_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'final' AND NEW.supplier_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='current_balance') THEN
      UPDATE contacts SET current_balance = COALESCE(current_balance, 0) - NEW.due_amount WHERE id = NEW.supplier_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Fix get_account_balance: use balance when opening_balance doesn't exist
CREATE OR REPLACE FUNCTION get_account_balance(account_uuid UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
  v_balance DECIMAL(15,2);
  v_debits DECIMAL(15,2);
  v_credits DECIMAL(15,2);
  v_account RECORD;
  v_opening DECIMAL(15,2);
BEGIN
  SELECT * INTO v_account FROM accounts WHERE id = account_uuid;
  v_opening := COALESCE(v_account.opening_balance, v_account.balance, 0);

  SELECT COALESCE(SUM(jel.debit), 0), COALESCE(SUM(jel.credit), 0)
  INTO v_debits, v_credits
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = account_uuid;

  CASE v_account.type
    WHEN 'asset', 'expense' THEN v_balance := v_opening + v_debits - v_credits;
    WHEN 'liability', 'equity', 'revenue' THEN v_balance := v_opening + v_credits - v_debits;
    ELSE v_balance := 0;
  END CASE;
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- 5. Fix update_all_account_balances: use balance (accounts has balance, not current_balance)
CREATE OR REPLACE FUNCTION update_all_account_balances()
RETURNS VOID AS $$
DECLARE
  v_account RECORD;
BEGIN
  FOR v_account IN SELECT id FROM accounts WHERE is_active = true
  LOOP
    UPDATE accounts SET balance = get_account_balance(v_account.id) WHERE id = v_account.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
