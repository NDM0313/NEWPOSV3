-- ============================================================================
-- POS + STOCK + DB VALIDATION (run on Supabase / VPS)
-- ============================================================================
-- 1. stock_movements: allow company-scoped SELECT so POS/Sales can read stock
--    (existing branch policy may block staff without user_branches; this ensures read works)
-- 2. sales_company_branch_invoice_unique: ensure constraint exists (do not drop)
-- 3. branches RLS: already in branches_rls_company_scoped_select.sql
-- ============================================================================

-- 1. Stock movements: add company-scoped SELECT so authenticated users in company can read (for POS/Sales stock display)
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_movements_select_company" ON public.stock_movements;
CREATE POLICY "stock_movements_select_company"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- 2. Ensure sales unique constraint exists (invoice per company+branch)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_company_branch_invoice_unique'
  ) THEN
    ALTER TABLE public.sales
    ADD CONSTRAINT sales_company_branch_invoice_unique
    UNIQUE (company_id, branch_id, invoice_no);
    RAISE NOTICE 'Added sales_company_branch_invoice_unique';
  ELSE
    RAISE NOTICE 'sales_company_branch_invoice_unique already exists';
  END IF;
END $$;

-- 3. Ensure document numbering exists for POS (get_next_document_number_global or sequence)
-- No change if already present; app uses documentNumberService.getNextDocumentNumberGlobal for POS.
