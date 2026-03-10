-- ============================================================================
-- ACCOUNTING: ENSURE DEFAULT ACCOUNTS FOR ALL COMPANIES
-- ============================================================================
-- Ensures the minimum Chart of Accounts required for ERP journal entries:
--
--   2000  Accounts Receivable   (Asset)      — Dr on sale finalization
--   4000  Sales Revenue          (Revenue)    — Cr on sale finalization
--   5000  Cost of Production     (Expense)    — Dr on studio stage completion
--   2010  Worker Payable         (Liability)  — Cr on studio stage completion
--
-- Sales Revenue (4000) is handled by create_sales_revenue_account.sql.
-- This migration adds the remaining three accounts.
--
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
-- ============================================================================

-- Helper function ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ensure_erp_accounts(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
  -- 2000  Accounts Receivable
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '2000', 'Accounts Receivable', 'Accounts Receivable', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 4000  Sales Revenue (also handled by create_sales_revenue_account.sql)
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '4000', 'Sales Revenue', 'Sales Revenue', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 5000  Cost of Production
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '5000', 'Cost of Production', 'Cost of Production', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 2010  Worker Payable
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  VALUES (p_company_id, '2010', 'Worker Payable', 'Worker Payable', 0, true)
  ON CONFLICT (company_id, code) DO NOTHING;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ensure_erp_accounts failed for company %: %', p_company_id, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- Run for every company that already has at least one account
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT company_id
    FROM accounts
    WHERE company_id IS NOT NULL
  LOOP
    PERFORM ensure_erp_accounts(r.company_id);
  END LOOP;
END $$;

-- Also run for companies from the companies table (may have no accounts yet)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id AS company_id FROM companies
  LOOP
    PERFORM ensure_erp_accounts(r.company_id);
  END LOOP;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'companies table not found – skipping';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification query (run manually to confirm)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT company_id, code, name, type, is_active
-- FROM accounts
-- WHERE code IN ('2000', '4000', '5000', '2010')
-- ORDER BY company_id, code;
