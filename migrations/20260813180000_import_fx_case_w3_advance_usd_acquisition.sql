-- Wave W3: Import FX Case Agent Advance + USD/TT Acquisition (additive).
-- posts_journal: true on confirm-post RPCs only.
-- Profile A: no FX P&L / Pending FX accounts. No Supplier AP. No CNY. No Path 21 rewrite.
-- OD-1..OD-7 locked. Clearing via accounting_settings.agentFxAdvanceClearingAccountId (never hardcode 1230).
-- Requires: W1 case shell + W2/W2.1 arrangement enrichment.

-- ---------------------------------------------------------------------------
-- A) Extend client_operations event types for W3
-- ---------------------------------------------------------------------------
ALTER TABLE public.import_fx_client_operations
  DROP CONSTRAINT IF EXISTS import_fx_client_operations_event_type_check;

ALTER TABLE public.import_fx_client_operations
  ADD CONSTRAINT import_fx_client_operations_event_type_check
  CHECK (event_type IN (
    'fx_credit', 'agent_settle', 'china_settle',
    'w3_agent_advance', 'w3_agent_advance_reverse',
    'w3_usd_acquisition', 'w3_usd_acquisition_reverse'
  ));

-- ---------------------------------------------------------------------------
-- B) Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_fx_case_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  branch_id uuid NULL REFERENCES public.branches(id),
  import_fx_case_id uuid NOT NULL REFERENCES public.import_fx_cases(id),
  agent_contact_id uuid NOT NULL REFERENCES public.contacts(id),
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
  posting_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_pkr numeric(18,2) NOT NULL CHECK (amount_pkr > 0),
  remaining_unapplied_pkr numeric(18,2) NOT NULL CHECK (remaining_unapplied_pkr >= 0),
  payment_source_account_id uuid NOT NULL REFERENCES public.accounts(id),
  clearing_account_id uuid NULL REFERENCES public.accounts(id),
  external_reference text NULL,
  notes text NULL,
  fee_pkr numeric(18,2) NULL CHECK (fee_pkr IS NULL OR fee_pkr = 0),
  client_operation_id text NULL,
  journal_entry_id uuid NULL REFERENCES public.journal_entries(id),
  reversal_of_id uuid NULL REFERENCES public.import_fx_case_advances(id),
  reversed_by_id uuid NULL REFERENCES public.import_fx_case_advances(id),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz NULL,
  reversed_at timestamptz NULL,
  CONSTRAINT import_fx_case_advances_remaining_lte_amount
    CHECK (remaining_unapplied_pkr <= amount_pkr)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_import_fx_case_advances_client_op
  ON public.import_fx_case_advances (company_id, client_operation_id)
  WHERE client_operation_id IS NOT NULL AND status IN ('POSTED', 'REVERSED');

CREATE INDEX IF NOT EXISTS idx_import_fx_case_advances_case
  ON public.import_fx_case_advances (company_id, import_fx_case_id, status, posted_at);

CREATE TABLE IF NOT EXISTS public.import_fx_case_usd_acquisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  branch_id uuid NULL REFERENCES public.branches(id),
  import_fx_case_id uuid NOT NULL REFERENCES public.import_fx_cases(id),
  agent_contact_id uuid NOT NULL REFERENCES public.contacts(id),
  destination_wallet_account_id uuid NOT NULL REFERENCES public.accounts(id),
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
  acquisition_date date NOT NULL DEFAULT CURRENT_DATE,
  usd_quantity numeric(18,6) NOT NULL CHECK (usd_quantity > 0),
  pkr_per_usd numeric(18,8) NOT NULL CHECK (pkr_per_usd > 0),
  carrying_pkr numeric(18,2) NOT NULL CHECK (carrying_pkr > 0),
  funding_type text NOT NULL CHECK (funding_type IN ('ADVANCE', 'CREDIT', 'MIXED')),
  advance_applied_pkr numeric(18,2) NOT NULL DEFAULT 0 CHECK (advance_applied_pkr >= 0),
  agent_ap_created_pkr numeric(18,2) NOT NULL DEFAULT 0 CHECK (agent_ap_created_pkr >= 0),
  fee_pkr numeric(18,2) NULL CHECK (fee_pkr IS NULL OR fee_pkr = 0),
  external_reference text NULL,
  notes text NULL,
  client_operation_id text NULL,
  journal_entry_id uuid NULL REFERENCES public.journal_entries(id),
  agent_ap_account_id uuid NULL REFERENCES public.accounts(id),
  clearing_account_id uuid NULL REFERENCES public.accounts(id),
  reversal_of_id uuid NULL REFERENCES public.import_fx_case_usd_acquisitions(id),
  reversed_by_id uuid NULL REFERENCES public.import_fx_case_usd_acquisitions(id),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz NULL,
  reversed_at timestamptz NULL,
  CONSTRAINT import_fx_case_usd_acq_funding_split_check
    CHECK (round(advance_applied_pkr + agent_ap_created_pkr, 2) = round(carrying_pkr, 2))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_import_fx_case_usd_acq_client_op
  ON public.import_fx_case_usd_acquisitions (company_id, client_operation_id)
  WHERE client_operation_id IS NOT NULL AND status IN ('POSTED', 'REVERSED');

CREATE INDEX IF NOT EXISTS idx_import_fx_case_usd_acq_case
  ON public.import_fx_case_usd_acquisitions (company_id, import_fx_case_id, status, posted_at);

CREATE TABLE IF NOT EXISTS public.import_fx_case_advance_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  import_fx_case_id uuid NOT NULL REFERENCES public.import_fx_cases(id),
  advance_id uuid NOT NULL REFERENCES public.import_fx_case_advances(id),
  acquisition_id uuid NOT NULL REFERENCES public.import_fx_case_usd_acquisitions(id),
  applied_pkr numeric(18,2) NOT NULL CHECK (applied_pkr > 0),
  application_order int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED')),
  reversal_of_id uuid NULL REFERENCES public.import_fx_case_advance_applications(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_import_fx_case_adv_app_advance
  ON public.import_fx_case_advance_applications (advance_id, status);

CREATE INDEX IF NOT EXISTS idx_import_fx_case_adv_app_acq
  ON public.import_fx_case_advance_applications (acquisition_id, status);

CREATE TABLE IF NOT EXISTS public.import_fx_case_usd_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  import_fx_case_id uuid NOT NULL REFERENCES public.import_fx_cases(id),
  acquisition_id uuid NOT NULL REFERENCES public.import_fx_case_usd_acquisitions(id),
  wallet_account_id uuid NOT NULL REFERENCES public.accounts(id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVERSED', 'CONSUMED')),
  usd_original_qty numeric(18,6) NOT NULL CHECK (usd_original_qty > 0),
  usd_remaining_qty numeric(18,6) NOT NULL CHECK (usd_remaining_qty >= 0),
  pkr_original_carrying numeric(18,2) NOT NULL CHECK (pkr_original_carrying > 0),
  pkr_remaining_carrying numeric(18,2) NOT NULL CHECK (pkr_remaining_carrying >= 0),
  effective_pkr_per_usd numeric(18,8) NOT NULL CHECK (effective_pkr_per_usd > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz NULL,
  CONSTRAINT import_fx_case_usd_lots_remaining_lte_orig
    CHECK (usd_remaining_qty <= usd_original_qty AND pkr_remaining_carrying <= pkr_original_carrying)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_import_fx_case_usd_lots_acq
  ON public.import_fx_case_usd_lots (acquisition_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_import_fx_case_usd_lots_wallet
  ON public.import_fx_case_usd_lots (company_id, wallet_account_id, status);

ALTER TABLE public.import_fx_case_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fx_case_usd_acquisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fx_case_advance_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fx_case_usd_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_fx_case_advances_select_company ON public.import_fx_case_advances;
CREATE POLICY import_fx_case_advances_select_company
  ON public.import_fx_case_advances FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS import_fx_case_usd_acq_select_company ON public.import_fx_case_usd_acquisitions;
CREATE POLICY import_fx_case_usd_acq_select_company
  ON public.import_fx_case_usd_acquisitions FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS import_fx_case_adv_app_select_company ON public.import_fx_case_advance_applications;
CREATE POLICY import_fx_case_adv_app_select_company
  ON public.import_fx_case_advance_applications FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS import_fx_case_usd_lots_select_company ON public.import_fx_case_usd_lots;
CREATE POLICY import_fx_case_usd_lots_select_company
  ON public.import_fx_case_usd_lots FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

REVOKE INSERT, UPDATE, DELETE ON public.import_fx_case_advances FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.import_fx_case_usd_acquisitions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.import_fx_case_advance_applications FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.import_fx_case_usd_lots FROM authenticated, anon;
GRANT SELECT ON public.import_fx_case_advances TO authenticated;
GRANT SELECT ON public.import_fx_case_usd_acquisitions TO authenticated;
GRANT SELECT ON public.import_fx_case_advance_applications TO authenticated;
GRANT SELECT ON public.import_fx_case_usd_lots TO authenticated;
GRANT ALL ON public.import_fx_case_advances TO service_role;
GRANT ALL ON public.import_fx_case_usd_acquisitions TO service_role;
GRANT ALL ON public.import_fx_case_advance_applications TO service_role;
GRANT ALL ON public.import_fx_case_usd_lots TO service_role;

COMMENT ON TABLE public.import_fx_case_advances IS
  'W3 Agent FX Advance events. RPC-only writes. Clearing via settings-mapped AGENT_FX_ADVANCE_CLEARING.';
COMMENT ON TABLE public.import_fx_case_usd_acquisitions IS
  'W3 USD/TT acquisition events with immutable funding split. No CNY/Supplier AP.';
COMMENT ON TABLE public.import_fx_case_usd_lots IS
  'Immutable USD lots (qty + PKR carrying). WA reporting is derived; lots never rewritten.';

-- ---------------------------------------------------------------------------
-- C) Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._import_fx_w3_get_clearing_account_id(p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_id uuid;
BEGIN
  SELECT NULLIF(trim(COALESCE(s.value->>'agentFxAdvanceClearingAccountId', '')), '')
  INTO v_raw
  FROM public.settings s
  WHERE s.company_id = p_company_id
    AND s.key = 'accounting_settings'
  LIMIT 1;

  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_id := v_raw::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._import_fx_w3_get_clearing_account_id(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._import_fx_w3_assert_clearing_account(
  p_company_id uuid,
  p_account_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc record;
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_AGENT_ADVANCE_CLEARING_NOT_CONFIGURED'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT a.id, a.company_id, a.code, a.name, a.type::text AS type,
         COALESCE(a.is_active, true) AS is_active,
         COALESCE(a.is_group, false) AS is_group,
         COALESCE(a.subtype::text, '') AS subtype,
         a.parent_id
  INTO v_acc
  FROM public.accounts a
  WHERE a.id = p_account_id
  LIMIT 1;

  IF v_acc.id IS NULL OR v_acc.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'IMPORT_FX_AGENT_ADVANCE_CLEARING_NOT_CONFIGURED'
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_acc.is_active OR v_acc.is_group THEN
    RAISE EXCEPTION 'IMPORT_FX_AGENT_ADVANCE_CLEARING_NOT_CONFIGURED'
      USING ERRCODE = 'P0001';
  END IF;
  IF lower(COALESCE(v_acc.type, '')) NOT IN ('asset', 'current_asset') THEN
    RAISE EXCEPTION 'IMPORT_FX_AGENT_ADVANCE_CLEARING_NOT_CONFIGURED'
      USING ERRCODE = 'P0001';
  END IF;
  IF trim(COALESCE(v_acc.code, '')) = '1180' THEN
    RAISE EXCEPTION 'IMPORT_FX_AGENT_ADVANCE_CLEARING_NOT_CONFIGURED: Worker Advance 1180 forbidden'
      USING ERRCODE = 'P0001';
  END IF;
  IF trim(COALESCE(v_acc.code, '')) IN ('1395', '2295', '6100', '7100') THEN
    RAISE EXCEPTION 'IMPORT_FX_AGENT_ADVANCE_CLEARING_NOT_CONFIGURED: Phase-3 accounts forbidden'
      USING ERRCODE = 'P0001';
  END IF;
  IF public._is_tt_agent_wallet_account(v_acc.code, v_acc.name) THEN
    RAISE EXCEPTION 'IMPORT_FX_AGENT_ADVANCE_CLEARING_NOT_CONFIGURED: TT wallet cannot be clearing'
      USING ERRCODE = 'P0001';
  END IF;
  IF public._is_account_control_code(v_acc.id, '2000')
     OR public._is_account_control_code(v_acc.id, '1100') THEN
    RAISE EXCEPTION 'IMPORT_FX_AGENT_ADVANCE_CLEARING_NOT_CONFIGURED: control account forbidden'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._import_fx_w3_assert_clearing_account(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._import_fx_w3_assert_payment_source(
  p_company_id uuid,
  p_account_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc record;
  v_code text;
  v_type text;
  v_name text;
BEGIN
  SELECT a.id, a.company_id, a.code, a.name, lower(a.type::text) AS type,
         COALESCE(a.is_active, true) AS is_active,
         COALESCE(a.is_group, false) AS is_group,
         lower(COALESCE(a.subtype::text, '')) AS subtype
  INTO v_acc
  FROM public.accounts a
  WHERE a.id = p_account_id
  LIMIT 1;

  IF v_acc.id IS NULL OR v_acc.company_id IS DISTINCT FROM p_company_id
     OR NOT v_acc.is_active OR v_acc.is_group THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_PAYMENT_SOURCE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  v_code := trim(COALESCE(v_acc.code, ''));
  v_type := COALESCE(v_acc.type, '');
  v_name := lower(COALESCE(v_acc.name, ''));

  IF v_type IN ('cash', 'bank', 'mobile_wallet')
     OR v_acc.subtype IN ('cash', 'bank', 'mobile_wallet')
     OR v_code ~ '^10[0-2]'
     OR v_name ~ '(cash|bank|meezan|hbl|ubl|jazzcash|easypaisa)' THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'IMPORT_FX_CASE_PAYMENT_SOURCE_INVALID'
    USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public._import_fx_w3_assert_payment_source(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._import_fx_w3_lock_case_for_money(
  p_company_id uuid,
  p_case_id uuid
)
RETURNS public.import_fx_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.import_fx_cases%ROWTYPE;
BEGIN
  SELECT * INTO v_case
  FROM public.import_fx_cases
  WHERE id = p_case_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_case.operational_status = 'CANCELLED' THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_CANCELLED' USING ERRCODE = 'P0001';
  END IF;
  IF v_case.arrangement_confirmed_at IS NULL OR v_case.operational_status = 'DRAFT' THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_ARRANGED' USING ERRCODE = 'P0001';
  END IF;
  IF v_case.agent_contact_id IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_AGENT_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_case;
END;
$$;

REVOKE ALL ON FUNCTION public._import_fx_w3_lock_case_for_money(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._import_fx_w3_set_partially_posted(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.import_fx_cases
  SET accounting_status = 'PARTIALLY_POSTED',
      updated_at = now()
  WHERE id = p_case_id
    AND accounting_status IS DISTINCT FROM 'POSTED';
END;
$$;

REVOKE ALL ON FUNCTION public._import_fx_w3_set_partially_posted(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._import_fx_w3_recompute_accounting_status(p_case_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active int;
  v_status text;
BEGIN
  SELECT count(*)::int INTO v_active
  FROM (
    SELECT 1 FROM public.import_fx_case_advances
    WHERE import_fx_case_id = p_case_id AND status = 'POSTED'
    UNION ALL
    SELECT 1 FROM public.import_fx_case_usd_acquisitions
    WHERE import_fx_case_id = p_case_id AND status = 'POSTED'
  ) x;

  IF v_active > 0 THEN
    v_status := 'PARTIALLY_POSTED';
  ELSE
    v_status := 'NOT_POSTED';
  END IF;

  UPDATE public.import_fx_cases
  SET accounting_status = v_status,
      updated_at = now()
  WHERE id = p_case_id
    AND accounting_status IS DISTINCT FROM 'POSTED';

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public._import_fx_w3_recompute_accounting_status(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- D) Capability probe
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_fx_w3_capability()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'installed', true,
    'version', 'w3',
    'posts_journal_supported', true
  );
$$;

GRANT EXECUTE ON FUNCTION public.import_fx_w3_capability() TO authenticated;
REVOKE ALL ON FUNCTION public.import_fx_w3_capability() FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- E) Money overview
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_import_fx_case_money_overview(
  p_company_id uuid,
  p_case_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.import_fx_cases%ROWTYPE;
  v_clearing uuid;
  v_posted_adv numeric(18,2);
  v_unapplied numeric(18,2);
  v_usd_qty numeric(18,6);
  v_usd_carry numeric(18,2);
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);

  SELECT * INTO v_case
  FROM public.import_fx_cases
  WHERE id = p_case_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_NOT_FOUND');
  END IF;
  IF NOT public._import_fx_case_branch_row_allowed(v_case.branch_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED');
  END IF;

  v_clearing := public._import_fx_w3_get_clearing_account_id(p_company_id);

  SELECT COALESCE(sum(amount_pkr), 0), COALESCE(sum(remaining_unapplied_pkr), 0)
  INTO v_posted_adv, v_unapplied
  FROM public.import_fx_case_advances
  WHERE import_fx_case_id = p_case_id AND status = 'POSTED';

  SELECT COALESCE(sum(usd_quantity), 0), COALESCE(sum(carrying_pkr), 0)
  INTO v_usd_qty, v_usd_carry
  FROM public.import_fx_case_usd_acquisitions
  WHERE import_fx_case_id = p_case_id AND status = 'POSTED';

  RETURN jsonb_build_object(
    'success', true,
    'case_id', p_case_id,
    'accounting_status', v_case.accounting_status,
    'clearing_configured', v_clearing IS NOT NULL,
    'clearing_account_id', v_clearing,
    'posted_advance_pkr', v_posted_adv,
    'unapplied_advance_pkr', v_unapplied,
    'posted_usd_qty', v_usd_qty,
    'posted_usd_carrying_pkr', v_usd_carry,
    'advances', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.posted_at NULLS LAST, a.created_at)
      FROM public.import_fx_case_advances a
      WHERE a.import_fx_case_id = p_case_id
    ), '[]'::jsonb),
    'acquisitions', COALESCE((
      SELECT jsonb_agg(to_jsonb(u) ORDER BY u.posted_at NULLS LAST, u.created_at)
      FROM public.import_fx_case_usd_acquisitions u
      WHERE u.import_fx_case_id = p_case_id
    ), '[]'::jsonb),
    'lots', COALESCE((
      SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at)
      FROM public.import_fx_case_usd_lots l
      WHERE l.import_fx_case_id = p_case_id AND l.status = 'ACTIVE'
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_import_fx_case_money_overview(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_import_fx_case_money_overview(uuid, uuid) FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- F) Post Agent Advance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_import_fx_agent_advance(
  p_company_id uuid,
  p_branch_id uuid,
  p_case_id uuid,
  p_posting_date date,
  p_amount_pkr numeric,
  p_payment_source_account_id uuid,
  p_external_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_client_operation_id text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.import_fx_cases%ROWTYPE;
  v_existing public.import_fx_case_advances%ROWTYPE;
  v_clearing uuid;
  v_entry_no text;
  v_je_id uuid;
  v_adv_id uuid;
  v_amount numeric(18,2);
  v_agent record;
  v_op uuid;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);
  PERFORM public._import_fx_case_assert_branch_param(p_branch_id);

  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'MULTI_CURRENCY_DISABLED', 'posts_journal', false);
  END IF;

  IF p_client_operation_id IS NULL OR length(trim(p_client_operation_id)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_CLIENT_OPERATION_REQUIRED', 'posts_journal', false);
  END IF;

  BEGIN
    v_op := trim(p_client_operation_id)::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_CLIENT_OPERATION_REQUIRED', 'posts_journal', false);
  END;

  SELECT * INTO v_existing
  FROM public.import_fx_case_advances
  WHERE company_id = p_company_id AND client_operation_id = trim(p_client_operation_id)
  LIMIT 1;
  IF FOUND AND v_existing.status IN ('POSTED', 'REVERSED') THEN
    RETURN jsonb_build_object(
      'success', true, 'idempotent_replay', true, 'posts_journal', true,
      'event_id', v_existing.id, 'journal_entry_id', v_existing.journal_entry_id,
      'amount_pkr', v_existing.amount_pkr, 'remaining_unapplied_pkr', v_existing.remaining_unapplied_pkr,
      'accounting_status', (SELECT accounting_status FROM public.import_fx_cases WHERE id = p_case_id)
    );
  END IF;

  v_amount := round(COALESCE(p_amount_pkr, 0), 2);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_INVALID_AMOUNT', 'posts_journal', false);
  END IF;

  v_case := public._import_fx_w3_lock_case_for_money(p_company_id, p_case_id);
  IF p_branch_id IS NOT NULL AND v_case.branch_id IS NOT NULL AND p_branch_id IS DISTINCT FROM v_case.branch_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_BRANCH_MISMATCH', 'posts_journal', false);
  END IF;
  IF NOT public._import_fx_case_branch_row_allowed(v_case.branch_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED', 'posts_journal', false);
  END IF;

  SELECT id, type::text AS type, COALESCE(is_active, true) AS is_active
  INTO v_agent FROM public.contacts
  WHERE id = v_case.agent_contact_id AND company_id = p_company_id;
  IF v_agent.id IS NULL OR NOT v_agent.is_active OR lower(trim(COALESCE(v_agent.type, ''))) <> 'money_exchange' THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_AGENT_ROLE_REQUIRED', 'posts_journal', false);
  END IF;

  BEGIN
    PERFORM public._import_fx_w3_assert_payment_source(p_company_id, p_payment_source_account_id);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_PAYMENT_SOURCE_INVALID', 'posts_journal', false);
  END;

  v_clearing := public._import_fx_w3_get_clearing_account_id(p_company_id);
  BEGIN
    PERFORM public._import_fx_w3_assert_clearing_account(p_company_id, v_clearing);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_AGENT_ADVANCE_CLEARING_NOT_CONFIGURED', 'posts_journal', false);
  END;

  BEGIN
    v_entry_no := public.generate_document_number(
      p_company_id, public.erp_numbering_global_branch_sentinel(), 'manual_journal', false
    );
  EXCEPTION WHEN OTHERS THEN
    v_entry_no := 'IFXA-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || floor(random()*1000)::text;
  END;

  INSERT INTO public.import_fx_case_advances (
    company_id, branch_id, import_fx_case_id, agent_contact_id, status,
    posting_date, amount_pkr, remaining_unapplied_pkr, payment_source_account_id,
    clearing_account_id, external_reference, notes, fee_pkr, client_operation_id,
    created_by, posted_at
  ) VALUES (
    p_company_id, COALESCE(p_branch_id, v_case.branch_id), p_case_id, v_case.agent_contact_id, 'POSTED',
    COALESCE(p_posting_date, CURRENT_DATE), v_amount, v_amount, p_payment_source_account_id,
    v_clearing, NULLIF(trim(p_external_reference), ''), NULLIF(trim(p_notes), ''), NULL,
    trim(p_client_operation_id), p_created_by, now()
  )
  RETURNING id INTO v_adv_id;

  INSERT INTO public.journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by, document_no, total_debit, total_credit
  ) VALUES (
    p_company_id, COALESCE(p_branch_id, v_case.branch_id), v_entry_no,
    COALESCE(p_posting_date, CURRENT_DATE),
    format('Import FX agent advance %s PKR (case %s)', trim(to_char(v_amount, 'FM999999999990.00')), v_case.case_no),
    'import_fx_case_advance', v_adv_id, p_created_by, v_entry_no, v_amount, v_amount
  )
  RETURNING id INTO v_je_id;

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_je_id, v_clearing, v_amount, 0, 'Agent FX Advance / Settlement Clearing'),
    (v_je_id, p_payment_source_account_id, 0, v_amount, 'Cash/Bank for agent advance');

  UPDATE public.import_fx_case_advances SET journal_entry_id = v_je_id WHERE id = v_adv_id;

  INSERT INTO public.import_fx_client_operations (
    company_id, event_type, client_operation_id, journal_entry_id, result_json
  ) VALUES (
    p_company_id, 'w3_agent_advance', v_op, v_je_id,
    jsonb_build_object('event_id', v_adv_id, 'journal_entry_id', v_je_id, 'entry_no', v_entry_no)
  )
  ON CONFLICT (company_id, event_type, client_operation_id) DO NOTHING;

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, event_type, event_status, posts_journal, payload, created_by
  ) VALUES (
    p_company_id, p_case_id, 'W3_AGENT_ADVANCE_POSTED', 'CONFIRMED', true,
    jsonb_build_object('advance_id', v_adv_id, 'journal_entry_id', v_je_id, 'amount_pkr', v_amount),
    p_created_by
  );

  UPDATE public.import_fx_case_stages
  SET stage_status = 'IN_PROGRESS', updated_at = now()
  WHERE case_id = p_case_id AND stage_code = 'ADVANCE';

  PERFORM public._import_fx_w3_set_partially_posted(p_case_id);

  RETURN jsonb_build_object(
    'success', true, 'idempotent_replay', false, 'posts_journal', true,
    'event_id', v_adv_id, 'journal_entry_id', v_je_id, 'entry_no', v_entry_no,
    'amount_pkr', v_amount, 'remaining_unapplied_pkr', v_amount,
    'accounting_status', 'PARTIALLY_POSTED'
  );
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_existing FROM public.import_fx_case_advances
  WHERE company_id = p_company_id AND client_operation_id = trim(p_client_operation_id) LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'idempotent_replay', true, 'posts_journal', true,
      'event_id', v_existing.id, 'journal_entry_id', v_existing.journal_entry_id,
      'amount_pkr', v_existing.amount_pkr, 'remaining_unapplied_pkr', v_existing.remaining_unapplied_pkr,
      'accounting_status', (SELECT accounting_status FROM public.import_fx_cases WHERE id = p_case_id)
    );
  END IF;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_import_fx_agent_advance(uuid, uuid, uuid, date, numeric, uuid, text, text, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.post_import_fx_agent_advance(uuid, uuid, uuid, date, numeric, uuid, text, text, text, uuid) FROM PUBLIC, anon;
