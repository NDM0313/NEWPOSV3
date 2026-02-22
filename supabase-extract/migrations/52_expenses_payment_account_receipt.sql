-- Add payment_account_id and receipt_url to expenses if missing (for mobile Add Expense + web).
-- Run in Supabase SQL Editor or via deploy/VPS.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'payment_account_id'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN payment_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'receipt_url'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN receipt_url TEXT;
  END IF;
END $$;
