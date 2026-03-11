-- Indexes for accounting report queries (Trial Balance, P&L, Balance Sheet)
-- Speeds up date-range and company filters and joins with journal_entry_lines.

-- journal_entries: filter by company and entry_date (used by getTrialBalance)
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_entry_date
  ON journal_entries (company_id, entry_date);

-- journal_entries: branch filter for report scope
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_branch_entry_date
  ON journal_entries (company_id, branch_id, entry_date);

-- journal_entry_lines: join from lines to entries and filter by account
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_journal_entry_id
  ON journal_entry_lines (journal_entry_id);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id
  ON journal_entry_lines (account_id);
