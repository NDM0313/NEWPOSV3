-- W1 successor: mutation security parity with fail-closed read helpers.
-- Additive only. Does not edit 20260812010000 / 20260812020000.
-- Patches create/update/confirm/cancel/link. No attachment mutation RPCs exist.
-- Preserves create idempotency, MULTI_CURRENCY_DISABLED, posts_journal=false.
-- Reuses _import_fx_case_assert_company_access / assert_branch_param / branch_row_allowed.

-- ---------------------------------------------------------------------------
-- A) create_import_fx_case — fail-closed company + branch; keep idempotency
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_import_fx_case(
  p_company_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_arrangement_type text DEFAULT 'POOLED_USD_CNY',
  p_agent_contact_id uuid DEFAULT NULL,
  p_third_party_contact_id uuid DEFAULT NULL,
  p_planned_source_currency text DEFAULT NULL,
  p_planned_usd_amount numeric DEFAULT NULL,
  p_expected_pkr_per_usd numeric DEFAULT NULL,
  p_expected_cny_per_usd numeric DEFAULT NULL,
  p_expected_cny_amount numeric DEFAULT NULL,
  p_expected_fees_pkr numeric DEFAULT NULL,
  p_expected_completion_date date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_client_operation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case_id uuid;
  v_case_no text;
  v_arr text;
  v_currency text;
  v_existing public.import_fx_cases%ROWTYPE;
BEGIN
  -- Fail-closed company (NULL session company / mismatch / resolver errors reject).
  PERFORM public._import_fx_case_assert_company_access(p_company_id);

  -- Non-NULL branch requires access (or company-wide role).
  -- NULL branch: canonical commission/payments INSERT policy allows company-scoped
  -- NULL-branch rows for any authenticated company member (not company-wide-only).
  PERFORM public._import_fx_case_assert_branch_param(p_branch_id);

  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: Import FX Case requires Multi Currency Enabled';
  END IF;

  IF p_client_operation_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.import_fx_cases
    WHERE company_id = p_company_id
      AND client_operation_id = p_client_operation_id
    LIMIT 1;

    IF FOUND THEN
      IF NOT public._import_fx_case_branch_row_allowed(v_existing.branch_id) THEN
        RAISE EXCEPTION 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED';
      END IF;
      RETURN jsonb_build_object(
        'ok', true,
        'case_id', v_existing.id,
        'case_no', v_existing.case_no,
        'operational_status', v_existing.operational_status,
        'accounting_status', v_existing.accounting_status,
        'posts_journal', false,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  v_arr := upper(trim(COALESCE(p_arrangement_type, 'POOLED_USD_CNY')));
  IF v_arr NOT IN ('PATH_21_AGENT_DUAL_CREDIT', 'POOLED_USD_CNY', 'AGENT_PREPAID') THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_INVALID_ARRANGEMENT: %', v_arr;
  END IF;

  v_currency := public._normalize_import_fx_currency(p_planned_source_currency);

  BEGIN
    v_case_no := public.generate_document_number(p_company_id, p_branch_id, 'IMPORT_FX_CASE', false);
  EXCEPTION
    WHEN OTHERS THEN
      v_case_no := 'IFXC-' || to_char(now(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  END;

  BEGIN
    INSERT INTO public.import_fx_cases (
      company_id, branch_id, case_no, arrangement_type, operational_status, accounting_status,
      agent_contact_id, third_party_contact_id,
      planned_source_currency, planned_usd_amount, expected_pkr_per_usd, expected_cny_per_usd,
      expected_cny_amount, expected_fees_pkr, expected_completion_date, notes,
      created_by, updated_by, client_operation_id
    )
    VALUES (
      p_company_id, p_branch_id, v_case_no, v_arr, 'DRAFT', 'NOT_POSTED',
      p_agent_contact_id, p_third_party_contact_id,
      NULLIF(v_currency, ''), p_planned_usd_amount, p_expected_pkr_per_usd, p_expected_cny_per_usd,
      p_expected_cny_amount, p_expected_fees_pkr, p_expected_completion_date, p_notes,
      p_created_by, p_created_by, p_client_operation_id
    )
    RETURNING id INTO v_case_id;
  EXCEPTION
    WHEN unique_violation THEN
      IF p_client_operation_id IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.import_fx_cases
        WHERE company_id = p_company_id
          AND client_operation_id = p_client_operation_id
        LIMIT 1;
        IF FOUND THEN
          IF NOT public._import_fx_case_branch_row_allowed(v_existing.branch_id) THEN
            RAISE EXCEPTION 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED';
          END IF;
          RETURN jsonb_build_object(
            'ok', true,
            'case_id', v_existing.id,
            'case_no', v_existing.case_no,
            'operational_status', v_existing.operational_status,
            'accounting_status', v_existing.accounting_status,
            'posts_journal', false,
            'idempotent_replay', true
          );
        END IF;
      END IF;
      RAISE;
  END;

  PERFORM public._import_fx_case_seed_stages(p_company_id, v_case_id);

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, stage_id, event_type, event_status, posts_journal, payload, notes, created_by,
    client_operation_id
  )
  SELECT
    p_company_id,
    v_case_id,
    s.id,
    'CASE_CREATED',
    'RECORDED',
    false,
    jsonb_build_object(
      'arrangement_type', v_arr,
      'case_no', v_case_no,
      'client_operation_id', p_client_operation_id
    ),
    p_notes,
    p_created_by,
    p_client_operation_id
  FROM public.import_fx_case_stages s
  WHERE s.case_id = v_case_id AND s.stage_code = 'ARRANGEMENT'
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'case_id', v_case_id,
    'case_no', v_case_no,
    'operational_status', 'DRAFT',
    'accounting_status', 'NOT_POSTED',
    'posts_journal', false,
    'idempotent_replay', false
  );
END;
$$;

COMMENT ON FUNCTION public.create_import_fx_case(
  uuid, uuid, text, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, uuid
) IS
  'W1 create Import FX Case. Fail-closed company+branch auth. Idempotent client_operation_id. No journal.';

-- ---------------------------------------------------------------------------
-- B) update_import_fx_case_draft
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_import_fx_case_draft(
  p_company_id uuid,
  p_case_id uuid,
  p_agent_contact_id uuid DEFAULT NULL,
  p_third_party_contact_id uuid DEFAULT NULL,
  p_planned_source_currency text DEFAULT NULL,
  p_planned_usd_amount numeric DEFAULT NULL,
  p_expected_pkr_per_usd numeric DEFAULT NULL,
  p_expected_cny_per_usd numeric DEFAULT NULL,
  p_expected_cny_amount numeric DEFAULT NULL,
  p_expected_fees_pkr numeric DEFAULT NULL,
  p_expected_completion_date date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_updated_by uuid DEFAULT NULL,
  p_clear_agent boolean DEFAULT false,
  p_clear_third_party boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case public.import_fx_cases%ROWTYPE;
  v_currency text;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);

  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: Import FX Case requires Multi Currency Enabled';
  END IF;

  SELECT * INTO v_case
  FROM public.import_fx_cases
  WHERE id = p_case_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_FOUND';
  END IF;

  IF NOT public._import_fx_case_branch_row_allowed(v_case.branch_id) THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED';
  END IF;

  IF v_case.operational_status IN ('CANCELLED', 'REVERSED', 'COMPLETED') THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_EDITABLE: %', v_case.operational_status;
  END IF;

  IF v_case.accounting_status NOT IN ('NOT_POSTED') THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_DRAFT_LOCKED_AFTER_POSTING';
  END IF;

  v_currency := public._normalize_import_fx_currency(p_planned_source_currency);

  UPDATE public.import_fx_cases SET
    agent_contact_id = CASE
      WHEN p_clear_agent THEN NULL
      WHEN p_agent_contact_id IS NOT NULL THEN p_agent_contact_id
      ELSE agent_contact_id
    END,
    third_party_contact_id = CASE
      WHEN p_clear_third_party THEN NULL
      WHEN p_third_party_contact_id IS NOT NULL THEN p_third_party_contact_id
      ELSE third_party_contact_id
    END,
    planned_source_currency = COALESCE(NULLIF(v_currency, ''), planned_source_currency),
    planned_usd_amount = COALESCE(p_planned_usd_amount, planned_usd_amount),
    expected_pkr_per_usd = COALESCE(p_expected_pkr_per_usd, expected_pkr_per_usd),
    expected_cny_per_usd = COALESCE(p_expected_cny_per_usd, expected_cny_per_usd),
    expected_cny_amount = COALESCE(p_expected_cny_amount, expected_cny_amount),
    expected_fees_pkr = COALESCE(p_expected_fees_pkr, expected_fees_pkr),
    expected_completion_date = COALESCE(p_expected_completion_date, expected_completion_date),
    notes = COALESCE(p_notes, notes),
    updated_by = p_updated_by,
    updated_at = now()
  WHERE id = p_case_id;

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, event_type, event_status, posts_journal, payload, created_by
  ) VALUES (
    p_company_id, p_case_id, 'DRAFT_SAVED', 'RECORDED', false,
    jsonb_build_object('saved_at', now()), p_updated_by
  );

  RETURN jsonb_build_object('ok', true, 'case_id', p_case_id, 'posts_journal', false);
END;
$$;

COMMENT ON FUNCTION public.update_import_fx_case_draft(
  uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, boolean, boolean
) IS
  'W1 update draft. Fail-closed company+branch auth. No journal.';

-- ---------------------------------------------------------------------------
-- C) confirm_import_fx_case_stage
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_import_fx_case_stage(
  p_company_id uuid,
  p_case_id uuid,
  p_stage_code text,
  p_notes text DEFAULT NULL,
  p_mark_awaiting_confirmation boolean DEFAULT false,
  p_created_by uuid DEFAULT NULL,
  p_client_operation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case public.import_fx_cases%ROWTYPE;
  v_stage public.import_fx_case_stages%ROWTYPE;
  v_new_status text;
  v_op text;
  v_event_id uuid;
  v_code text;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);

  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: Import FX Case requires Multi Currency Enabled';
  END IF;

  v_code := upper(trim(COALESCE(p_stage_code, '')));

  IF v_code <> 'ARRANGEMENT' THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_STAGE_W1_PLANNING_ONLY: Money stage % blocked until later wave', v_code;
  END IF;

  SELECT * INTO v_case
  FROM public.import_fx_cases
  WHERE id = p_case_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_FOUND';
  END IF;

  IF NOT public._import_fx_case_branch_row_allowed(v_case.branch_id) THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED';
  END IF;

  IF v_case.operational_status IN ('CANCELLED', 'REVERSED') THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_EDITABLE: %', v_case.operational_status;
  END IF;

  SELECT * INTO v_stage
  FROM public.import_fx_case_stages
  WHERE case_id = p_case_id AND stage_code = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_STAGE_NOT_FOUND: %', v_code;
  END IF;

  IF v_stage.stage_status = 'COMPLETED' AND NOT p_mark_awaiting_confirmation THEN
    RETURN jsonb_build_object(
      'ok', true,
      'case_id', p_case_id,
      'stage_code', v_code,
      'stage_status', v_stage.stage_status,
      'operational_status', v_case.operational_status,
      'posts_journal', false,
      'idempotent_replay', true
    );
  END IF;

  IF p_client_operation_id IS NOT NULL THEN
    SELECT id INTO v_event_id
    FROM public.import_fx_case_events
    WHERE company_id = p_company_id
      AND event_type = 'STAGE_CONFIRM_' || v_code
      AND client_operation_id = p_client_operation_id
    LIMIT 1;
    IF v_event_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'case_id', p_case_id,
        'event_id', v_event_id,
        'stage_code', v_code,
        'posts_journal', false,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  v_new_status := CASE
    WHEN p_mark_awaiting_confirmation THEN 'AWAITING_CONFIRMATION'
    ELSE 'COMPLETED'
  END;

  UPDATE public.import_fx_case_stages SET
    stage_status = v_new_status,
    completed_at = CASE WHEN v_new_status = 'COMPLETED' THEN now() ELSE completed_at END,
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = v_stage.id;

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, stage_id, event_type, event_status, posts_journal,
    payload, notes, client_operation_id, created_by
  )
  VALUES (
    p_company_id, p_case_id, v_stage.id,
    'STAGE_CONFIRM_' || v_code,
    CASE WHEN p_mark_awaiting_confirmation THEN 'AWAITING_CONFIRMATION' ELSE 'CONFIRMED' END,
    false,
    jsonb_build_object('stage_code', v_code, 'stage_status', v_new_status),
    p_notes,
    p_client_operation_id,
    p_created_by
  )
  RETURNING id INTO v_event_id;

  v_op := public._import_fx_case_derive_operational_status(p_case_id);
  IF v_new_status = 'COMPLETED' AND v_code = 'ARRANGEMENT' THEN
    v_op := 'ARRANGED';
  END IF;

  UPDATE public.import_fx_cases SET
    operational_status = v_op,
    updated_by = p_created_by,
    updated_at = now()
  WHERE id = p_case_id;

  RETURN jsonb_build_object(
    'ok', true,
    'case_id', p_case_id,
    'event_id', v_event_id,
    'stage_code', v_code,
    'stage_status', v_new_status,
    'operational_status', v_op,
    'accounting_status', 'NOT_POSTED',
    'posts_journal', false
  );
END;
$$;

COMMENT ON FUNCTION public.confirm_import_fx_case_stage(
  uuid, uuid, text, text, boolean, uuid, uuid
) IS
  'W1 confirm ARRANGEMENT only. Fail-closed company+branch auth. Never posts a journal.';

-- ---------------------------------------------------------------------------
-- D) cancel_import_fx_case_unposted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_import_fx_case_unposted(
  p_company_id uuid,
  p_case_id uuid,
  p_notes text DEFAULT NULL,
  p_updated_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case public.import_fx_cases%ROWTYPE;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);

  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: Import FX Case requires Multi Currency Enabled';
  END IF;

  SELECT * INTO v_case
  FROM public.import_fx_cases
  WHERE id = p_case_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_FOUND';
  END IF;

  IF NOT public._import_fx_case_branch_row_allowed(v_case.branch_id) THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED';
  END IF;

  IF v_case.accounting_status <> 'NOT_POSTED' THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_CANCEL_REQUIRES_REVERSAL: accounting already posted';
  END IF;

  IF v_case.operational_status = 'CANCELLED' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'case_id', p_case_id,
      'operational_status', 'CANCELLED',
      'idempotent_replay', true,
      'posts_journal', false
    );
  END IF;

  UPDATE public.import_fx_cases SET
    operational_status = 'CANCELLED',
    notes = COALESCE(p_notes, notes),
    updated_by = p_updated_by,
    updated_at = now()
  WHERE id = p_case_id;

  UPDATE public.import_fx_case_stages SET
    stage_status = CASE
      WHEN stage_status IN ('COMPLETED', 'REVERSED') THEN stage_status
      ELSE 'CANCELLED'
    END,
    updated_at = now()
  WHERE case_id = p_case_id
    AND stage_status NOT IN ('COMPLETED', 'REVERSED', 'CANCELLED');

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, event_type, event_status, posts_journal, payload, notes, created_by
  ) VALUES (
    p_company_id, p_case_id, 'CASE_CANCELLED', 'CANCELLED', false,
    jsonb_build_object('cancelled_at', now()), p_notes, p_updated_by
  );

  RETURN jsonb_build_object(
    'ok', true,
    'case_id', p_case_id,
    'operational_status', 'CANCELLED',
    'posts_journal', false
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_import_fx_case_unposted(uuid, uuid, text, uuid) IS
  'W1 cancel unposted case. Fail-closed company+branch auth. No journal.';

-- ---------------------------------------------------------------------------
-- E) link_import_fx_case_target
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

COMMENT ON FUNCTION public.link_import_fx_case_target(uuid, uuid, text, uuid, text) IS
  'W1 link purchase/supplier/credit. Fail-closed company+branch auth. No journal.';

-- ---------------------------------------------------------------------------
-- F) Privileges — revoke PUBLIC/anon; grant authenticated only
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_import_fx_case(
  uuid, uuid, text, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_import_fx_case_draft(
  uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, boolean, boolean
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_import_fx_case_stage(
  uuid, uuid, text, text, boolean, uuid, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_import_fx_case_unposted(uuid, uuid, text, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_import_fx_case_target(uuid, uuid, text, uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_import_fx_case(
  uuid, uuid, text, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_import_fx_case_draft(
  uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, boolean, boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_import_fx_case_stage(
  uuid, uuid, text, text, boolean, uuid, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_import_fx_case_unposted(uuid, uuid, text, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_import_fx_case_target(uuid, uuid, text, uuid, text)
  TO authenticated;

-- Helpers remain non-executable by clients (reaffirm).
REVOKE ALL ON FUNCTION public._import_fx_case_assert_company_access(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_case_assert_branch_param(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_case_branch_row_allowed(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_case_caller_is_company_wide()
  FROM PUBLIC, anon, authenticated;
