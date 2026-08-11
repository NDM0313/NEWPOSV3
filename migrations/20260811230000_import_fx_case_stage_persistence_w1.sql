-- Wave W1: Import FX Case / resumable stage persistence (non-posting).
-- Additive only. No advance/USD/transfer/conversion/allocation money RPCs.
-- No Phase-3 FX accounts. Path 21 tables preserved; optional case link on credits.
-- Requires: multiCurrencyEnabled gate helpers from 20260811160000_*.
-- Requires: Wave 0 import_fx_client_operations from 20260811200000_*.

-- ---------------------------------------------------------------------------
-- A) Case header
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_fx_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NULL REFERENCES public.branches(id) ON DELETE SET NULL,
  case_no text NOT NULL,
  arrangement_type text NOT NULL DEFAULT 'POOLED_USD_CNY'
    CHECK (arrangement_type IN (
      'PATH_21_AGENT_DUAL_CREDIT',
      'POOLED_USD_CNY',
      'AGENT_PREPAID'
    )),
  operational_status text NOT NULL DEFAULT 'DRAFT'
    CHECK (operational_status IN (
      'DRAFT', 'ARRANGED', 'AWAITING_ADVANCE', 'PARTIALLY_FUNDED', 'FUNDED',
      'USD_PARTIALLY_ACQUIRED', 'USD_ACQUIRED', 'USD_TRANSFER_PENDING', 'USD_TRANSFERRED',
      'CONVERSION_PENDING', 'CNY_PARTIALLY_RECEIVED', 'CNY_POOL_AVAILABLE',
      'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED', 'RECONCILIATION_REQUIRED',
      'COMPLETED', 'CANCELLED', 'REVERSED'
    )),
  accounting_status text NOT NULL DEFAULT 'NOT_POSTED'
    CHECK (accounting_status IN (
      'NOT_POSTED', 'PARTIALLY_POSTED', 'POSTED', 'RECONCILIATION_REQUIRED', 'REVERSED'
    )),
  agent_contact_id uuid NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  third_party_contact_id uuid NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  planned_source_currency text NULL,
  planned_usd_amount numeric(24, 8) NULL,
  expected_pkr_per_usd numeric(24, 12) NULL,
  expected_cny_per_usd numeric(24, 12) NULL,
  expected_cny_amount numeric(24, 8) NULL,
  expected_fees_pkr numeric(24, 2) NULL,
  expected_completion_date date NULL,
  notes text NULL,
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_fx_cases_company_case_no_unique UNIQUE (company_id, case_no)
);

CREATE INDEX IF NOT EXISTS idx_import_fx_cases_company_status
  ON public.import_fx_cases (company_id, operational_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_fx_cases_company_branch
  ON public.import_fx_cases (company_id, branch_id, created_at DESC);

COMMENT ON TABLE public.import_fx_cases IS
  'W1 Import FX Case header. Planning/resume shell only; money events in later waves.';

-- ---------------------------------------------------------------------------
-- B) Stages (one row per stage template instance)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_fx_case_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.import_fx_cases(id) ON DELETE CASCADE,
  stage_code text NOT NULL
    CHECK (stage_code IN (
      'ARRANGEMENT',
      'ADVANCE',
      'USD_ACQUISITION',
      'CHINA_USD_TRANSFER',
      'USD_CNY_CONVERSION',
      'CNY_POOL',
      'SUPPLIER_ALLOCATION',
      'RECONCILIATION'
    )),
  stage_order int NOT NULL,
  stage_status text NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (stage_status IN (
      'NOT_STARTED', 'PLANNED', 'AWAITING_ACTION', 'IN_PROGRESS',
      'PARTIALLY_COMPLETED', 'AWAITING_CONFIRMATION', 'COMPLETED',
      'FAILED', 'CANCELLED', 'REVERSED'
    )),
  expected_at timestamptz NULL,
  completed_at timestamptz NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_fx_case_stages_case_code_unique UNIQUE (case_id, stage_code)
);

CREATE INDEX IF NOT EXISTS idx_import_fx_case_stages_case
  ON public.import_fx_case_stages (case_id, stage_order);

-- ---------------------------------------------------------------------------
-- C) Append-only events (planning/confirm; posts_journal always false in W1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_fx_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.import_fx_cases(id) ON DELETE CASCADE,
  stage_id uuid NULL REFERENCES public.import_fx_case_stages(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_status text NOT NULL DEFAULT 'RECORDED'
    CHECK (event_status IN ('DRAFT', 'RECORDED', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'REVERSED')),
  posts_journal boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NULL,
  reversal_of_event_id uuid NULL REFERENCES public.import_fx_case_events(id) ON DELETE SET NULL,
  client_operation_id uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_fx_case_events_client_op
  ON public.import_fx_case_events (company_id, event_type, client_operation_id)
  WHERE client_operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_fx_case_events_case
  ON public.import_fx_case_events (case_id, created_at DESC);

COMMENT ON TABLE public.import_fx_case_events IS
  'W1 case event log. Planning/confirm events must keep posts_journal=false until later money waves.';

-- ---------------------------------------------------------------------------
-- D) Links (purchases / suppliers / Path 21 credits)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_fx_case_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.import_fx_cases(id) ON DELETE CASCADE,
  link_type text NOT NULL
    CHECK (link_type IN ('PURCHASE', 'SUPPLIER', 'FX_CURRENCY_PURCHASE', 'CONTACT')),
  link_id uuid NOT NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_fx_case_links_unique UNIQUE (case_id, link_type, link_id)
);

CREATE INDEX IF NOT EXISTS idx_import_fx_case_links_case
  ON public.import_fx_case_links (case_id, link_type);

-- ---------------------------------------------------------------------------
-- E) Attachments (metadata; files via existing storage paths)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_fx_case_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.import_fx_cases(id) ON DELETE CASCADE,
  event_id uuid NULL REFERENCES public.import_fx_case_events(id) ON DELETE SET NULL,
  stage_id uuid NULL REFERENCES public.import_fx_case_stages(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NULL,
  mime_type text NULL,
  file_size bigint NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_fx_case_attachments_case
  ON public.import_fx_case_attachments (case_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- F) Optional Path 21 link (nullable; no meaning change)
-- ---------------------------------------------------------------------------
ALTER TABLE public.fx_currency_purchases
  ADD COLUMN IF NOT EXISTS import_fx_case_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fx_currency_purchases_import_fx_case_id_fkey'
  ) THEN
    ALTER TABLE public.fx_currency_purchases
      ADD CONSTRAINT fx_currency_purchases_import_fx_case_id_fkey
      FOREIGN KEY (import_fx_case_id)
      REFERENCES public.import_fx_cases(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fx_currency_purchases_case
  ON public.fx_currency_purchases (import_fx_case_id)
  WHERE import_fx_case_id IS NOT NULL;

COMMENT ON COLUMN public.fx_currency_purchases.import_fx_case_id IS
  'Optional W1 link to Import FX Case. Does not change Path 21 credit accounting.';

-- ---------------------------------------------------------------------------
-- G) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.import_fx_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fx_case_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fx_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fx_case_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fx_case_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_fx_cases_company ON public.import_fx_cases;
CREATE POLICY import_fx_cases_company ON public.import_fx_cases
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS import_fx_case_stages_company ON public.import_fx_case_stages;
CREATE POLICY import_fx_case_stages_company ON public.import_fx_case_stages
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS import_fx_case_events_company ON public.import_fx_case_events;
CREATE POLICY import_fx_case_events_company ON public.import_fx_case_events
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS import_fx_case_links_company ON public.import_fx_case_links;
CREATE POLICY import_fx_case_links_company ON public.import_fx_case_links
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS import_fx_case_attachments_company ON public.import_fx_case_attachments;
CREATE POLICY import_fx_case_attachments_company ON public.import_fx_case_attachments
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_fx_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_fx_case_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_fx_case_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_fx_case_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_fx_case_attachments TO authenticated;

-- ---------------------------------------------------------------------------
-- H) Stage seed helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._import_fx_case_seed_stages(
  p_company_id uuid,
  p_case_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.import_fx_case_stages (
    company_id, case_id, stage_code, stage_order, stage_status
  )
  VALUES
    (p_company_id, p_case_id, 'ARRANGEMENT', 1, 'PLANNED'),
    (p_company_id, p_case_id, 'ADVANCE', 2, 'NOT_STARTED'),
    (p_company_id, p_case_id, 'USD_ACQUISITION', 3, 'NOT_STARTED'),
    (p_company_id, p_case_id, 'CHINA_USD_TRANSFER', 4, 'NOT_STARTED'),
    (p_company_id, p_case_id, 'USD_CNY_CONVERSION', 5, 'NOT_STARTED'),
    (p_company_id, p_case_id, 'CNY_POOL', 6, 'NOT_STARTED'),
    (p_company_id, p_case_id, 'SUPPLIER_ALLOCATION', 7, 'NOT_STARTED'),
    (p_company_id, p_case_id, 'RECONCILIATION', 8, 'NOT_STARTED')
  ON CONFLICT (case_id, stage_code) DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- I) Derive operational status from stages (W1: arrangement-focused)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._import_fx_case_derive_operational_status(
  p_case_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case public.import_fx_cases%ROWTYPE;
  v_arr_status text;
BEGIN
  SELECT * INTO v_case FROM public.import_fx_cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RETURN 'DRAFT';
  END IF;

  IF v_case.operational_status IN ('CANCELLED', 'REVERSED', 'COMPLETED') THEN
    RETURN v_case.operational_status;
  END IF;

  SELECT stage_status INTO v_arr_status
  FROM public.import_fx_case_stages
  WHERE case_id = p_case_id AND stage_code = 'ARRANGEMENT'
  LIMIT 1;

  IF v_arr_status = 'COMPLETED' THEN
    RETURN 'ARRANGED';
  END IF;

  IF v_case.operational_status = 'DRAFT' THEN
    RETURN 'DRAFT';
  END IF;

  RETURN COALESCE(v_case.operational_status, 'DRAFT');
END;
$$;

-- ---------------------------------------------------------------------------
-- J) RPCs (non-posting)
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
  p_created_by uuid DEFAULT NULL
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
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_COMPANY_REQUIRED';
  END IF;

  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: Import FX Case requires Multi Currency Enabled';
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

  INSERT INTO public.import_fx_cases (
    company_id, branch_id, case_no, arrangement_type, operational_status, accounting_status,
    agent_contact_id, third_party_contact_id,
    planned_source_currency, planned_usd_amount, expected_pkr_per_usd, expected_cny_per_usd,
    expected_cny_amount, expected_fees_pkr, expected_completion_date, notes,
    created_by, updated_by
  )
  VALUES (
    p_company_id, p_branch_id, v_case_no, v_arr, 'DRAFT', 'NOT_POSTED',
    p_agent_contact_id, p_third_party_contact_id,
    NULLIF(v_currency, ''), p_planned_usd_amount, p_expected_pkr_per_usd, p_expected_cny_per_usd,
    p_expected_cny_amount, p_expected_fees_pkr, p_expected_completion_date, p_notes,
    p_created_by, p_created_by
  )
  RETURNING id INTO v_case_id;

  PERFORM public._import_fx_case_seed_stages(p_company_id, v_case_id);

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, stage_id, event_type, event_status, posts_journal, payload, notes, created_by
  )
  SELECT
    p_company_id,
    v_case_id,
    s.id,
    'CASE_CREATED',
    'RECORDED',
    false,
    jsonb_build_object('arrangement_type', v_arr, 'case_no', v_case_no),
    p_notes,
    p_created_by
  FROM public.import_fx_case_stages s
  WHERE s.case_id = v_case_id AND s.stage_code = 'ARRANGEMENT'
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'case_id', v_case_id,
    'case_no', v_case_no,
    'operational_status', 'DRAFT',
    'accounting_status', 'NOT_POSTED',
    'posts_journal', false
  );
END;
$$;

COMMENT ON FUNCTION public.create_import_fx_case IS
  'W1: create Import FX Case + seed stages. No journal.';

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

COMMENT ON FUNCTION public.update_import_fx_case_draft IS
  'W1: update draft case fields. No journal.';

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
  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: Import FX Case requires Multi Currency Enabled';
  END IF;

  v_code := upper(trim(COALESCE(p_stage_code, '')));

  -- W1: only ARRANGEMENT may be confirmed as a completed planning stage.
  -- Money stages stay NOT_STARTED until later waves.
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
    -- Idempotent: already completed
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

COMMENT ON FUNCTION public.confirm_import_fx_case_stage IS
  'W1: confirm ARRANGEMENT planning stage only. Never posts a journal.';

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

  IF v_case.accounting_status <> 'NOT_POSTED' THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_CANCEL_REQUIRES_REVERSAL: accounting already posted';
  END IF;

  IF v_case.operational_status = 'CANCELLED' THEN
    RETURN jsonb_build_object('ok', true, 'case_id', p_case_id, 'operational_status', 'CANCELLED', 'idempotent_replay', true);
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
BEGIN
  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: Import FX Case requires Multi Currency Enabled';
  END IF;

  SELECT count(*)::int INTO v_total
  FROM public.import_fx_cases c
  WHERE c.company_id = p_company_id
    AND (p_branch_id IS NULL OR c.branch_id = p_branch_id OR c.branch_id IS NULL)
    AND (p_operational_status IS NULL OR c.operational_status = p_operational_status)
    AND (
      v_q IS NULL
      OR c.case_no ILIKE '%' || v_q || '%'
      OR COALESCE(c.notes, '') ILIKE '%' || v_q || '%'
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
      c.expected_cny_amount,
      c.expected_completion_date,
      c.notes,
      c.branch_id,
      c.created_at,
      c.updated_at
    FROM public.import_fx_cases c
    WHERE c.company_id = p_company_id
      AND (p_branch_id IS NULL OR c.branch_id = p_branch_id OR c.branch_id IS NULL)
      AND (p_operational_status IS NULL OR c.operational_status = p_operational_status)
      AND (
        v_q IS NULL
        OR c.case_no ILIKE '%' || v_q || '%'
        OR COALESCE(c.notes, '') ILIKE '%' || v_q || '%'
      )
    ORDER BY c.updated_at DESC
    LIMIT v_limit OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'rows', v_rows
  );
END;
$$;

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
  v_stages jsonb;
  v_events jsonb;
  v_links jsonb;
BEGIN
  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: Import FX Case requires Multi Currency Enabled';
  END IF;

  SELECT to_jsonb(c) INTO v_case
  FROM public.import_fx_cases c
  WHERE c.id = p_case_id AND c.company_id = p_company_id;

  IF v_case IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_FOUND';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.stage_order), '[]'::jsonb)
  INTO v_stages
  FROM public.import_fx_case_stages s
  WHERE s.case_id = p_case_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT * FROM public.import_fx_case_events
    WHERE case_id = p_case_id
    ORDER BY created_at DESC
    LIMIT 100
  ) e;

  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.created_at), '[]'::jsonb)
  INTO v_links
  FROM public.import_fx_case_links l
  WHERE l.case_id = p_case_id;

  RETURN jsonb_build_object(
    'ok', true,
    'case', v_case,
    'stages', v_stages,
    'events', v_events,
    'links', v_links,
    'posts_journal', false
  );
END;
$$;

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
BEGIN
  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: Import FX Case requires Multi Currency Enabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.import_fx_cases WHERE id = p_case_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_FOUND';
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

GRANT EXECUTE ON FUNCTION public.create_import_fx_case(
  uuid, uuid, text, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_import_fx_case_draft(
  uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, boolean, boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_import_fx_case_stage(
  uuid, uuid, text, text, boolean, uuid, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_import_fx_case_unposted(uuid, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_import_fx_cases(uuid, uuid, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_import_fx_case(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_import_fx_case_target(uuid, uuid, text, uuid, text) TO authenticated;
