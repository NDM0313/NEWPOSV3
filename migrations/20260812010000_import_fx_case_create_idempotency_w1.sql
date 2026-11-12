-- W1 successor: create_import_fx_case client_operation_id idempotency.
-- Additive only. Does not edit 20260811230000. No journals/payments.
-- Requires: import_fx_cases from 20260811230000 + _company_import_fx_enabled.

ALTER TABLE public.import_fx_cases
  ADD COLUMN IF NOT EXISTS client_operation_id uuid NULL;

COMMENT ON COLUMN public.import_fx_cases.client_operation_id IS
  'W1 create-case idempotency key. UNIQUE per company when set; null allowed for legacy rows.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_fx_cases_company_client_operation
  ON public.import_fx_cases (company_id, client_operation_id)
  WHERE client_operation_id IS NOT NULL;

-- Replace create RPC with optional p_client_operation_id (same name; last arg with DEFAULT
-- keeps prior call shapes working for clients that omit the new arg only if we append it).
DROP FUNCTION IF EXISTS public.create_import_fx_case(
  uuid, uuid, text, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid
);

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
  v_auth_company uuid;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_COMPANY_REQUIRED';
  END IF;

  -- Prefer session company when available; reject cross-company spoofing.
  BEGIN
    v_auth_company := public.get_user_company_id();
  EXCEPTION
    WHEN undefined_function THEN
      v_auth_company := NULL;
    WHEN OTHERS THEN
      v_auth_company := NULL;
  END;

  IF v_auth_company IS NOT NULL AND v_auth_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_COMPANY_MISMATCH';
  END IF;

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
      -- Concurrent retry with same client_operation_id
      IF p_client_operation_id IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.import_fx_cases
        WHERE company_id = p_company_id
          AND client_operation_id = p_client_operation_id
        LIMIT 1;
        IF FOUND THEN
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
  'W1 create Import FX Case + seed stages. Optional p_client_operation_id for idempotent retry. No journal.';

GRANT EXECUTE ON FUNCTION public.create_import_fx_case(
  uuid, uuid, text, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, uuid
) TO authenticated;
