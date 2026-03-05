-- ============================================================================
-- STUDIO_PRODUCTIONS + STUDIO_PRODUCTION_STAGES RLS (company-scoped)
-- ============================================================================
-- Fix: 403 on POST studio_productions – "new row violates row-level security policy"
-- Backfill and app need to INSERT/SELECT studio_productions and stages for the user's company.
-- Requires: get_user_company_id() exists (e.g. from enterprise_defaults_and_rls_isolation.sql).
-- ============================================================================

-- 1. studio_productions: allow authenticated users to CRUD rows for their company
ALTER TABLE public.studio_productions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_productions_select_company" ON public.studio_productions;
CREATE POLICY "studio_productions_select_company"
  ON public.studio_productions FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "studio_productions_insert_company" ON public.studio_productions;
CREATE POLICY "studio_productions_insert_company"
  ON public.studio_productions FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "studio_productions_update_company" ON public.studio_productions;
CREATE POLICY "studio_productions_update_company"
  ON public.studio_productions FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "studio_productions_delete_company" ON public.studio_productions;
CREATE POLICY "studio_productions_delete_company"
  ON public.studio_productions FOR DELETE TO authenticated
  USING (company_id = get_user_company_id());

-- 2. studio_production_stages: allow access when parent production is in user's company
ALTER TABLE public.studio_production_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_production_stages_select_company" ON public.studio_production_stages;
CREATE POLICY "studio_production_stages_select_company"
  ON public.studio_production_stages FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.studio_productions p WHERE p.id = studio_production_stages.production_id AND p.company_id = get_user_company_id())
  );

DROP POLICY IF EXISTS "studio_production_stages_insert_company" ON public.studio_production_stages;
CREATE POLICY "studio_production_stages_insert_company"
  ON public.studio_production_stages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.studio_productions p WHERE p.id = studio_production_stages.production_id AND p.company_id = get_user_company_id())
  );

DROP POLICY IF EXISTS "studio_production_stages_update_company" ON public.studio_production_stages;
CREATE POLICY "studio_production_stages_update_company"
  ON public.studio_production_stages FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.studio_productions p WHERE p.id = studio_production_stages.production_id AND p.company_id = get_user_company_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.studio_productions p WHERE p.id = studio_production_stages.production_id AND p.company_id = get_user_company_id())
  );

DROP POLICY IF EXISTS "studio_production_stages_delete_company" ON public.studio_production_stages;
CREATE POLICY "studio_production_stages_delete_company"
  ON public.studio_production_stages FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.studio_productions p WHERE p.id = studio_production_stages.production_id AND p.company_id = get_user_company_id())
  );
