-- ============================================================================
-- Allow on-account payments: reference_type and reference_id nullable
-- When reference_type = 'on_account', reference_id is NULL and contact_id
-- links the payment to the customer/supplier for ledger.
-- Safe: only alters if column is currently NOT NULL.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'reference_type'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'reference_type'
        AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE public.payments ALTER COLUMN reference_type DROP NOT NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'reference_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'reference_id'
        AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE public.payments ALTER COLUMN reference_id DROP NOT NULL;
    END IF;
  END IF;
END $$;

-- Ensure contact_id exists for on-account linkage (no DDL if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'contact_id'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.payments.reference_type IS 'sale, purchase, rental, on_account, etc. NULL allowed for on_account.';
COMMENT ON COLUMN public.payments.reference_id IS 'UUID of linked document. NULL for on_account payments.';
