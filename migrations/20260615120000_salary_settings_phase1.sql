-- Phase 1: Salary settings + default payroll settings (no payroll runs, GL, or payments).
-- Additive only — does not alter employees, sales, commission, or journal tables.

CREATE TABLE IF NOT EXISTS public.salary_settings (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  salary_enabled BOOLEAN NOT NULL DEFAULT true,
  basic_monthly_salary NUMERIC(18, 2) NOT NULL DEFAULT 0,
  /** NULL = use company default_payroll_settings.generationDay (default 30). */
  generation_day SMALLINT CHECK (generation_day IS NULL OR (generation_day >= 1 AND generation_day <= 31)),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  default_payment_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  commission_enabled BOOLEAN NOT NULL DEFAULT true,
  /** Phase 1: commission amounts come from existing sale/rental engine — no recalc here. */
  commission_mode TEXT NOT NULL DEFAULT 'existing_sales'
    CHECK (commission_mode IN ('existing_sales')),
  advance_allowed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_salary_settings_company_id ON public.salary_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_salary_settings_branch_id ON public.salary_settings(branch_id);
CREATE INDEX IF NOT EXISTS idx_salary_settings_active ON public.salary_settings(company_id, is_active);

COMMENT ON TABLE public.salary_settings IS
  'Per-staff salary/payroll configuration (Phase 1). Commission amounts remain on sales/rentals — not duplicated here.';

-- updated_at touch
CREATE OR REPLACE FUNCTION public.touch_salary_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_salary_settings_updated_at ON public.salary_settings;
CREATE TRIGGER trg_salary_settings_updated_at
  BEFORE UPDATE ON public.salary_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_salary_settings_updated_at();

-- RLS: company-scoped read; admin/owner write (Phase 1 — no payroll permission engine yet)
ALTER TABLE public.salary_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salary_settings_select_company ON public.salary_settings;
CREATE POLICY salary_settings_select_company ON public.salary_settings
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS salary_settings_insert_admin ON public.salary_settings;
CREATE POLICY salary_settings_insert_admin ON public.salary_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.is_owner_or_admin()
  );

DROP POLICY IF EXISTS salary_settings_update_admin ON public.salary_settings;
CREATE POLICY salary_settings_update_admin ON public.salary_settings
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.is_owner_or_admin()
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.is_owner_or_admin()
  );

DROP POLICY IF EXISTS salary_settings_delete_admin ON public.salary_settings;
CREATE POLICY salary_settings_delete_admin ON public.salary_settings
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.is_owner_or_admin()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_settings TO service_role;

-- Idempotent backfill from legacy employees table (safe: ON CONFLICT DO NOTHING)
INSERT INTO public.salary_settings (
  user_id,
  company_id,
  salary_enabled,
  basic_monthly_salary,
  commission_enabled,
  is_active,
  notes
)
SELECT
  e.user_id,
  u.company_id,
  e.is_active,
  COALESCE(e.basic_salary, 0),
  (COALESCE(e.commission_rate, 0) > 0 OR u.can_be_assigned_as_salesman IS TRUE),
  e.is_active,
  'Backfilled from employees table (Phase 1 migration)'
FROM public.employees e
INNER JOIN public.users u ON u.id = e.user_id
WHERE u.company_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Backfill RPC for admin re-run (returns inserted count)
CREATE OR REPLACE FUNCTION public.backfill_salary_settings_from_employees(p_company_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID;
  v_inserted INTEGER := 0;
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Only admin or owner can run salary settings backfill';
  END IF;

  v_company := COALESCE(p_company_id, public.get_user_company_id());
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Company context required';
  END IF;

  INSERT INTO public.salary_settings (
    user_id,
    company_id,
    salary_enabled,
    basic_monthly_salary,
    commission_enabled,
    is_active,
    notes
  )
  SELECT
    e.user_id,
    u.company_id,
    e.is_active,
    COALESCE(e.basic_salary, 0),
    (COALESCE(e.commission_rate, 0) > 0 OR u.can_be_assigned_as_salesman IS TRUE),
    e.is_active,
    'Backfilled from employees via backfill_salary_settings_from_employees'
  FROM public.employees e
  INNER JOIN public.users u ON u.id = e.user_id
  WHERE u.company_id = v_company
  ON CONFLICT (user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'company_id', v_company,
    'inserted', v_inserted,
    'ok', true
  );
END;
$$;

COMMENT ON FUNCTION public.backfill_salary_settings_from_employees(UUID) IS
  'Phase 1: copy employees.basic_salary into salary_settings where missing. Idempotent.';

GRANT EXECUTE ON FUNCTION public.backfill_salary_settings_from_employees(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_salary_settings_from_employees(UUID) TO service_role;
