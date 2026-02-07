-- Add default account columns to branches (Cash, Bank, POS Drawer per branch).
-- Safe to run: adds columns only if missing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'default_cash_account_id') THEN
    ALTER TABLE branches ADD COLUMN default_cash_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'default_bank_account_id') THEN
    ALTER TABLE branches ADD COLUMN default_bank_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'default_pos_drawer_account_id') THEN
    ALTER TABLE branches ADD COLUMN default_pos_drawer_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
  END IF;
END $$;
