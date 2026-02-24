-- ============================================================================
-- ADD JOURNAL_ENTRIES COLUMNS (IF MISSING)
-- ============================================================================
-- Purpose: Fix "column total_debit of relation journal_entries does not exist"
-- The auto_post_sale_to_accounting trigger inserts total_debit, total_credit,
-- is_posted, posted_at, is_manual. The 02/03 schema creates journal_entries
-- without these columns.
-- ============================================================================

-- 1. journal_entries: total_debit, total_credit, is_posted, posted_at, is_manual
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='journal_entries' AND column_name='total_debit') THEN
    ALTER TABLE journal_entries ADD COLUMN total_debit DECIMAL(15,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='journal_entries' AND column_name='total_credit') THEN
    ALTER TABLE journal_entries ADD COLUMN total_credit DECIMAL(15,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='journal_entries' AND column_name='is_posted') THEN
    ALTER TABLE journal_entries ADD COLUMN is_posted BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='journal_entries' AND column_name='posted_at') THEN
    ALTER TABLE journal_entries ADD COLUMN posted_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='journal_entries' AND column_name='is_manual') THEN
    ALTER TABLE journal_entries ADD COLUMN is_manual BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. journal_entry_lines: account_name (used by auto_post_sale_to_accounting)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='journal_entry_lines' AND column_name='account_name') THEN
    ALTER TABLE journal_entry_lines ADD COLUMN account_name VARCHAR(255);
  END IF;
END $$;
