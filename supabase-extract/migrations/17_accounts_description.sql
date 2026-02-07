-- Add description/notes column to accounts for Create Account form (Operational & Professional tabs).
-- Safe to run: only adds column if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'description'
  ) THEN
    ALTER TABLE accounts ADD COLUMN description TEXT;
  END IF;
END $$;
