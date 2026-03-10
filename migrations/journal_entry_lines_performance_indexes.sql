-- ============================================================================
-- PERFORMANCE INDEXES: journal_entry_lines + journal_entries
-- ============================================================================
-- These indexes speed up the Studio Costs dashboard, Account Ledger, and
-- Customer Ledger queries which join journal_entry_lines with accounts and
-- journal_entries filtered by company / reference_type.
--
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================================

-- Index on journal_entry_lines.account_id (heavily used in Studio Costs + Account Ledger)
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id
  ON journal_entry_lines(account_id);

-- Index on journal_entry_lines.journal_entry_id (FK join, usually already has btree index)
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_journal_entry_id
  ON journal_entry_lines(journal_entry_id);

-- Index on journal_entries.company_id (all queries filter by company)
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_id
  ON journal_entries(company_id);

-- Index on journal_entries.reference_type + reference_id (studio stage lookup)
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference
  ON journal_entries(reference_type, reference_id);

-- Composite index: company_id + reference_type (Studio Costs primary query)
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_reftype
  ON journal_entries(company_id, reference_type);

-- Index on journal_entries.branch_id (branch-filtered queries)
CREATE INDEX IF NOT EXISTS idx_journal_entries_branch_id
  ON journal_entries(branch_id);

-- Index on journal_entries.entry_date (date-range queries in Ledger)
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date
  ON journal_entries(entry_date);

-- Composite: company_id + entry_date (Trial Balance, P&L, Balance Sheet date-range filters)
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_entry_date
  ON journal_entries(company_id, entry_date);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE tablename IN ('journal_entries', 'journal_entry_lines')
-- ORDER BY tablename, indexname;
