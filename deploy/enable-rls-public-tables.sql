-- ============================================================================
-- Enable RLS on all public tables exposed to PostgREST (Security Advisor fix)
-- Creates fallback company-scoped or authenticated-only policy if none exists.
-- Run on VPS: docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=0 < deploy/enable-rls-public-tables.sql
-- ============================================================================

DO $$
DECLARE
  r RECORD;
  policy_count INT;
  has_company_id BOOLEAN;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename)
  LOOP
    BEGIN
      -- Enable RLS
      EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', r.tablename);

      -- Count existing policies
      SELECT count(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tablename;
      IF policy_count > 0 THEN
        CONTINUE; -- Table already has policies
      END IF;

      -- Check if table has company_id
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = r.tablename AND column_name = 'company_id'
      ) INTO has_company_id;

      IF has_company_id THEN
        -- Company-scoped fallback policy (all operations)
        EXECUTE format(
          'CREATE POLICY "rls_fix_company" ON public.%I FOR ALL TO authenticated USING (
            company_id = (SELECT company_id FROM public.users WHERE id = (SELECT auth.uid()))
          ) WITH CHECK (
            company_id = (SELECT company_id FROM public.users WHERE id = (SELECT auth.uid()))
          )',
          r.tablename
        );
      ELSE
        -- No company_id: authenticated-only fallback
        EXECUTE format(
          'CREATE POLICY "rls_fix_authenticated" ON public.%I FOR ALL TO authenticated USING (
            (SELECT auth.role()) = ''authenticated''
          ) WITH CHECK (
            (SELECT auth.role()) = ''authenticated''
          )',
          r.tablename
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Table %: %', r.tablename, SQLERRM;
    END;
  END LOOP;
END $$;
