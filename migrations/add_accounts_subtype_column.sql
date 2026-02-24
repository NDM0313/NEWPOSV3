-- ============================================================================
-- ADD SUBTYPE COLUMN TO ACCOUNTS (IF MISSING)
-- ============================================================================
-- Purpose: Fix "column subtype does not exist" when posting sales to accounting.
-- The auto_post_sale_to_accounting trigger queries accounts.subtype for
-- cash, sales_revenue, accounts_receivable. The 03_frontend_driven_schema
-- creates accounts without this column.
-- ============================================================================

-- 1. Create account_subtype enum if not exists
DO $$ BEGIN
  CREATE TYPE account_subtype AS ENUM (
    'cash', 'bank', 'mobile_wallet', 'accounts_receivable', 'accounts_payable',
    'inventory', 'fixed_asset', 'current_asset', 'current_liability', 'long_term_liability',
    'owner_capital', 'retained_earnings', 'sales_revenue', 'rental_revenue', 'studio_revenue',
    'cost_of_goods_sold', 'operating_expense', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Add subtype column to accounts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'subtype'
  ) THEN
    ALTER TABLE accounts ADD COLUMN subtype account_subtype;
  END IF;
END $$;

-- 3. Backfill subtype for existing accounts (by name/code patterns)
UPDATE accounts SET subtype = 'cash'
WHERE subtype IS NULL
  AND (
    LOWER(name) LIKE '%cash%'
    OR LOWER(name) LIKE '%main cash%'
    OR LOWER(name) LIKE '%cash counter%'
    OR code IN ('1000', '1010', '1100')
  );

UPDATE accounts SET subtype = 'bank'
WHERE subtype IS NULL
  AND (
    LOWER(name) LIKE '%bank%'
    OR LOWER(name) LIKE '%account%'
    OR code LIKE '12%'
  );

UPDATE accounts SET subtype = 'sales_revenue'
WHERE subtype IS NULL
  AND (
    LOWER(name) LIKE '%sales%'
    OR LOWER(name) LIKE '%revenue%'
    OR code IN ('4000', '4010', '4100')
  );

UPDATE accounts SET subtype = 'accounts_receivable'
WHERE subtype IS NULL
  AND (
    LOWER(name) LIKE '%receivable%'
    OR LOWER(name) LIKE '%ar %'
    OR LOWER(name) = 'ar'
    OR code IN ('1200', '1210')
  );

UPDATE accounts SET subtype = 'accounts_payable'
WHERE subtype IS NULL
  AND (
    LOWER(name) LIKE '%payable%'
    OR LOWER(name) LIKE '%ap %'
    OR LOWER(name) = 'ap'
  );
