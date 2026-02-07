-- Ensure payments.attachments column exists (for payment attachment links from storage).
-- Safe to run: adds column only if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE payments ADD COLUMN attachments JSONB DEFAULT NULL;
  END IF;
END $$;
