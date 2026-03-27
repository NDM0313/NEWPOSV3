-- RPC get_contact_balances_summary (and app) reference c.supplier_opening_balance for supplier/both payables opening.
-- Older DBs only had opening_balance; add column idempotently.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'supplier_opening_balance'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN supplier_opening_balance DECIMAL(15, 2) DEFAULT 0;
    COMMENT ON COLUMN public.contacts.supplier_opening_balance IS
      'Opening payables for supplier/both contacts; RPC get_contact_balances_summary uses COALESCE(supplier_opening_balance, opening_balance).';
  END IF;
END $$;
