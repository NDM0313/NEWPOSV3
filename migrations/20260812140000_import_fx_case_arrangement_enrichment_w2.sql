-- Wave W2a: Import FX Case ARRANGEMENT enrichment (non-posting).
-- Additive only. Does not edit applied W1 migrations.
-- Money stages ADVANCE..RECONCILIATION remain non-confirmable.
-- posts_journal always false. Path 21 unchanged. No COA / JE / payment writes.
-- Requires: W1 case shell + security helpers (20260811230000 … 20260812050000).

-- ---------------------------------------------------------------------------
-- A) Additive planning columns on import_fx_cases
-- ---------------------------------------------------------------------------
ALTER TABLE public.import_fx_cases
  ADD COLUMN IF NOT EXISTS funding_mode text NULL,
  ADD COLUMN IF NOT EXISTS planned_settlement_currency text NULL,
  ADD COLUMN IF NOT EXISTS agent_reference text NULL,
  ADD COLUMN IF NOT EXISTS expected_arrangement_date date NULL,
  ADD COLUMN IF NOT EXISTS expected_advance_date date NULL,
  ADD COLUMN IF NOT EXISTS expected_usd_acquisition_date date NULL,
  ADD COLUMN IF NOT EXISTS expected_advance_amount_pkr numeric(24, 2) NULL,
  ADD COLUMN IF NOT EXISTS arrangement_confirmed_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'import_fx_cases_funding_mode_check'
      AND conrelid = 'public.import_fx_cases'::regclass
  ) THEN
    ALTER TABLE public.import_fx_cases
      ADD CONSTRAINT import_fx_cases_funding_mode_check
      CHECK (funding_mode IS NULL OR funding_mode IN ('ADVANCE', 'CREDIT', 'MIXED'));
  END IF;
END $$;

COMMENT ON COLUMN public.import_fx_cases.funding_mode IS
  'W2 planning intention only: ADVANCE/CREDIT/MIXED. Not a posted advance or AP movement.';
COMMENT ON COLUMN public.import_fx_cases.planned_settlement_currency IS
  'W2 expected settlement currency (RMB normalized to CNY). Planning metadata only.';
COMMENT ON COLUMN public.import_fx_cases.agent_reference IS
  'W2 external agent/quote reference. Planning metadata only.';
COMMENT ON COLUMN public.import_fx_cases.expected_arrangement_date IS
  'W2 expected arrangement agreement date. Not financial completion.';
COMMENT ON COLUMN public.import_fx_cases.expected_advance_date IS
  'W2 expected advance date (intention). Does NOT mean advance was paid.';
COMMENT ON COLUMN public.import_fx_cases.expected_usd_acquisition_date IS
  'W2 expected USD acquisition date (intention). Does NOT mean USD was purchased.';
COMMENT ON COLUMN public.import_fx_cases.expected_advance_amount_pkr IS
  'W2 planned advance amount in PKR (intention). Does NOT create payment or Agent Advance GL.';
COMMENT ON COLUMN public.import_fx_cases.arrangement_confirmed_at IS
  'W2 set when ARRANGEMENT stage reaches COMPLETED. Still posts_journal=false.';

COMMENT ON TABLE public.import_fx_cases IS
  'Import FX Case header. W1 shell + W2 ARRANGEMENT enrichment. Money execution is W3+. Client table privileges revoked; use SECURITY DEFINER RPCs.';

-- Attachment metadata flag (RPC in 20260812140100). Safe even before metadata RPC ships.
ALTER TABLE public.import_fx_case_attachments
  ADD COLUMN IF NOT EXISTS is_metadata_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.import_fx_case_attachments.is_metadata_only IS
  'W2: true = metadata/reference only; no binary upload. storage_path must not be exposed to clients.';

-- ---------------------------------------------------------------------------
-- B) Internal helpers (not client-executable)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._import_fx_w2_normalize_funding_mode(p_mode text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(upper(trim(COALESCE(p_mode, ''))), '');
$$;

CREATE OR REPLACE FUNCTION public._import_fx_w2_assert_planning_amounts(
  p_planned_usd_amount numeric,
  p_expected_pkr_per_usd numeric,
  p_expected_cny_per_usd numeric,
  p_expected_cny_amount numeric,
  p_expected_fees_pkr numeric,
  p_expected_advance_amount_pkr numeric
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_planned_usd_amount IS NOT NULL AND p_planned_usd_amount < 0 THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NEGATIVE_AMOUNT: planned_usd_amount';
  END IF;
  IF p_expected_pkr_per_usd IS NOT NULL AND p_expected_pkr_per_usd < 0 THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NEGATIVE_AMOUNT: expected_pkr_per_usd';
  END IF;
  IF p_expected_cny_per_usd IS NOT NULL AND p_expected_cny_per_usd < 0 THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NEGATIVE_AMOUNT: expected_cny_per_usd';
  END IF;
  IF p_expected_cny_amount IS NOT NULL AND p_expected_cny_amount < 0 THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NEGATIVE_AMOUNT: expected_cny_amount';
  END IF;
  IF p_expected_fees_pkr IS NOT NULL AND p_expected_fees_pkr < 0 THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NEGATIVE_AMOUNT: expected_fees_pkr';
  END IF;
  IF p_expected_advance_amount_pkr IS NOT NULL AND p_expected_advance_amount_pkr < 0 THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NEGATIVE_AMOUNT: expected_advance_amount_pkr';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._import_fx_w2_assert_party_contacts(
  p_company_id uuid,
  p_agent_contact_id uuid,
  p_third_party_contact_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent_type text;
  v_tp_company uuid;
BEGIN
  IF p_agent_contact_id IS NOT NULL THEN
    SELECT lower(trim(COALESCE(c.type::text, ''))), c.company_id
    INTO v_agent_type, v_tp_company
    FROM public.contacts c
    WHERE c.id = p_agent_contact_id;

    IF NOT FOUND OR v_tp_company IS DISTINCT FROM p_company_id THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_AGENT_NOT_FOUND';
    END IF;
    IF v_agent_type <> 'money_exchange' THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_AGENT_ROLE_REQUIRED: agent must be money_exchange';
    END IF;
  END IF;

  IF p_third_party_contact_id IS NOT NULL THEN
    SELECT c.company_id INTO v_tp_company
    FROM public.contacts c
    WHERE c.id = p_third_party_contact_id;

    IF NOT FOUND OR v_tp_company IS DISTINCT FROM p_company_id THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_THIRD_PARTY_NOT_FOUND';
    END IF;

    -- Approved W2 model: third party must be money_exchange (converter/custodian),
    -- not an ordinary supplier/customer without that role.
    IF NOT EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = p_third_party_contact_id
        AND c.company_id = p_company_id
        AND lower(trim(COALESCE(c.type::text, ''))) = 'money_exchange'
    ) THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_THIRD_PARTY_ROLE_REQUIRED: third party must be money_exchange';
    END IF;
  END IF;

  IF p_agent_contact_id IS NOT NULL
     AND p_third_party_contact_id IS NOT NULL
     AND p_agent_contact_id = p_third_party_contact_id THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_AGENT_THIRD_PARTY_SAME';
  END IF;
END;
$$;

COMMENT ON FUNCTION public._import_fx_w2_assert_party_contacts(uuid, uuid, uuid) IS
  'W2: agent and third party must be company money_exchange contacts and distinct.';

REVOKE ALL ON FUNCTION public._import_fx_w2_normalize_funding_mode(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_w2_assert_planning_amounts(numeric, numeric, numeric, numeric, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_w2_assert_party_contacts(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- C) Drop prior create/update signatures (arg lists extended in W2)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_import_fx_case(
  uuid, uuid, text, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, uuid
);

DROP FUNCTION IF EXISTS public.update_import_fx_case_draft(
  uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, boolean, boolean
);

-- ---------------------------------------------------------------------------
-- D) create_import_fx_case (W2 enrichment args; idempotency preserved)
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
  p_client_operation_id uuid DEFAULT NULL,
  p_funding_mode text DEFAULT NULL,
  p_planned_settlement_currency text DEFAULT NULL,
  p_agent_reference text DEFAULT NULL,
  p_expected_arrangement_date date DEFAULT NULL,
  p_expected_advance_date date DEFAULT NULL,
  p_expected_usd_acquisition_date date DEFAULT NULL,
  p_expected_advance_amount_pkr numeric DEFAULT NULL
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
  v_settle text;
  v_funding text;
  v_existing public.import_fx_cases%ROWTYPE;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);
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

  v_funding := public._import_fx_w2_normalize_funding_mode(p_funding_mode);
  IF v_funding IS NOT NULL AND v_funding NOT IN ('ADVANCE', 'CREDIT', 'MIXED') THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_INVALID_FUNDING_MODE: %', v_funding;
  END IF;

  v_currency := public._normalize_import_fx_currency(p_planned_source_currency);
  IF v_currency <> '' AND NOT public._company_import_fx_currency_allowed(p_company_id, v_currency) THEN
    RAISE EXCEPTION 'IMPORT_FX_CURRENCY_NOT_ACTIVE: %', v_currency;
  END IF;

  v_settle := public._normalize_import_fx_currency(p_planned_settlement_currency);
  IF v_settle <> '' AND NOT public._company_import_fx_currency_allowed(p_company_id, v_settle) THEN
    RAISE EXCEPTION 'IMPORT_FX_CURRENCY_NOT_ACTIVE: %', v_settle;
  END IF;

  PERFORM public._import_fx_w2_assert_planning_amounts(
    p_planned_usd_amount, p_expected_pkr_per_usd, p_expected_cny_per_usd,
    p_expected_cny_amount, p_expected_fees_pkr, p_expected_advance_amount_pkr
  );
  PERFORM public._import_fx_w2_assert_party_contacts(
    p_company_id, p_agent_contact_id, p_third_party_contact_id
  );

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
      created_by, updated_by, client_operation_id,
      funding_mode, planned_settlement_currency, agent_reference,
      expected_arrangement_date, expected_advance_date, expected_usd_acquisition_date,
      expected_advance_amount_pkr
    )
    VALUES (
      p_company_id, p_branch_id, v_case_no, v_arr, 'DRAFT', 'NOT_POSTED',
      p_agent_contact_id, p_third_party_contact_id,
      NULLIF(v_currency, ''), p_planned_usd_amount, p_expected_pkr_per_usd, p_expected_cny_per_usd,
      p_expected_cny_amount, p_expected_fees_pkr, p_expected_completion_date, p_notes,
      p_created_by, p_created_by, p_client_operation_id,
      v_funding, NULLIF(v_settle, ''), NULLIF(trim(COALESCE(p_agent_reference, '')), ''),
      p_expected_arrangement_date, p_expected_advance_date, p_expected_usd_acquisition_date,
      p_expected_advance_amount_pkr
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
      'funding_mode', v_funding,
      'case_no', v_case_no,
      'client_operation_id', p_client_operation_id,
      'planning_only', true
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
  uuid, uuid, text, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, uuid,
  text, text, text, date, date, date, numeric
) IS
  'W2 create Import FX Case with ARRANGEMENT enrichment. Fail-closed auth. Idempotent. Never posts journal.';

-- ---------------------------------------------------------------------------
-- E) update_import_fx_case_draft (W2)
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
  p_clear_third_party boolean DEFAULT false,
  p_funding_mode text DEFAULT NULL,
  p_planned_settlement_currency text DEFAULT NULL,
  p_agent_reference text DEFAULT NULL,
  p_expected_arrangement_date date DEFAULT NULL,
  p_expected_advance_date date DEFAULT NULL,
  p_expected_usd_acquisition_date date DEFAULT NULL,
  p_expected_advance_amount_pkr numeric DEFAULT NULL,
  p_arrangement_type text DEFAULT NULL,
  p_clear_funding_mode boolean DEFAULT false,
  p_clear_settlement_currency boolean DEFAULT false,
  p_clear_agent_reference boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case public.import_fx_cases%ROWTYPE;
  v_currency text;
  v_settle text;
  v_funding text;
  v_arr text;
  v_agent uuid;
  v_third uuid;
  v_arr_stage_status text;
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

  SELECT s.stage_status INTO v_arr_stage_status
  FROM public.import_fx_case_stages s
  WHERE s.case_id = p_case_id AND s.stage_code = 'ARRANGEMENT'
  LIMIT 1;

  IF p_arrangement_type IS NOT NULL THEN
    IF v_case.operational_status <> 'DRAFT'
       OR COALESCE(v_arr_stage_status, '') = 'COMPLETED'
       OR v_case.arrangement_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_ARRANGEMENT_TYPE_LOCKED';
    END IF;
    v_arr := upper(trim(p_arrangement_type));
    IF v_arr NOT IN ('PATH_21_AGENT_DUAL_CREDIT', 'POOLED_USD_CNY', 'AGENT_PREPAID') THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_INVALID_ARRANGEMENT: %', v_arr;
    END IF;
  END IF;

  v_funding := public._import_fx_w2_normalize_funding_mode(p_funding_mode);
  IF v_funding IS NOT NULL AND v_funding NOT IN ('ADVANCE', 'CREDIT', 'MIXED') THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_INVALID_FUNDING_MODE: %', v_funding;
  END IF;

  v_currency := public._normalize_import_fx_currency(p_planned_source_currency);
  IF v_currency <> '' AND NOT public._company_import_fx_currency_allowed(p_company_id, v_currency) THEN
    RAISE EXCEPTION 'IMPORT_FX_CURRENCY_NOT_ACTIVE: %', v_currency;
  END IF;

  v_settle := public._normalize_import_fx_currency(p_planned_settlement_currency);
  IF v_settle <> '' AND NOT public._company_import_fx_currency_allowed(p_company_id, v_settle) THEN
    RAISE EXCEPTION 'IMPORT_FX_CURRENCY_NOT_ACTIVE: %', v_settle;
  END IF;

  PERFORM public._import_fx_w2_assert_planning_amounts(
    p_planned_usd_amount, p_expected_pkr_per_usd, p_expected_cny_per_usd,
    p_expected_cny_amount, p_expected_fees_pkr, p_expected_advance_amount_pkr
  );

  v_agent := CASE
    WHEN p_clear_agent THEN NULL
    WHEN p_agent_contact_id IS NOT NULL THEN p_agent_contact_id
    ELSE v_case.agent_contact_id
  END;
  v_third := CASE
    WHEN p_clear_third_party THEN NULL
    WHEN p_third_party_contact_id IS NOT NULL THEN p_third_party_contact_id
    ELSE v_case.third_party_contact_id
  END;
  PERFORM public._import_fx_w2_assert_party_contacts(p_company_id, v_agent, v_third);

  UPDATE public.import_fx_cases SET
    arrangement_type = COALESCE(v_arr, arrangement_type),
    agent_contact_id = v_agent,
    third_party_contact_id = v_third,
    planned_source_currency = COALESCE(NULLIF(v_currency, ''), planned_source_currency),
    planned_usd_amount = COALESCE(p_planned_usd_amount, planned_usd_amount),
    expected_pkr_per_usd = COALESCE(p_expected_pkr_per_usd, expected_pkr_per_usd),
    expected_cny_per_usd = COALESCE(p_expected_cny_per_usd, expected_cny_per_usd),
    expected_cny_amount = COALESCE(p_expected_cny_amount, expected_cny_amount),
    expected_fees_pkr = COALESCE(p_expected_fees_pkr, expected_fees_pkr),
    expected_completion_date = COALESCE(p_expected_completion_date, expected_completion_date),
    notes = COALESCE(p_notes, notes),
    funding_mode = CASE
      WHEN p_clear_funding_mode THEN NULL
      WHEN v_funding IS NOT NULL THEN v_funding
      ELSE funding_mode
    END,
    planned_settlement_currency = CASE
      WHEN p_clear_settlement_currency THEN NULL
      WHEN v_settle <> '' THEN v_settle
      ELSE planned_settlement_currency
    END,
    agent_reference = CASE
      WHEN p_clear_agent_reference THEN NULL
      WHEN p_agent_reference IS NOT NULL THEN NULLIF(trim(p_agent_reference), '')
      ELSE agent_reference
    END,
    expected_arrangement_date = COALESCE(p_expected_arrangement_date, expected_arrangement_date),
    expected_advance_date = COALESCE(p_expected_advance_date, expected_advance_date),
    expected_usd_acquisition_date = COALESCE(p_expected_usd_acquisition_date, expected_usd_acquisition_date),
    expected_advance_amount_pkr = COALESCE(p_expected_advance_amount_pkr, expected_advance_amount_pkr),
    updated_by = p_updated_by,
    updated_at = now()
  WHERE id = p_case_id;

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, event_type, event_status, posts_journal, payload, created_by
  ) VALUES (
    p_company_id, p_case_id, 'DRAFT_SAVED', 'RECORDED', false,
    jsonb_build_object('saved_at', now(), 'planning_only', true, 'wave', 'W2'),
    p_updated_by
  );

  RETURN jsonb_build_object('ok', true, 'case_id', p_case_id, 'posts_journal', false);
END;
$$;

COMMENT ON FUNCTION public.update_import_fx_case_draft(
  uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, boolean, boolean,
  text, text, text, date, date, date, numeric, text, boolean, boolean, boolean
) IS
  'W2 update ARRANGEMENT draft enrichment. Fail-closed auth. Never posts journal. Does not start money stages.';

-- ---------------------------------------------------------------------------
-- F) confirm_import_fx_case_stage — ARRANGEMENT only (W2 error code)
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

  -- W2: only ARRANGEMENT. Money stages blocked until W3+.
  -- Stable W2 code (supersedes W1 IMPORT_FX_CASE_STAGE_W1_PLANNING_ONLY for new clients).
  IF v_code <> 'ARRANGEMENT' THEN
    RAISE EXCEPTION
      'IMPORT_FX_CASE_STAGE_W2_ARRANGEMENT_ONLY: Stage % is not confirmable in W2; money execution begins in W3+',
      v_code;
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
      'arrangement_confirmed_at', v_case.arrangement_confirmed_at,
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
        'stage_status', v_stage.stage_status,
        'operational_status', v_case.operational_status,
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
    jsonb_build_object(
      'stage_code', v_code,
      'stage_status', v_new_status,
      'planning_only', true,
      'wave', 'W2'
    ),
    p_notes,
    p_client_operation_id,
    p_created_by
  )
  RETURNING id INTO v_event_id;

  -- Derive ARRANGED only. Do NOT mutate ADVANCE/USD stage rows from W2 expectations.
  v_op := v_case.operational_status;
  IF v_new_status = 'COMPLETED' THEN
    v_op := 'ARRANGED';
  END IF;

  UPDATE public.import_fx_cases SET
    operational_status = v_op,
    arrangement_confirmed_at = CASE
      WHEN v_new_status = 'COMPLETED' THEN COALESCE(arrangement_confirmed_at, now())
      ELSE arrangement_confirmed_at
    END,
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
    'posts_journal', false,
    'idempotent_replay', false
  );
END;
$$;

COMMENT ON FUNCTION public.confirm_import_fx_case_stage(
  uuid, uuid, text, text, boolean, uuid, uuid
) IS
  'W2 confirm ARRANGEMENT only. Raises IMPORT_FX_CASE_STAGE_W2_ARRANGEMENT_ONLY for money stages. Never posts journal.';

-- ---------------------------------------------------------------------------
-- G) list_import_fx_cases — project W2 columns; search agent_reference
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_import_fx_cases(
  p_company_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_operational_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows jsonb;
  v_total int;
  v_limit int := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_offset int := GREATEST(0, COALESCE(p_offset, 0));
  v_q text := NULLIF(trim(COALESCE(p_search, '')), '');
  v_ops_enabled boolean;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);
  PERFORM public._import_fx_case_assert_branch_param(p_branch_id);
  v_ops_enabled := public._company_import_fx_enabled(p_company_id);

  SELECT count(*)::int INTO v_total
  FROM public.import_fx_cases c
  WHERE c.company_id = p_company_id
    AND public._import_fx_case_branch_row_allowed(c.branch_id)
    AND (p_branch_id IS NULL OR c.branch_id = p_branch_id OR c.branch_id IS NULL)
    AND (p_operational_status IS NULL OR c.operational_status = p_operational_status)
    AND (
      v_q IS NULL
      OR c.case_no ILIKE '%' || v_q || '%'
      OR COALESCE(c.notes, '') ILIKE '%' || v_q || '%'
      OR COALESCE(c.agent_reference, '') ILIKE '%' || v_q || '%'
    );

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.updated_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      c.id,
      c.case_no,
      c.arrangement_type,
      c.operational_status,
      c.accounting_status,
      c.agent_contact_id,
      c.third_party_contact_id,
      c.planned_source_currency,
      c.planned_usd_amount,
      c.expected_pkr_per_usd,
      c.expected_cny_per_usd,
      c.expected_cny_amount,
      c.expected_fees_pkr,
      c.expected_completion_date,
      c.notes,
      c.branch_id,
      c.funding_mode,
      c.planned_settlement_currency,
      c.agent_reference,
      c.expected_arrangement_date,
      c.expected_advance_date,
      c.expected_usd_acquisition_date,
      c.expected_advance_amount_pkr,
      c.arrangement_confirmed_at,
      c.created_at,
      c.updated_at
    FROM public.import_fx_cases c
    WHERE c.company_id = p_company_id
      AND public._import_fx_case_branch_row_allowed(c.branch_id)
      AND (p_branch_id IS NULL OR c.branch_id = p_branch_id OR c.branch_id IS NULL)
      AND (p_operational_status IS NULL OR c.operational_status = p_operational_status)
      AND (
        v_q IS NULL
        OR c.case_no ILIKE '%' || v_q || '%'
        OR COALESCE(c.notes, '') ILIKE '%' || v_q || '%'
        OR COALESCE(c.agent_reference, '') ILIKE '%' || v_q || '%'
      )
    ORDER BY c.updated_at DESC
    LIMIT v_limit OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'rows', v_rows,
    'read_only', NOT v_ops_enabled,
    'multi_currency_enabled', v_ops_enabled,
    'posts_journal', false
  );
END;
$$;

COMMENT ON FUNCTION public.list_import_fx_cases(uuid, uuid, text, text, int, int) IS
  'W2 list Import FX cases (includes arrangement enrichment). Readable when MC OFF. Never posts journals.';

-- ---------------------------------------------------------------------------
-- H) get_import_fx_case — project W2 columns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_import_fx_case(
  p_company_id uuid,
  p_case_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case jsonb;
  v_case_branch uuid;
  v_stages jsonb;
  v_events jsonb;
  v_links jsonb;
  v_attachments jsonb;
  v_ops_enabled boolean;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);
  v_ops_enabled := public._company_import_fx_enabled(p_company_id);

  SELECT
    c.branch_id,
    jsonb_build_object(
      'id', c.id,
      'company_id', c.company_id,
      'branch_id', c.branch_id,
      'case_no', c.case_no,
      'arrangement_type', c.arrangement_type,
      'operational_status', c.operational_status,
      'accounting_status', c.accounting_status,
      'agent_contact_id', c.agent_contact_id,
      'third_party_contact_id', c.third_party_contact_id,
      'planned_source_currency', c.planned_source_currency,
      'planned_usd_amount', c.planned_usd_amount,
      'expected_pkr_per_usd', c.expected_pkr_per_usd,
      'expected_cny_per_usd', c.expected_cny_per_usd,
      'expected_cny_amount', c.expected_cny_amount,
      'expected_fees_pkr', c.expected_fees_pkr,
      'expected_completion_date', c.expected_completion_date,
      'notes', c.notes,
      'funding_mode', c.funding_mode,
      'planned_settlement_currency', c.planned_settlement_currency,
      'agent_reference', c.agent_reference,
      'expected_arrangement_date', c.expected_arrangement_date,
      'expected_advance_date', c.expected_advance_date,
      'expected_usd_acquisition_date', c.expected_usd_acquisition_date,
      'expected_advance_amount_pkr', c.expected_advance_amount_pkr,
      'arrangement_confirmed_at', c.arrangement_confirmed_at,
      'created_by', c.created_by,
      'updated_by', c.updated_by,
      'created_at', c.created_at,
      'updated_at', c.updated_at
    )
  INTO v_case_branch, v_case
  FROM public.import_fx_cases c
  WHERE c.id = p_case_id AND c.company_id = p_company_id;

  IF v_case IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_FOUND';
  END IF;

  IF NOT public._import_fx_case_branch_row_allowed(v_case_branch) THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.stage_order), '[]'::jsonb)
  INTO v_stages
  FROM (
    SELECT
      s.id, s.case_id, s.stage_code, s.stage_order, s.stage_status,
      s.expected_at, s.completed_at, s.notes, s.created_at, s.updated_at
    FROM public.import_fx_case_stages s
    WHERE s.case_id = p_case_id AND s.company_id = p_company_id
  ) s;

  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT
      e.id, e.case_id, e.stage_id, e.event_type, e.event_status, e.posts_journal,
      e.payload, e.notes, e.reversal_of_event_id, e.created_by, e.created_at
    FROM public.import_fx_case_events e
    WHERE e.case_id = p_case_id AND e.company_id = p_company_id
    ORDER BY e.created_at DESC
    LIMIT 100
  ) e;

  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.created_at), '[]'::jsonb)
  INTO v_links
  FROM (
    SELECT l.id, l.case_id, l.link_type, l.link_id, l.notes, l.created_at
    FROM public.import_fx_case_links l
    WHERE l.case_id = p_case_id AND l.company_id = p_company_id
  ) l;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_attachments
  FROM (
    SELECT
      a.id, a.case_id, a.event_id, a.stage_id, a.file_name, a.mime_type, a.file_size,
      COALESCE(a.is_metadata_only, false) AS is_metadata_only,
      a.created_by, a.created_at
      -- omit storage_path
    FROM public.import_fx_case_attachments a
    WHERE a.case_id = p_case_id AND a.company_id = p_company_id
  ) a;

  RETURN jsonb_build_object(
    'ok', true,
    'case', v_case,
    'stages', v_stages,
    'events', v_events,
    'links', v_links,
    'attachments', v_attachments,
    'read_only', NOT v_ops_enabled,
    'multi_currency_enabled', v_ops_enabled,
    'posts_journal', false
  );
END;
$$;

COMMENT ON FUNCTION public.get_import_fx_case(uuid, uuid) IS
  'W2 get Import FX case with arrangement enrichment. Omits storage_path/client_operation_id. Never posts journals.';

-- ---------------------------------------------------------------------------
-- I) Privileges
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_import_fx_case(
  uuid, uuid, text, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, uuid,
  text, text, text, date, date, date, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_import_fx_case(
  uuid, uuid, text, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, uuid,
  text, text, text, date, date, date, numeric
) TO authenticated;

REVOKE ALL ON FUNCTION public.update_import_fx_case_draft(
  uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, boolean, boolean,
  text, text, text, date, date, date, numeric, text, boolean, boolean, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_import_fx_case_draft(
  uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, boolean, boolean,
  text, text, text, date, date, date, numeric, text, boolean, boolean, boolean
) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_import_fx_case_stage(uuid, uuid, text, text, boolean, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_import_fx_case_stage(uuid, uuid, text, text, boolean, uuid, uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.list_import_fx_cases(uuid, uuid, text, text, int, int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_import_fx_cases(uuid, uuid, text, text, int, int)
  TO authenticated;

REVOKE ALL ON FUNCTION public.get_import_fx_case(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_import_fx_case(uuid, uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- J) link_import_fx_case_target � reject agent-as-supplier; posts_journal false
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
  v_contact_type text;
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
    SELECT lower(trim(COALESCE(ct.type::text, ''))) INTO v_contact_type
    FROM public.contacts ct
    WHERE ct.id = p_link_id AND ct.company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_LINK_TARGET_NOT_FOUND';
    END IF;
    IF v_case.agent_contact_id IS NOT NULL AND p_link_id = v_case.agent_contact_id THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_AGENT_CANNOT_BE_LINKED_SUPPLIER';
    END IF;
    IF v_type = 'SUPPLIER' AND v_contact_type = 'money_exchange'
       AND v_case.agent_contact_id IS NOT NULL AND p_link_id = v_case.agent_contact_id THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_AGENT_CANNOT_BE_LINKED_SUPPLIER';
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

  RETURN jsonb_build_object(
    'ok', true,
    'link_id', v_id,
    'posts_journal', false,
    'planning_link_only', true
  );
END;
$$;

COMMENT ON FUNCTION public.link_import_fx_case_target(uuid, uuid, text, uuid, text) IS
  'W2 planning link only (purchase/supplier/context). Does not settle supplier or post journals.';

REVOKE ALL ON FUNCTION public.link_import_fx_case_target(uuid, uuid, text, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_import_fx_case_target(uuid, uuid, text, uuid, text)
  TO authenticated;
