-- W1 successor: RPC-only lockdown for Import FX case shell tables + internal helpers.
-- Additive. Closes direct-table bypass of fail-closed RPCs (company/branch/MC gates).
-- Does not require QA harness. No journals/payments. No W2+.

-- ---------------------------------------------------------------------------
-- A) Internal helpers must not be client-executable (default PUBLIC EXECUTE)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._import_fx_case_seed_stages(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_case_derive_operational_status(uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- B) Revoke direct client table privileges (UI uses importFxCaseService RPCs only)
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.import_fx_cases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.import_fx_case_stages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.import_fx_case_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.import_fx_case_links FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- C) Defense-in-depth RLS: parent branch + MC ON for writes (if privileges restored)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS import_fx_cases_company ON public.import_fx_cases;
DROP POLICY IF EXISTS import_fx_cases_select ON public.import_fx_cases;
DROP POLICY IF EXISTS import_fx_cases_insert ON public.import_fx_cases;
DROP POLICY IF EXISTS import_fx_cases_update ON public.import_fx_cases;
DROP POLICY IF EXISTS import_fx_cases_delete ON public.import_fx_cases;
CREATE POLICY import_fx_cases_select ON public.import_fx_cases
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public._import_fx_case_branch_row_allowed(branch_id)
  );
CREATE POLICY import_fx_cases_insert ON public.import_fx_cases
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public._company_import_fx_enabled(company_id)
    AND (
      branch_id IS NULL
      OR public._import_fx_case_caller_is_company_wide()
      OR public.has_branch_access(branch_id)
    )
  );
CREATE POLICY import_fx_cases_update ON public.import_fx_cases
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public._import_fx_case_branch_row_allowed(branch_id)
    AND public._company_import_fx_enabled(company_id)
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public._import_fx_case_branch_row_allowed(branch_id)
    AND public._company_import_fx_enabled(company_id)
  );
CREATE POLICY import_fx_cases_delete ON public.import_fx_cases
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public._import_fx_case_branch_row_allowed(branch_id)
    AND public._company_import_fx_enabled(company_id)
  );

DROP POLICY IF EXISTS import_fx_case_stages_company ON public.import_fx_case_stages;
DROP POLICY IF EXISTS import_fx_case_stages_select ON public.import_fx_case_stages;
DROP POLICY IF EXISTS import_fx_case_stages_write ON public.import_fx_case_stages;
CREATE POLICY import_fx_case_stages_select ON public.import_fx_case_stages
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.import_fx_cases c
      WHERE c.id = import_fx_case_stages.case_id
        AND c.company_id = import_fx_case_stages.company_id
        AND public._import_fx_case_branch_row_allowed(c.branch_id)
    )
  );
CREATE POLICY import_fx_case_stages_write ON public.import_fx_case_stages
  FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public._company_import_fx_enabled(company_id)
    AND EXISTS (
      SELECT 1 FROM public.import_fx_cases c
      WHERE c.id = import_fx_case_stages.case_id
        AND c.company_id = import_fx_case_stages.company_id
        AND public._import_fx_case_branch_row_allowed(c.branch_id)
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public._company_import_fx_enabled(company_id)
    AND EXISTS (
      SELECT 1 FROM public.import_fx_cases c
      WHERE c.id = import_fx_case_stages.case_id
        AND c.company_id = import_fx_case_stages.company_id
        AND public._import_fx_case_branch_row_allowed(c.branch_id)
    )
  );

DROP POLICY IF EXISTS import_fx_case_events_company ON public.import_fx_case_events;
DROP POLICY IF EXISTS import_fx_case_events_select ON public.import_fx_case_events;
DROP POLICY IF EXISTS import_fx_case_events_write ON public.import_fx_case_events;
CREATE POLICY import_fx_case_events_select ON public.import_fx_case_events
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.import_fx_cases c
      WHERE c.id = import_fx_case_events.case_id
        AND c.company_id = import_fx_case_events.company_id
        AND public._import_fx_case_branch_row_allowed(c.branch_id)
    )
  );
CREATE POLICY import_fx_case_events_write ON public.import_fx_case_events
  FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public._company_import_fx_enabled(company_id)
    AND EXISTS (
      SELECT 1 FROM public.import_fx_cases c
      WHERE c.id = import_fx_case_events.case_id
        AND c.company_id = import_fx_case_events.company_id
        AND public._import_fx_case_branch_row_allowed(c.branch_id)
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public._company_import_fx_enabled(company_id)
    AND EXISTS (
      SELECT 1 FROM public.import_fx_cases c
      WHERE c.id = import_fx_case_events.case_id
        AND c.company_id = import_fx_case_events.company_id
        AND public._import_fx_case_branch_row_allowed(c.branch_id)
    )
  );

DROP POLICY IF EXISTS import_fx_case_links_company ON public.import_fx_case_links;
DROP POLICY IF EXISTS import_fx_case_links_select ON public.import_fx_case_links;
DROP POLICY IF EXISTS import_fx_case_links_write ON public.import_fx_case_links;
CREATE POLICY import_fx_case_links_select ON public.import_fx_case_links
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.import_fx_cases c
      WHERE c.id = import_fx_case_links.case_id
        AND c.company_id = import_fx_case_links.company_id
        AND public._import_fx_case_branch_row_allowed(c.branch_id)
    )
  );
CREATE POLICY import_fx_case_links_write ON public.import_fx_case_links
  FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public._company_import_fx_enabled(company_id)
    AND EXISTS (
      SELECT 1 FROM public.import_fx_cases c
      WHERE c.id = import_fx_case_links.case_id
        AND c.company_id = import_fx_case_links.company_id
        AND public._import_fx_case_branch_row_allowed(c.branch_id)
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public._company_import_fx_enabled(company_id)
    AND EXISTS (
      SELECT 1 FROM public.import_fx_cases c
      WHERE c.id = import_fx_case_links.case_id
        AND c.company_id = import_fx_case_links.company_id
        AND public._import_fx_case_branch_row_allowed(c.branch_id)
    )
  );

-- RLS policies call SECURITY DEFINER helpers as invoker for EXECUTE privilege.
-- Keep helpers non-executable by clients; table privileges stay revoked so policies
-- are defense-in-depth only. SECURITY DEFINER RPCs (owner) bypass RLS.

COMMENT ON TABLE public.import_fx_cases IS
  'W1 Import FX Case header. Client table privileges revoked; use SECURITY DEFINER RPCs. Defense-in-depth RLS ties rows to company + branch + MC for writes.';

-- ---------------------------------------------------------------------------
-- D) link_import_fx_case_target — verify linked PURCHASE / FX credit company+branch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_import_fx_case_target(
  p_company_id uuid,
  p_case_id uuid,
  p_link_type text,
  p_link_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_type text;
  v_id uuid;
  v_case public.import_fx_cases%ROWTYPE;
  v_link_branch uuid;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);

  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: Import FX Case requires Multi Currency Enabled';
  END IF;

  SELECT * INTO v_case
  FROM public.import_fx_cases
  WHERE id = p_case_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_FOUND';
  END IF;

  IF NOT public._import_fx_case_branch_row_allowed(v_case.branch_id) THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED';
  END IF;

  v_type := upper(trim(COALESCE(p_link_type, '')));
  IF v_type NOT IN ('PURCHASE', 'SUPPLIER', 'FX_CURRENCY_PURCHASE', 'CONTACT') THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_INVALID_LINK_TYPE: %', v_type;
  END IF;

  IF p_link_id IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_LINK_ID_REQUIRED';
  END IF;

  IF v_type = 'PURCHASE' THEN
    SELECT p.branch_id INTO v_link_branch
    FROM public.purchases p
    WHERE p.id = p_link_id AND p.company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_LINK_TARGET_NOT_FOUND';
    END IF;
    IF NOT public._import_fx_case_branch_row_allowed(v_link_branch) THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED';
    END IF;
  ELSIF v_type = 'FX_CURRENCY_PURCHASE' THEN
    SELECT fcp.branch_id INTO v_link_branch
    FROM public.fx_currency_purchases fcp
    WHERE fcp.id = p_link_id AND fcp.company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_LINK_TARGET_NOT_FOUND';
    END IF;
    IF NOT public._import_fx_case_branch_row_allowed(v_link_branch) THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED';
    END IF;
  ELSIF v_type IN ('SUPPLIER', 'CONTACT') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contacts ct
      WHERE ct.id = p_link_id AND ct.company_id = p_company_id
    ) THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_LINK_TARGET_NOT_FOUND';
    END IF;
  END IF;

  INSERT INTO public.import_fx_case_links (company_id, case_id, link_type, link_id, notes)
  VALUES (p_company_id, p_case_id, v_type, p_link_id, p_notes)
  ON CONFLICT (case_id, link_type, link_id) DO UPDATE
    SET notes = COALESCE(EXCLUDED.notes, public.import_fx_case_links.notes)
  RETURNING id INTO v_id;

  IF v_type = 'FX_CURRENCY_PURCHASE' THEN
    UPDATE public.fx_currency_purchases
    SET import_fx_case_id = p_case_id
    WHERE id = p_link_id AND company_id = p_company_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'link_id', v_id, 'posts_journal', false);
END;
$$;

REVOKE ALL ON FUNCTION public.link_import_fx_case_target(uuid, uuid, text, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_import_fx_case_target(uuid, uuid, text, uuid, text)
  TO authenticated;
