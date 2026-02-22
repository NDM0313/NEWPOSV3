-- Journal entries attachments (same pattern as payments.attachments).
-- Used by Manual Journal Entry (web) and Account Transfer (mobile).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'journal_entries' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN attachments JSONB DEFAULT NULL;
  END IF;
END $$;
