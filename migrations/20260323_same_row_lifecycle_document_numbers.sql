-- ============================================================================
-- Same-row lifecycle: stage numbers in separate columns; invoice_no / po_no final-only
-- Posting gates are STATUS-only in application code (no prefix-based accounting).
-- ============================================================================

-- SALES ---------------------------------------------------------------------
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS draft_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS quotation_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS order_no VARCHAR(100);

COMMENT ON COLUMN public.sales.draft_no IS 'Non-posted draft stage number (SDR-*). invoice_no NULL while draft.';
COMMENT ON COLUMN public.sales.quotation_no IS 'Non-posted quotation stage number (SQT-*).';
COMMENT ON COLUMN public.sales.order_no IS 'Non-posted order stage number (SOR-*).';
COMMENT ON COLUMN public.sales.invoice_no IS 'Final invoice number (SL-*) only when status=final; NULL for draft/quotation/order.';

-- Backfill from legacy single-column numbering
UPDATE public.sales s
SET
  draft_no = CASE WHEN lower(trim(s.status::text)) = 'draft' AND s.invoice_no IS NOT NULL THEN s.invoice_no ELSE s.draft_no END,
  quotation_no = CASE WHEN lower(trim(s.status::text)) = 'quotation' AND s.invoice_no IS NOT NULL THEN s.invoice_no ELSE s.quotation_no END,
  order_no = CASE WHEN lower(trim(s.status::text)) = 'order' AND s.invoice_no IS NOT NULL THEN s.invoice_no ELSE s.order_no END
WHERE lower(trim(s.status::text)) IN ('draft', 'quotation', 'order');

UPDATE public.sales
SET invoice_no = NULL
WHERE lower(trim(status::text)) IN ('draft', 'quotation', 'order');

-- Allow NULL invoice_no for non-final rows (requires dropping NOT NULL)
DO $$
BEGIN
  ALTER TABLE public.sales ALTER COLUMN invoice_no DROP NOT NULL;
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN others THEN RAISE NOTICE 'sales.invoice_no DROP NOT NULL: %', SQLERRM;
END $$;

-- Replace global unique on invoice_no with partial unique (final numbers only)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'sales' AND n.nspname = 'public'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%invoice_no%'
  LOOP
    EXECUTE format('ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_company_invoice_no_when_set
  ON public.sales (company_id, invoice_no)
  WHERE invoice_no IS NOT NULL;

-- PURCHASES -----------------------------------------------------------------
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS draft_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS order_no VARCHAR(100);

COMMENT ON COLUMN public.purchases.draft_no IS 'Draft stage PO number (PDR-*). po_no NULL until posted.';
COMMENT ON COLUMN public.purchases.order_no IS 'Ordered stage number (POR-*).';
COMMENT ON COLUMN public.purchases.po_no IS 'Final/received PUR-* number; NULL for draft/ordered.';

UPDATE public.purchases p
SET
  draft_no = CASE WHEN lower(trim(p.status::text)) = 'draft' AND p.po_no IS NOT NULL THEN p.po_no ELSE p.draft_no END,
  order_no = CASE WHEN lower(trim(p.status::text)) = 'ordered' AND p.po_no IS NOT NULL THEN p.po_no ELSE p.order_no END
WHERE lower(trim(p.status::text)) IN ('draft', 'ordered');

UPDATE public.purchases
SET po_no = NULL
WHERE lower(trim(status::text)) IN ('draft', 'ordered');

DO $$
BEGIN
  ALTER TABLE public.purchases ALTER COLUMN po_no DROP NOT NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'purchases.po_no DROP NOT NULL: %', SQLERRM;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'purchases' AND n.nspname = 'public'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%po_no%'
  LOOP
    EXECUTE format('ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_company_po_no_when_set
  ON public.purchases (company_id, po_no)
  WHERE po_no IS NOT NULL;
