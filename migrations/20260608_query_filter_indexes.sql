-- ============================================================================
-- QUERY FILTER INDEXES (gap-only, additive)
-- ============================================================================
-- Speeds list/filter queries on sales, rentals, and accounts.
-- journal_entries reference + company indexes exist in journal_entry_lines_performance_indexes.sql
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================================

-- Sales: company + status (general list filter)
CREATE INDEX IF NOT EXISTS idx_sales_company_status
  ON sales(company_id, status);

-- Sales: branch-scoped list with status
CREATE INDEX IF NOT EXISTS idx_sales_company_branch_status
  ON sales(company_id, branch_id, status);

-- Rentals: list ordered by created_at with status filter
CREATE INDEX IF NOT EXISTS idx_rentals_company_status_created
  ON rentals(company_id, status, created_at DESC);

-- Rentals: created_by (user-scoped queries; column is created_by not user_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'created_by'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_rentals_created_by ON rentals(created_by);
  END IF;
END $$;

-- Accounts: active COA filter per company
CREATE INDEX IF NOT EXISTS idx_accounts_company_is_active
  ON accounts(company_id, is_active);
