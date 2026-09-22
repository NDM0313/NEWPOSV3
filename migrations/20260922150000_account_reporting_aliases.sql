-- Reporting-only supplier alias layer for Trial Balance canonical rollup.
-- Does NOT rewrite journal_entry_lines. Distinct from journal_account_verified_remaps
-- (posting-only). Seed is empty when discovery finds 0 SAFE_SUPPLIER_ALIAS rows.

BEGIN;

CREATE TABLE IF NOT EXISTS public.account_reporting_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  canonical_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  contact_id uuid NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  alias_type text NOT NULL DEFAULT 'supplier_legacy',
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_reporting_aliases_source_ne_canonical
    CHECK (source_account_id <> canonical_account_id),
  CONSTRAINT account_reporting_aliases_uniq_source
    UNIQUE (company_id, source_account_id)
);

CREATE INDEX IF NOT EXISTS idx_account_reporting_aliases_company
  ON public.account_reporting_aliases (company_id);

CREATE INDEX IF NOT EXISTS idx_account_reporting_aliases_canonical
  ON public.account_reporting_aliases (company_id, canonical_account_id);

COMMENT ON TABLE public.account_reporting_aliases IS
  'REPORTING-ONLY effective-account map for Trial Balance canonical presentation. Never used for posting. Distinct from journal_account_verified_remaps.';

ALTER TABLE public.account_reporting_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_reporting_aliases_select_company ON public.account_reporting_aliases;
CREATE POLICY account_reporting_aliases_select_company
  ON public.account_reporting_aliases
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND public.get_user_company_id() IS NOT NULL
    AND company_id = public.get_user_company_id()
  );

REVOKE ALL ON TABLE public.account_reporting_aliases FROM PUBLIC;
REVOKE ALL ON TABLE public.account_reporting_aliases FROM anon;
GRANT SELECT ON TABLE public.account_reporting_aliases TO authenticated;
GRANT ALL ON TABLE public.account_reporting_aliases TO service_role;

-- Optional drill metadata: sources that roll into a canonical account.
CREATE OR REPLACE FUNCTION public.list_account_reporting_alias_sources(
  p_company_id uuid,
  p_canonical_account_id uuid
)
RETURNS TABLE (
  source_account_id uuid,
  source_account_code text,
  source_account_name text,
  contact_id uuid,
  alias_type text,
  notes text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public._unified_ledger_assert_caller_access(p_company_id, NULL);

  RETURN QUERY
  SELECT
    ara.source_account_id,
    src.code::text,
    src.name::text,
    ara.contact_id,
    ara.alias_type,
    ara.notes
  FROM public.account_reporting_aliases ara
  INNER JOIN public.accounts src ON src.id = ara.source_account_id
  WHERE ara.company_id = p_company_id
    AND ara.canonical_account_id = p_canonical_account_id
  ORDER BY src.code NULLS LAST;
END;
$fn$;

COMMENT ON FUNCTION public.list_account_reporting_alias_sources(uuid, uuid) IS
  'Reporting drill helper: legacy source accounts aliased into a canonical account.';

GRANT EXECUTE ON FUNCTION public.list_account_reporting_alias_sources(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_account_reporting_alias_sources(uuid, uuid) TO service_role;

-- Discovery 2026-09-22 (DIN COLLECTION): SAFE_SUPPLIER_ALIAS count = 0.
-- ROLE_EXCEPTION (DHL/KIRAN/SHAHMIM) and AMBIGUOUS never seeded.
-- Idempotent placeholder — insert SAFE rows here when discovery yields them:
-- INSERT INTO public.account_reporting_aliases (
--   company_id, source_account_id, canonical_account_id, contact_id,
--   alias_type, source, notes
-- ) VALUES
--   (...),
-- ON CONFLICT (company_id, source_account_id) DO NOTHING;

COMMIT;
