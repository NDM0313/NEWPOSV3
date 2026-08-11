-- W1 successor: Import FX case attachment table security.
-- Additive only. Does not edit prior W1 migrations.
-- Gap: authenticated had SELECT/INSERT/UPDATE/DELETE with company-only RLS
-- (no parent-case branch check); storage_path exposed via direct SELECT.
-- Fix: revoke direct client table privileges; client reads via get_import_fx_case
-- (already omits storage_path). Defense-in-depth RLS derives access from parent case.
-- No journals/payments. No attachment mutation RPCs in W1.

-- ---------------------------------------------------------------------------
-- A) Parent-case access predicate (SECURITY DEFINER; for RLS defense-in-depth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._import_fx_case_attachment_parent_access_ok(
  p_company_id uuid,
  p_case_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auth_company uuid;
  v_branch uuid;
BEGIN
  IF p_company_id IS NULL OR p_case_id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_auth_company := public.get_user_company_id();
  IF v_auth_company IS NULL OR v_auth_company IS DISTINCT FROM p_company_id THEN
    RETURN FALSE;
  END IF;

  SELECT c.branch_id INTO v_branch
  FROM public.import_fx_cases c
  WHERE c.id = p_case_id
    AND c.company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN public._import_fx_case_branch_row_allowed(v_branch);
END;
$$;

COMMENT ON FUNCTION public._import_fx_case_attachment_parent_access_ok(uuid, uuid) IS
  'True when session company owns the parent Import FX case and branch access is allowed.';

CREATE OR REPLACE FUNCTION public._import_fx_case_attachment_mutation_ok(
  p_company_id uuid,
  p_case_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public._import_fx_case_attachment_parent_access_ok(p_company_id, p_case_id) THEN
    RETURN FALSE;
  END IF;
  -- Mutations require Multi Currency ON (historical OFF is read-only).
  RETURN public._company_import_fx_enabled(p_company_id);
END;
$$;

COMMENT ON FUNCTION public._import_fx_case_attachment_mutation_ok(uuid, uuid) IS
  'Parent-case access OK and multiCurrencyEnabled for attachment writes.';

-- Helpers are internal; do not expose to anon. Authenticated may need EXECUTE only if
-- table privileges are re-granted later (RLS). Keep revoked from authenticated for now
-- because table privileges are revoked — SECURITY DEFINER owner evaluates policies.
REVOKE ALL ON FUNCTION public._import_fx_case_attachment_parent_access_ok(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_case_attachment_mutation_ok(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- B) Replace company-only FOR ALL policy with parent-case / branch policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS import_fx_case_attachments_company ON public.import_fx_case_attachments;

DROP POLICY IF EXISTS import_fx_case_attachments_select ON public.import_fx_case_attachments;
CREATE POLICY import_fx_case_attachments_select
  ON public.import_fx_case_attachments
  FOR SELECT
  TO authenticated
  USING (
    public._import_fx_case_attachment_parent_access_ok(company_id, case_id)
  );

DROP POLICY IF EXISTS import_fx_case_attachments_insert ON public.import_fx_case_attachments;
CREATE POLICY import_fx_case_attachments_insert
  ON public.import_fx_case_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public._import_fx_case_attachment_mutation_ok(company_id, case_id)
  );

DROP POLICY IF EXISTS import_fx_case_attachments_update ON public.import_fx_case_attachments;
CREATE POLICY import_fx_case_attachments_update
  ON public.import_fx_case_attachments
  FOR UPDATE
  TO authenticated
  USING (
    public._import_fx_case_attachment_mutation_ok(company_id, case_id)
  )
  WITH CHECK (
    -- Prevent moving attachment onto an unauthorized / other-company case.
    public._import_fx_case_attachment_mutation_ok(company_id, case_id)
  );

DROP POLICY IF EXISTS import_fx_case_attachments_delete ON public.import_fx_case_attachments;
CREATE POLICY import_fx_case_attachments_delete
  ON public.import_fx_case_attachments
  FOR DELETE
  TO authenticated
  USING (
    public._import_fx_case_attachment_mutation_ok(company_id, case_id)
  );

-- ---------------------------------------------------------------------------
-- C) Revoke direct client table access (W1: no attach RPC; read via get RPC)
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.import_fx_case_attachments FROM PUBLIC;
REVOKE ALL ON TABLE public.import_fx_case_attachments FROM anon;
REVOKE ALL ON TABLE public.import_fx_case_attachments FROM authenticated;
-- Do not grant service_role unless a reviewed convention requires it (none for W1).

COMMENT ON TABLE public.import_fx_case_attachments IS
  'W1 attachment metadata. Direct client table privileges revoked; read via get_import_fx_case (omits storage_path). RLS derives access from parent case + branch. Mutations require Multi Currency ON if privileges are ever re-granted.';
