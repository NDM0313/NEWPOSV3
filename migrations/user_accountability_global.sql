-- ============================================================================
-- GLOBAL USER ACCOUNTABILITY
-- ============================================================================
-- Ensures every transactional record stores which authenticated user created
-- or performed the action. Database-level enforcement via triggers.
-- Do NOT trust frontend to send user_id; derive from auth.uid().
-- ============================================================================

-- Helper: set created_by from auth.uid() on INSERT when null
CREATE OR REPLACE FUNCTION set_created_by_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  IF TG_OP = 'INSERT' AND NEW.created_at IS NULL THEN
    NEW.created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- Sales
DROP TRIGGER IF EXISTS set_sales_created_by ON sales;
CREATE TRIGGER set_sales_created_by
  BEFORE INSERT ON sales
  FOR EACH ROW EXECUTE PROCEDURE set_created_by_from_auth();

-- Purchases
DROP TRIGGER IF EXISTS set_purchases_created_by ON purchases;
CREATE TRIGGER set_purchases_created_by
  BEFORE INSERT ON purchases
  FOR EACH ROW EXECUTE PROCEDURE set_created_by_from_auth();

-- Payments (created_by = user who received/recorded the payment)
DROP TRIGGER IF EXISTS set_payments_created_by ON payments;
CREATE TRIGGER set_payments_created_by
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE PROCEDURE set_created_by_from_auth();

-- Expenses
DROP TRIGGER IF EXISTS set_expenses_created_by ON expenses;
CREATE TRIGGER set_expenses_created_by
  BEFORE INSERT ON expenses
  FOR EACH ROW EXECUTE PROCEDURE set_created_by_from_auth();

-- Journal entries (ledger)
DROP TRIGGER IF EXISTS set_journal_entries_created_by ON journal_entries;
CREATE TRIGGER set_journal_entries_created_by
  BEFORE INSERT ON journal_entries
  FOR EACH ROW EXECUTE PROCEDURE set_created_by_from_auth();

-- Ledger entries (if table exists and has created_by)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ledger_entries') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ledger_entries' AND column_name = 'created_by') THEN
      EXECUTE 'DROP TRIGGER IF EXISTS set_ledger_entries_created_by ON ledger_entries';
      EXECUTE 'CREATE TRIGGER set_ledger_entries_created_by BEFORE INSERT ON ledger_entries FOR EACH ROW EXECUTE PROCEDURE set_created_by_from_auth()';
    END IF;
  END IF;
END $$;

-- Sale returns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sale_returns') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sale_returns' AND column_name = 'created_by') THEN
      EXECUTE 'DROP TRIGGER IF EXISTS set_sale_returns_created_by ON sale_returns';
      EXECUTE 'CREATE TRIGGER set_sale_returns_created_by BEFORE INSERT ON sale_returns FOR EACH ROW EXECUTE PROCEDURE set_created_by_from_auth()';
    END IF;
  END IF;
END $$;

-- Purchase returns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_returns') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_returns' AND column_name = 'created_by') THEN
      EXECUTE 'DROP TRIGGER IF EXISTS set_purchase_returns_created_by ON purchase_returns';
      EXECUTE 'CREATE TRIGGER set_purchase_returns_created_by BEFORE INSERT ON purchase_returns FOR EACH ROW EXECUTE PROCEDURE set_created_by_from_auth()';
    END IF;
  END IF;
END $$;

-- Contacts (optional; many schemas have created_by)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'created_by') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_contacts_created_by ON contacts';
    EXECUTE 'CREATE TRIGGER set_contacts_created_by BEFORE INSERT ON contacts FOR EACH ROW EXECUTE PROCEDURE set_created_by_from_auth()';
  END IF;
END $$;
