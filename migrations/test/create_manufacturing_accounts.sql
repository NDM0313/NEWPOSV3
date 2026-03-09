-- ============================================================================
-- TEST ONLY — Studio Manufacturing Accounting (STEP 2)
-- ============================================================================
-- Ensure manufacturing accounts exist. Do not run on production until approved.
-- Accounts: Raw Material Inventory, WIP, Finished Goods, COGS, Production Expense, Worker Payable, Sales Revenue.
-- ============================================================================

-- Add manufacturing subtypes if account_subtype enum exists and supports extension
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_subtype') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_subtype') AND enumlabel = 'raw_material_inventory') THEN
      ALTER TYPE account_subtype ADD VALUE 'raw_material_inventory';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_subtype') AND enumlabel = 'wip') THEN
      ALTER TYPE account_subtype ADD VALUE 'wip';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_subtype') AND enumlabel = 'finished_goods_inventory') THEN
      ALTER TYPE account_subtype ADD VALUE 'finished_goods_inventory';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_subtype') AND enumlabel = 'production_expense') THEN
      ALTER TYPE account_subtype ADD VALUE 'production_expense';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignore if enum alter fails
END $$;

-- Ensure accounts table exists (created by main migrations)
-- Create manufacturing accounts per company (only if not exists)
CREATE OR REPLACE FUNCTION ensure_manufacturing_accounts_test(p_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Raw Material Inventory (1200)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  SELECT p_company_id, '1200', 'Raw Material Inventory', 'asset', 0, true
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = p_company_id AND code = '1200');

  -- Work In Progress (1210)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  SELECT p_company_id, '1210', 'Work In Progress', 'asset', 0, true
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = p_company_id AND code = '1210');

  -- Finished Goods Inventory (1220)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  SELECT p_company_id, '1220', 'Finished Goods Inventory', 'asset', 0, true
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = p_company_id AND code = '1220');

  -- Cost of Goods Sold (5100)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  SELECT p_company_id, '5100', 'Cost of Goods Sold', 'expense', 0, true
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = p_company_id AND code = '5100');

  -- Production Expense (5000) - used by studio stage workflow
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  SELECT p_company_id, '5000', 'Production Expense', 'expense', 0, true
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = p_company_id AND code = '5000');

  -- Worker Payable (2010)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  SELECT p_company_id, '2010', 'Worker Payable', 'liability', 0, true
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = p_company_id AND code = '2010');

  -- Sales Revenue (4000)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  SELECT p_company_id, '4000', 'Sales Revenue', 'revenue', 0, true
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = p_company_id AND code = '4000');
END;
$$;

-- Ensure for all companies that have studio_productions or sales
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT DISTINCT company_id FROM studio_productions WHERE company_id IS NOT NULL
            UNION SELECT DISTINCT company_id FROM sales WHERE company_id IS NOT NULL)
  LOOP
    PERFORM ensure_manufacturing_accounts_test(r.company_id);
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

COMMENT ON FUNCTION ensure_manufacturing_accounts_test(UUID) IS 'TEST: Create manufacturing accounts if missing. Do not use in production until approved.';
