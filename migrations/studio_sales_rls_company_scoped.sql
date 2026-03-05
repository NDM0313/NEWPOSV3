-- ============================================================================
-- STUDIO_SALES RLS (company-scoped via branch)
-- ============================================================================
-- Optional: run only if studio_sales table exists and has no RLS.
-- studio_sales has branch_id (no company_id); scope via branches.company_id.
-- Aligns with PERMISSION_ALIGNMENT_AUDIT: studio_sales had no RLS in migrations.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'studio_sales') THEN
    ALTER TABLE public.studio_sales ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "studio_sales_select_company" ON public.studio_sales;
    CREATE POLICY "studio_sales_select_company"
      ON public.studio_sales FOR SELECT TO authenticated
      USING (
        branch_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.branches b
          WHERE b.id = studio_sales.branch_id AND b.company_id = get_user_company_id()
        )
      );

    DROP POLICY IF EXISTS "studio_sales_insert_company" ON public.studio_sales;
    CREATE POLICY "studio_sales_insert_company"
      ON public.studio_sales FOR INSERT TO authenticated
      WITH CHECK (
        branch_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.branches b
          WHERE b.id = branch_id AND b.company_id = get_user_company_id()
        )
      );

    DROP POLICY IF EXISTS "studio_sales_update_company" ON public.studio_sales;
    CREATE POLICY "studio_sales_update_company"
      ON public.studio_sales FOR UPDATE TO authenticated
      USING (
        branch_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.branches b
          WHERE b.id = studio_sales.branch_id AND b.company_id = get_user_company_id()
        )
      )
      WITH CHECK (
        branch_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.branches b
          WHERE b.id = studio_sales.branch_id AND b.company_id = get_user_company_id()
        )
      );

    DROP POLICY IF EXISTS "studio_sales_delete_company" ON public.studio_sales;
    CREATE POLICY "studio_sales_delete_company"
      ON public.studio_sales FOR DELETE TO authenticated
      USING (
        branch_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.branches b
          WHERE b.id = studio_sales.branch_id AND b.company_id = get_user_company_id()
        )
      );

    RAISE NOTICE 'studio_sales RLS policies created (company-scoped via branch).';
  ELSE
    RAISE NOTICE 'studio_sales table not found; skipping RLS.';
  END IF;
END $$;
