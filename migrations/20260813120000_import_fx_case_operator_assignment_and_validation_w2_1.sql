-- Wave W2.1: Import FX Case operator clarity + assignment + validation hardenings.
-- Additive only. Does NOT rewrite applied W2 migrations (20260812140000 / 20260812140100).
-- posts_journal always false. Path 21 money path unchanged.
-- Never inserts into journal_entries, payments, wallets, or AP.
-- Money stages ADVANCE..RECONCILIATION remain non-confirmable (W3+).
-- Requires: W1 case shell + W2 ARRANGEMENT enrichment.

-- ---------------------------------------------------------------------------
-- A) Additive operator-assignment columns on import_fx_cases
-- ---------------------------------------------------------------------------
ALTER TABLE public.import_fx_cases
  ADD COLUMN IF NOT EXISTS case_owner_user_id uuid NULL REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid NULL REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS current_action_required text NULL,
  ADD COLUMN IF NOT EXISTS assignment_due_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS assignment_priority text NULL,
  ADD COLUMN IF NOT EXISTS assignment_status text NULL,
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS assignment_updated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS assignment_notes text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'import_fx_cases_assignment_priority_check'
      AND conrelid = 'public.import_fx_cases'::regclass
  ) THEN
    ALTER TABLE public.import_fx_cases
      ADD CONSTRAINT import_fx_cases_assignment_priority_check
      CHECK (
        assignment_priority IS NULL
        OR assignment_priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'import_fx_cases_assignment_status_check'
      AND conrelid = 'public.import_fx_cases'::regclass
  ) THEN
    ALTER TABLE public.import_fx_cases
      ADD CONSTRAINT import_fx_cases_assignment_status_check
      CHECK (
        assignment_status IS NULL
        OR assignment_status IN (
          'OPEN', 'IN_PROGRESS', 'WAITING_AGENT', 'WAITING_THIRD_PARTY', 'DONE', 'CANCELLED'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.import_fx_cases.case_owner_user_id IS
  'W2.1 planning/ops: accountable case owner (users.id). Never posts journal.';
COMMENT ON COLUMN public.import_fx_cases.assigned_to_user_id IS
  'W2.1 planning/ops: current assignee (users.id). Never posts journal.';
COMMENT ON COLUMN public.import_fx_cases.current_action_required IS
  'W2.1 planning/ops: short next-action text. Never posts journal.';
COMMENT ON COLUMN public.import_fx_cases.assignment_due_at IS
  'W2.1 planning/ops: assignment due timestamp. Never posts journal.';
COMMENT ON COLUMN public.import_fx_cases.assignment_priority IS
  'W2.1 planning/ops: LOW|NORMAL|HIGH|URGENT. Never posts journal.';
COMMENT ON COLUMN public.import_fx_cases.assignment_status IS
  'W2.1 planning/ops: OPEN|IN_PROGRESS|WAITING_AGENT|WAITING_THIRD_PARTY|DONE|CANCELLED. Never posts journal.';
COMMENT ON COLUMN public.import_fx_cases.reminder_at IS
  'W2.1 planning/ops: optional reminder timestamp. Never posts journal.';
COMMENT ON COLUMN public.import_fx_cases.assignment_updated_at IS
  'W2.1 planning/ops: last assignment field change. Never posts journal.';
COMMENT ON COLUMN public.import_fx_cases.assignment_notes IS
  'W2.1 planning/ops: free-text assignment notes. Never posts journal.';

COMMENT ON TABLE public.import_fx_cases IS
  'Import FX Case header. W1 shell + W2 ARRANGEMENT enrichment + W2.1 operator assignment. Money execution is W3+. Client table privileges revoked; use SECURITY DEFINER RPCs.';

-- ---------------------------------------------------------------------------
-- B) Arrangement type requires agent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._import_fx_w21_arrangement_requires_agent(p_arrangement_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(trim(COALESCE(p_arrangement_type, ''))) IN (
    'PATH_21_AGENT_DUAL_CREDIT',
    'POOLED_USD_CNY',
    'AGENT_PREPAID'
  );
$$;

COMMENT ON FUNCTION public._import_fx_w21_arrangement_requires_agent(text) IS
  'W2.1: true when ARRANGEMENT confirm requires an active money_exchange agent.';

-- ---------------------------------------------------------------------------
-- C) Harden party contacts + confirm-time agent assert
-- ---------------------------------------------------------------------------
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
  v_agent_active boolean;
  v_tp_company uuid;
BEGIN
  IF p_agent_contact_id IS NOT NULL THEN
    SELECT
      lower(trim(COALESCE(c.type::text, ''))),
      c.company_id,
      COALESCE(c.is_active, true)
    INTO v_agent_type, v_tp_company, v_agent_active
    FROM public.contacts c
    WHERE c.id = p_agent_contact_id;

    IF NOT FOUND OR v_tp_company IS DISTINCT FROM p_company_id THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_AGENT_NOT_FOUND';
    END IF;
    IF v_agent_type <> 'money_exchange' THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_AGENT_ROLE_REQUIRED: agent must be money_exchange';
    END IF;
    IF v_agent_active IS NOT TRUE THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_AGENT_INACTIVE';
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
  'W2/W2.1: agent and third party must be company money_exchange contacts and distinct; agent must be active when provided.';

CREATE OR REPLACE FUNCTION public._import_fx_w21_assert_agent_for_confirm(
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
BEGIN
  IF p_agent_contact_id IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_AGENT_REQUIRED';
  END IF;

  -- Reuses hardened party helper (not-found / role / inactive / third-party / distinct).
  PERFORM public._import_fx_w2_assert_party_contacts(
    p_company_id,
    p_agent_contact_id,
    p_third_party_contact_id
  );
END;
$$;

COMMENT ON FUNCTION public._import_fx_w21_assert_agent_for_confirm(uuid, uuid, uuid) IS
  'W2.1 confirm gate: agent required, active, money_exchange, company-scoped; keeps third-party rules.';

-- ---------------------------------------------------------------------------
-- D) Funding normalization + summary assert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._import_fx_w21_normalize_advance_for_funding(
  p_funding_mode text,
  p_advance numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN upper(trim(COALESCE(p_funding_mode, ''))) = 'CREDIT' THEN NULL
    ELSE p_advance
  END;
$$;

COMMENT ON FUNCTION public._import_fx_w21_normalize_advance_for_funding(text, numeric) IS
  'W2.1: CREDIT funding clears planned advance (canonical NULL); otherwise returns advance unchanged.';

CREATE OR REPLACE FUNCTION public._import_fx_w21_assert_funding_summary(
  p_funding_mode text,
  p_planned_usd_amount numeric,
  p_expected_pkr_per_usd numeric,
  p_expected_fees_pkr numeric,
  p_expected_advance_amount_pkr numeric
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_mode text := upper(trim(COALESCE(p_funding_mode, '')));
  v_advance numeric := public._import_fx_w21_normalize_advance_for_funding(
    p_funding_mode, p_expected_advance_amount_pkr
  );
  v_expected_total numeric;
BEGIN
  IF p_planned_usd_amount IS NOT NULL AND p_expected_pkr_per_usd IS NOT NULL THEN
    v_expected_total :=
      (p_planned_usd_amount * p_expected_pkr_per_usd) + COALESCE(p_expected_fees_pkr, 0);
  END IF;

  IF v_mode = 'CREDIT' THEN
    IF v_advance IS NOT NULL AND v_advance <> 0 THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_CREDIT_ADVANCE_NOT_ALLOWED';
    END IF;
  END IF;

  IF v_mode = 'MIXED'
     AND v_expected_total IS NOT NULL
     AND v_advance IS NOT NULL
     AND v_advance > v_expected_total THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_ADVANCE_EXCEEDS_EXPECTED_TOTAL';
  END IF;
END;
$$;

COMMENT ON FUNCTION public._import_fx_w21_assert_funding_summary(text, numeric, numeric, numeric, numeric) IS
  'W2.1 planning assert: CREDIT clears advance; MIXED advance cannot exceed expected PKR total when computable.';

REVOKE ALL ON FUNCTION public._import_fx_w21_arrangement_requires_agent(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_w2_assert_party_contacts(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_w21_assert_agent_for_confirm(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_w21_normalize_advance_for_funding(text, numeric)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_w21_assert_funding_summary(text, numeric, numeric, numeric, numeric)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- E) update_import_fx_case_draft — arrangement lock + funding normalize/assert
--     Same signature as W2 (arg list compatible).
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
  v_funding_result text;
  v_planned_usd numeric;
  v_pkr_per_usd numeric;
  v_fees_pkr numeric;
  v_advance_pkr numeric;
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

  -- W2.1: once arrangement is confirmed/completed/ARRANGED, planning edits are locked.
  IF v_case.arrangement_confirmed_at IS NOT NULL
     OR COALESCE(v_arr_stage_status, '') = 'COMPLETED'
     OR v_case.operational_status = 'ARRANGED' THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_ARRANGEMENT_LOCKED';
  END IF;

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

  v_funding_result := CASE
    WHEN p_clear_funding_mode THEN NULL
    WHEN v_funding IS NOT NULL THEN v_funding
    ELSE v_case.funding_mode
  END;

  v_planned_usd := COALESCE(p_planned_usd_amount, v_case.planned_usd_amount);
  v_pkr_per_usd := COALESCE(p_expected_pkr_per_usd, v_case.expected_pkr_per_usd);
  v_fees_pkr := COALESCE(p_expected_fees_pkr, v_case.expected_fees_pkr);
  v_advance_pkr := public._import_fx_w21_normalize_advance_for_funding(
    v_funding_result,
    COALESCE(p_expected_advance_amount_pkr, v_case.expected_advance_amount_pkr)
  );

  PERFORM public._import_fx_w21_assert_funding_summary(
    v_funding_result,
    v_planned_usd,
    v_pkr_per_usd,
    v_fees_pkr,
    v_advance_pkr
  );

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
    expected_advance_amount_pkr = CASE
      WHEN v_funding_result = 'CREDIT' THEN NULL
      WHEN p_expected_advance_amount_pkr IS NOT NULL THEN p_expected_advance_amount_pkr
      ELSE expected_advance_amount_pkr
    END,
    updated_by = p_updated_by,
    updated_at = now()
  WHERE id = p_case_id;

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, event_type, event_status, posts_journal, payload, created_by
  ) VALUES (
    p_company_id, p_case_id, 'DRAFT_SAVED', 'RECORDED', false,
    jsonb_build_object('saved_at', now(), 'planning_only', true, 'wave', 'W2.1'),
    p_updated_by
  );

  RETURN jsonb_build_object('ok', true, 'case_id', p_case_id, 'posts_journal', false);
END;
$$;

COMMENT ON FUNCTION public.update_import_fx_case_draft(
  uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, boolean, boolean,
  text, text, text, date, date, date, numeric, text, boolean, boolean, boolean
) IS
  'W2.1 update ARRANGEMENT draft. Locks after arrangement confirm. Funding normalize/assert. Never posts journal.';

-- ---------------------------------------------------------------------------
-- F) confirm_import_fx_case_stage — agent + funding gates on ARRANGEMENT complete
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

  -- W2/W2.1: only ARRANGEMENT. Money stages blocked until W3+.
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

  -- W2.1: before completing ARRANGEMENT, require agent (when type needs one) + funding summary.
  IF v_new_status = 'COMPLETED' THEN
    IF public._import_fx_w21_arrangement_requires_agent(v_case.arrangement_type) THEN
      PERFORM public._import_fx_w21_assert_agent_for_confirm(
        p_company_id,
        v_case.agent_contact_id,
        v_case.third_party_contact_id
      );
    END IF;

    PERFORM public._import_fx_w21_assert_funding_summary(
      v_case.funding_mode,
      v_case.planned_usd_amount,
      v_case.expected_pkr_per_usd,
      v_case.expected_fees_pkr,
      public._import_fx_w21_normalize_advance_for_funding(
        v_case.funding_mode,
        v_case.expected_advance_amount_pkr
      )
    );
  END IF;

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
      'wave', 'W2.1'
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
  'W2.1 confirm ARRANGEMENT only. Agent/funding gates on complete. Never posts journal.';

-- ---------------------------------------------------------------------------
-- G) update_import_fx_case_assignment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_import_fx_case_assignment(
  p_company_id uuid,
  p_case_id uuid,
  p_case_owner_user_id uuid DEFAULT NULL,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_current_action_required text DEFAULT NULL,
  p_assignment_due_at timestamptz DEFAULT NULL,
  p_assignment_priority text DEFAULT NULL,
  p_assignment_status text DEFAULT NULL,
  p_reminder_at timestamptz DEFAULT NULL,
  p_assignment_notes text DEFAULT NULL,
  p_updated_by uuid DEFAULT NULL,
  p_clear_assignee boolean DEFAULT false,
  p_clear_owner boolean DEFAULT false,
  p_client_operation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case public.import_fx_cases%ROWTYPE;
  v_event_id uuid;
  v_owner uuid;
  v_assignee uuid;
  v_priority text;
  v_status text;
  v_user_company uuid;
  v_user_active boolean;
  v_user_role text;
  v_before jsonb;
  v_after jsonb;
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

  IF v_case.operational_status IN ('CANCELLED', 'REVERSED') THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_EDITABLE: %', v_case.operational_status;
  END IF;

  IF p_client_operation_id IS NOT NULL THEN
    SELECT id INTO v_event_id
    FROM public.import_fx_case_events
    WHERE company_id = p_company_id
      AND case_id = p_case_id
      AND event_type = 'ASSIGNMENT_UPDATED'
      AND client_operation_id = p_client_operation_id
    LIMIT 1;
    IF v_event_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'case_id', p_case_id,
        'event_id', v_event_id,
        'posts_journal', false,
        'accounting_status', v_case.accounting_status,
        'idempotent_replay', true,
        'case_owner_user_id', v_case.case_owner_user_id,
        'assigned_to_user_id', v_case.assigned_to_user_id,
        'current_action_required', v_case.current_action_required,
        'assignment_due_at', v_case.assignment_due_at,
        'assignment_priority', v_case.assignment_priority,
        'assignment_status', v_case.assignment_status,
        'reminder_at', v_case.reminder_at,
        'assignment_notes', v_case.assignment_notes,
        'assignment_updated_at', v_case.assignment_updated_at
      );
    END IF;
  END IF;

  v_priority := NULLIF(upper(trim(COALESCE(p_assignment_priority, ''))), '');
  IF p_assignment_priority IS NOT NULL AND v_priority IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_INVALID_ASSIGNMENT_PRIORITY';
  END IF;
  IF v_priority IS NOT NULL AND v_priority NOT IN ('LOW', 'NORMAL', 'HIGH', 'URGENT') THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_INVALID_ASSIGNMENT_PRIORITY: %', v_priority;
  END IF;

  v_status := NULLIF(upper(trim(COALESCE(p_assignment_status, ''))), '');
  IF p_assignment_status IS NOT NULL AND v_status IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_INVALID_ASSIGNMENT_STATUS';
  END IF;
  IF v_status IS NOT NULL AND v_status NOT IN (
    'OPEN', 'IN_PROGRESS', 'WAITING_AGENT', 'WAITING_THIRD_PARTY', 'DONE', 'CANCELLED'
  ) THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_INVALID_ASSIGNMENT_STATUS: %', v_status;
  END IF;

  v_owner := CASE
    WHEN p_clear_owner THEN NULL
    WHEN p_case_owner_user_id IS NOT NULL THEN p_case_owner_user_id
    ELSE v_case.case_owner_user_id
  END;

  v_assignee := CASE
    WHEN p_clear_assignee THEN NULL
    WHEN p_assigned_to_user_id IS NOT NULL THEN p_assigned_to_user_id
    ELSE v_case.assigned_to_user_id
  END;

  IF NOT p_clear_owner AND p_case_owner_user_id IS NOT NULL THEN
    SELECT u.company_id, COALESCE(u.is_active, true)
    INTO v_user_company, v_user_active
    FROM public.users u
    WHERE u.id = p_case_owner_user_id;

    IF NOT FOUND OR v_user_company IS DISTINCT FROM p_company_id THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_OWNER_USER_NOT_FOUND';
    END IF;
    IF v_user_active IS NOT TRUE THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_OWNER_USER_INACTIVE';
    END IF;
  END IF;

  IF NOT p_clear_assignee AND p_assigned_to_user_id IS NOT NULL THEN
    SELECT u.company_id, COALESCE(u.is_active, true), lower(trim(COALESCE(u.role::text, '')))
    INTO v_user_company, v_user_active, v_user_role
    FROM public.users u
    WHERE u.id = p_assigned_to_user_id;

    IF NOT FOUND OR v_user_company IS DISTINCT FROM p_company_id THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_ASSIGNEE_USER_NOT_FOUND';
    END IF;
    IF v_user_active IS NOT TRUE THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_ASSIGNEE_USER_INACTIVE';
    END IF;
  ELSIF v_assignee IS NOT NULL AND NOT p_clear_assignee THEN
    -- Existing assignee retained: still enforce branch eligibility below using stored id.
    SELECT lower(trim(COALESCE(u.role::text, '')))
    INTO v_user_role
    FROM public.users u
    WHERE u.id = v_assignee AND u.company_id = p_company_id;
  END IF;

  IF v_case.branch_id IS NOT NULL AND v_assignee IS NOT NULL THEN
    IF v_user_role IS NULL THEN
      SELECT lower(trim(COALESCE(u.role::text, '')))
      INTO v_user_role
      FROM public.users u
      WHERE u.id = v_assignee AND u.company_id = p_company_id;
    END IF;

    IF COALESCE(v_user_role, '') NOT IN ('owner', 'admin', 'developer')
       AND NOT EXISTS (
         SELECT 1
         FROM public.user_branches ub
         WHERE ub.user_id = v_assignee
           AND ub.branch_id = v_case.branch_id
       ) THEN
      RAISE EXCEPTION 'IMPORT_FX_CASE_ASSIGNEE_BRANCH_DENIED';
    END IF;
  END IF;

  v_before := jsonb_build_object(
    'case_owner_user_id', v_case.case_owner_user_id,
    'assigned_to_user_id', v_case.assigned_to_user_id,
    'current_action_required', v_case.current_action_required,
    'assignment_due_at', v_case.assignment_due_at,
    'assignment_priority', v_case.assignment_priority,
    'assignment_status', v_case.assignment_status,
    'reminder_at', v_case.reminder_at,
    'assignment_notes', v_case.assignment_notes
  );

  UPDATE public.import_fx_cases SET
    case_owner_user_id = v_owner,
    assigned_to_user_id = v_assignee,
    current_action_required = COALESCE(p_current_action_required, current_action_required),
    assignment_due_at = COALESCE(p_assignment_due_at, assignment_due_at),
    assignment_priority = COALESCE(v_priority, assignment_priority),
    assignment_status = COALESCE(v_status, assignment_status),
    reminder_at = COALESCE(p_reminder_at, reminder_at),
    assignment_notes = COALESCE(p_assignment_notes, assignment_notes),
    assignment_updated_at = now(),
    updated_by = p_updated_by,
    updated_at = now()
  WHERE id = p_case_id
  RETURNING
    case_owner_user_id,
    assigned_to_user_id,
    current_action_required,
    assignment_due_at,
    assignment_priority,
    assignment_status,
    reminder_at,
    assignment_notes,
    assignment_updated_at,
    accounting_status
  INTO
    v_case.case_owner_user_id,
    v_case.assigned_to_user_id,
    v_case.current_action_required,
    v_case.assignment_due_at,
    v_case.assignment_priority,
    v_case.assignment_status,
    v_case.reminder_at,
    v_case.assignment_notes,
    v_case.assignment_updated_at,
    v_case.accounting_status;

  v_after := jsonb_build_object(
    'case_owner_user_id', v_case.case_owner_user_id,
    'assigned_to_user_id', v_case.assigned_to_user_id,
    'current_action_required', v_case.current_action_required,
    'assignment_due_at', v_case.assignment_due_at,
    'assignment_priority', v_case.assignment_priority,
    'assignment_status', v_case.assignment_status,
    'reminder_at', v_case.reminder_at,
    'assignment_notes', v_case.assignment_notes
  );

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, event_type, event_status, posts_journal,
    payload, client_operation_id, created_by
  ) VALUES (
    p_company_id,
    p_case_id,
    'ASSIGNMENT_UPDATED',
    'RECORDED',
    false,
    jsonb_build_object(
      'before', v_before,
      'after', v_after,
      'planning_only', true,
      'wave', 'W2.1'
    ),
    p_client_operation_id,
    p_updated_by
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'ok', true,
    'case_id', p_case_id,
    'event_id', v_event_id,
    'posts_journal', false,
    'accounting_status', v_case.accounting_status,
    'idempotent_replay', false,
    'case_owner_user_id', v_case.case_owner_user_id,
    'assigned_to_user_id', v_case.assigned_to_user_id,
    'current_action_required', v_case.current_action_required,
    'assignment_due_at', v_case.assignment_due_at,
    'assignment_priority', v_case.assignment_priority,
    'assignment_status', v_case.assignment_status,
    'reminder_at', v_case.reminder_at,
    'assignment_notes', v_case.assignment_notes,
    'assignment_updated_at', v_case.assignment_updated_at
  );
END;
$$;

COMMENT ON FUNCTION public.update_import_fx_case_assignment(
  uuid, uuid, uuid, uuid, text, timestamptz, text, text, timestamptz, text, uuid, boolean, boolean, uuid
) IS
  'W2.1 operator assignment update only. Never changes arrangement/accounting posting. posts_journal=false.';

-- ---------------------------------------------------------------------------
-- H) complete_import_fx_case_assignment (optional convenience)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_import_fx_case_assignment(
  p_company_id uuid,
  p_case_id uuid,
  p_updated_by uuid DEFAULT NULL,
  p_client_operation_id uuid DEFAULT NULL,
  p_assignment_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case public.import_fx_cases%ROWTYPE;
  v_event_id uuid;
  v_before text;
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

  IF v_case.operational_status IN ('CANCELLED', 'REVERSED') THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_EDITABLE: %', v_case.operational_status;
  END IF;

  IF p_client_operation_id IS NOT NULL THEN
    SELECT id INTO v_event_id
    FROM public.import_fx_case_events
    WHERE company_id = p_company_id
      AND case_id = p_case_id
      AND event_type = 'ASSIGNMENT_COMPLETED'
      AND client_operation_id = p_client_operation_id
    LIMIT 1;
    IF v_event_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'case_id', p_case_id,
        'event_id', v_event_id,
        'posts_journal', false,
        'accounting_status', v_case.accounting_status,
        'assignment_status', v_case.assignment_status,
        'assignment_updated_at', v_case.assignment_updated_at,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  v_before := v_case.assignment_status;

  UPDATE public.import_fx_cases SET
    assignment_status = 'DONE',
    assignment_notes = COALESCE(p_assignment_notes, assignment_notes),
    assignment_updated_at = now(),
    updated_by = p_updated_by,
    updated_at = now()
  WHERE id = p_case_id
  RETURNING assignment_status, assignment_updated_at, accounting_status, assignment_notes
  INTO v_case.assignment_status, v_case.assignment_updated_at, v_case.accounting_status, v_case.assignment_notes;

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, event_type, event_status, posts_journal,
    payload, client_operation_id, created_by
  ) VALUES (
    p_company_id,
    p_case_id,
    'ASSIGNMENT_COMPLETED',
    'RECORDED',
    false,
    jsonb_build_object(
      'before_status', v_before,
      'after_status', 'DONE',
      'planning_only', true,
      'wave', 'W2.1'
    ),
    p_client_operation_id,
    p_updated_by
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'ok', true,
    'case_id', p_case_id,
    'event_id', v_event_id,
    'posts_journal', false,
    'accounting_status', v_case.accounting_status,
    'assignment_status', v_case.assignment_status,
    'assignment_notes', v_case.assignment_notes,
    'assignment_updated_at', v_case.assignment_updated_at,
    'idempotent_replay', false
  );
END;
$$;

COMMENT ON FUNCTION public.complete_import_fx_case_assignment(uuid, uuid, uuid, uuid, text) IS
  'W2.1 mark assignment DONE. Never posts journal. Does not change accounting_status.';

-- ---------------------------------------------------------------------------
-- I) list_import_fx_cases / get_import_fx_case — project assignment columns
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
      OR COALESCE(c.current_action_required, '') ILIKE '%' || v_q || '%'
      OR COALESCE(c.assignment_notes, '') ILIKE '%' || v_q || '%'
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
      c.case_owner_user_id,
      c.assigned_to_user_id,
      c.current_action_required,
      c.assignment_due_at,
      c.assignment_priority,
      c.assignment_status,
      c.reminder_at,
      c.assignment_updated_at,
      c.assignment_notes,
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
        OR COALESCE(c.current_action_required, '') ILIKE '%' || v_q || '%'
        OR COALESCE(c.assignment_notes, '') ILIKE '%' || v_q || '%'
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
  'W2.1 list Import FX cases (arrangement + assignment fields). Readable when MC OFF. Never posts journals.';

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
      'case_owner_user_id', c.case_owner_user_id,
      'assigned_to_user_id', c.assigned_to_user_id,
      'current_action_required', c.current_action_required,
      'assignment_due_at', c.assignment_due_at,
      'assignment_priority', c.assignment_priority,
      'assignment_status', c.assignment_status,
      'reminder_at', c.reminder_at,
      'assignment_updated_at', c.assignment_updated_at,
      'assignment_notes', c.assignment_notes,
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
  'W2.1 get Import FX case with arrangement + assignment fields. Omits storage_path. Never posts journals.';

-- ---------------------------------------------------------------------------
-- J) Privileges
-- ---------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.update_import_fx_case_assignment(
  uuid, uuid, uuid, uuid, text, timestamptz, text, text, timestamptz, text, uuid, boolean, boolean, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_import_fx_case_assignment(
  uuid, uuid, uuid, uuid, text, timestamptz, text, text, timestamptz, text, uuid, boolean, boolean, uuid
) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_import_fx_case_assignment(uuid, uuid, uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_import_fx_case_assignment(uuid, uuid, uuid, uuid, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.list_import_fx_cases(uuid, uuid, text, text, int, int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_import_fx_cases(uuid, uuid, text, text, int, int)
  TO authenticated;

REVOKE ALL ON FUNCTION public.get_import_fx_case(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_import_fx_case(uuid, uuid)
  TO authenticated;
