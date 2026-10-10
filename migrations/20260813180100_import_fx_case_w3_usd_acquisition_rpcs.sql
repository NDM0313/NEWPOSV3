-- Wave W3 part 2: USD acquisition + reversals (additive).
-- Companion to 20260813180000_import_fx_case_w3_advance_usd_acquisition.sql

CREATE OR REPLACE FUNCTION public.post_import_fx_usd_acquisition(
  p_company_id uuid,
  p_branch_id uuid,
  p_case_id uuid,
  p_acquisition_date date,
  p_usd_quantity numeric,
  p_pkr_per_usd numeric,
  p_destination_wallet_account_id uuid,
  p_funding_type text,
  p_advance_applied_pkr numeric DEFAULT NULL,
  p_manual_advance_allocations jsonb DEFAULT NULL,
  p_use_fifo boolean DEFAULT true,
  p_external_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_fee_pkr numeric DEFAULT NULL,
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
  v_existing public.import_fx_case_usd_acquisitions%ROWTYPE;
  v_funding text;
  v_usd numeric(18,6);
  v_rate numeric(18,8);
  v_carry numeric(18,2);
  v_adv_apply numeric(18,2);
  v_ap_create numeric(18,2);
  v_wallet record;
  v_agent record;
  v_ap_id uuid;
  v_clearing uuid;
  v_entry_no text;
  v_je_id uuid;
  v_acq_id uuid;
  v_op uuid;
  v_need numeric(18,2);
  v_adv record;
  v_take numeric(18,2);
  v_ord int := 0;
  v_manual jsonb;
  v_row jsonb;
  v_adv_id uuid;
  v_unapplied numeric(18,2);
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

  IF p_fee_pkr IS NOT NULL AND round(p_fee_pkr, 2) <> 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_FEE_NOT_ALLOWED', 'posts_journal', false);
  END IF;

  SELECT * INTO v_existing
  FROM public.import_fx_case_usd_acquisitions
  WHERE company_id = p_company_id AND client_operation_id = trim(p_client_operation_id)
  LIMIT 1;
  IF FOUND AND v_existing.status IN ('POSTED', 'REVERSED') THEN
    RETURN jsonb_build_object(
      'success', true, 'idempotent_replay', true, 'posts_journal', true,
      'event_id', v_existing.id, 'journal_entry_id', v_existing.journal_entry_id,
      'usd_quantity', v_existing.usd_quantity, 'carrying_pkr', v_existing.carrying_pkr,
      'accounting_status', (SELECT accounting_status FROM public.import_fx_cases WHERE id = p_case_id)
    );
  END IF;

  v_funding := upper(trim(COALESCE(p_funding_type, '')));
  IF v_funding NOT IN ('ADVANCE', 'CREDIT', 'MIXED') THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_INVALID_FUNDING_TYPE', 'posts_journal', false);
  END IF;

  v_usd := round(COALESCE(p_usd_quantity, 0)::numeric, 6);
  v_rate := COALESCE(p_pkr_per_usd, 0);
  IF v_usd <= 0 OR v_rate <= 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_INVALID_AMOUNT', 'posts_journal', false);
  END IF;
  v_carry := round(v_usd * v_rate, 2);
  IF v_carry <= 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_INVALID_AMOUNT', 'posts_journal', false);
  END IF;

  v_case := public._import_fx_w3_lock_case_for_money(p_company_id, p_case_id);
  IF NOT public._import_fx_case_branch_row_allowed(v_case.branch_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED', 'posts_journal', false);
  END IF;

  SELECT id, type::text AS type, COALESCE(is_active, true) AS is_active
  INTO v_agent FROM public.contacts
  WHERE id = v_case.agent_contact_id AND company_id = p_company_id;
  IF v_agent.id IS NULL OR NOT v_agent.is_active OR lower(trim(COALESCE(v_agent.type, ''))) <> 'money_exchange' THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_AGENT_ROLE_REQUIRED', 'posts_journal', false);
  END IF;

  SELECT id, code, name, company_id, COALESCE(is_active, true) AS is_active
  INTO v_wallet FROM public.accounts
  WHERE id = p_destination_wallet_account_id AND company_id = p_company_id;
  IF v_wallet.id IS NULL OR NOT v_wallet.is_active THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_WALLET_NOT_TT', 'posts_journal', false);
  END IF;
  IF NOT public._is_tt_agent_wallet_account(v_wallet.code, v_wallet.name) THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_WALLET_NOT_TT', 'posts_journal', false);
  END IF;

  -- Funding split
  IF v_funding = 'CREDIT' THEN
    v_adv_apply := 0;
    v_ap_create := v_carry;
  ELSIF v_funding = 'ADVANCE' THEN
    v_adv_apply := v_carry;
    v_ap_create := 0;
  ELSE
    v_adv_apply := round(COALESCE(p_advance_applied_pkr, 0), 2);
    IF v_adv_apply < 0 OR v_adv_apply > v_carry THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_INVALID_AMOUNT', 'posts_journal', false);
    END IF;
    v_ap_create := round(v_carry - v_adv_apply, 2);
  END IF;

  IF v_adv_apply > 0 THEN
    v_clearing := public._import_fx_w3_get_clearing_account_id(p_company_id);
    BEGIN
      PERFORM public._import_fx_w3_assert_clearing_account(p_company_id, v_clearing);
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_AGENT_ADVANCE_CLEARING_NOT_CONFIGURED', 'posts_journal', false);
    END;
  END IF;

  IF v_ap_create > 0 THEN
    v_ap_id := public._ensure_ap_subaccount_for_contact(p_company_id, v_case.agent_contact_id);
    IF v_ap_id IS NULL OR public._is_account_control_code(v_ap_id, '2000') THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_AGENT_AP_UNRESOLVED', 'posts_journal', false);
    END IF;
  END IF;

  -- Lock and allocate advances
  IF v_adv_apply > 0 THEN
    SELECT COALESCE(sum(remaining_unapplied_pkr), 0) INTO v_unapplied
    FROM public.import_fx_case_advances
    WHERE import_fx_case_id = p_case_id AND status = 'POSTED' AND remaining_unapplied_pkr > 0
    FOR UPDATE;
    IF v_unapplied < v_adv_apply THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_INSUFFICIENT_ADVANCE', 'posts_journal', false);
    END IF;
  END IF;

  BEGIN
    v_entry_no := public.generate_document_number(
      p_company_id, public.erp_numbering_global_branch_sentinel(), 'manual_journal', false
    );
  EXCEPTION WHEN OTHERS THEN
    v_entry_no := 'IFXU-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || floor(random()*1000)::text;
  END;

  INSERT INTO public.import_fx_case_usd_acquisitions (
    company_id, branch_id, import_fx_case_id, agent_contact_id, destination_wallet_account_id,
    status, acquisition_date, usd_quantity, pkr_per_usd, carrying_pkr, funding_type,
    advance_applied_pkr, agent_ap_created_pkr, fee_pkr, external_reference, notes,
    client_operation_id, agent_ap_account_id, clearing_account_id, created_by, posted_at
  ) VALUES (
    p_company_id, COALESCE(p_branch_id, v_case.branch_id), p_case_id, v_case.agent_contact_id,
    p_destination_wallet_account_id, 'POSTED', COALESCE(p_acquisition_date, CURRENT_DATE),
    v_usd, v_rate, v_carry, v_funding, v_adv_apply, v_ap_create, NULL,
    NULLIF(trim(p_external_reference), ''), NULLIF(trim(p_notes), ''),
    trim(p_client_operation_id), v_ap_id, v_clearing, p_created_by, now()
  )
  RETURNING id INTO v_acq_id;

  -- Apply advances (FIFO or manual)
  IF v_adv_apply > 0 THEN
    v_need := v_adv_apply;
    v_manual := COALESCE(p_manual_advance_allocations, '[]'::jsonb);
    IF COALESCE(p_use_fifo, true) OR jsonb_array_length(v_manual) = 0 THEN
      FOR v_adv IN
        SELECT * FROM public.import_fx_case_advances
        WHERE import_fx_case_id = p_case_id AND status = 'POSTED' AND remaining_unapplied_pkr > 0
          AND agent_contact_id = v_case.agent_contact_id
        ORDER BY posted_at ASC, created_at ASC
        FOR UPDATE
      LOOP
        EXIT WHEN v_need <= 0;
        v_take := LEAST(v_adv.remaining_unapplied_pkr, v_need);
        v_ord := v_ord + 1;
        UPDATE public.import_fx_case_advances
        SET remaining_unapplied_pkr = remaining_unapplied_pkr - v_take
        WHERE id = v_adv.id;
        INSERT INTO public.import_fx_case_advance_applications (
          company_id, import_fx_case_id, advance_id, acquisition_id, applied_pkr, application_order, status
        ) VALUES (p_company_id, p_case_id, v_adv.id, v_acq_id, v_take, v_ord, 'POSTED');
        v_need := round(v_need - v_take, 2);
      END LOOP;
    ELSE
      FOR v_row IN SELECT * FROM jsonb_array_elements(v_manual)
      LOOP
        v_adv_id := (v_row->>'advance_id')::uuid;
        v_take := round(COALESCE((v_row->>'applied_pkr')::numeric, 0), 2);
        IF v_take <= 0 THEN CONTINUE; END IF;
        SELECT * INTO v_adv FROM public.import_fx_case_advances
        WHERE id = v_adv_id AND import_fx_case_id = p_case_id AND company_id = p_company_id
          AND status = 'POSTED' AND agent_contact_id = v_case.agent_contact_id
        FOR UPDATE;
        IF NOT FOUND OR v_adv.remaining_unapplied_pkr < v_take THEN
          RAISE EXCEPTION 'IMPORT_FX_CASE_MANUAL_ADVANCE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        v_ord := v_ord + 1;
        UPDATE public.import_fx_case_advances
        SET remaining_unapplied_pkr = remaining_unapplied_pkr - v_take
        WHERE id = v_adv.id;
        INSERT INTO public.import_fx_case_advance_applications (
          company_id, import_fx_case_id, advance_id, acquisition_id, applied_pkr, application_order, status
        ) VALUES (p_company_id, p_case_id, v_adv.id, v_acq_id, v_take, v_ord, 'POSTED');
        v_need := round(COALESCE(v_need, v_adv_apply) - v_take, 2);
      END LOOP;
      IF round(COALESCE((
        SELECT sum(applied_pkr) FROM public.import_fx_case_advance_applications
        WHERE acquisition_id = v_acq_id AND status = 'POSTED'
      ), 0), 2) <> v_adv_apply THEN
        RAISE EXCEPTION 'IMPORT_FX_CASE_MANUAL_ADVANCE_INVALID' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by, document_no, total_debit, total_credit
  ) VALUES (
    p_company_id, COALESCE(p_branch_id, v_case.branch_id), v_entry_no,
    COALESCE(p_acquisition_date, CURRENT_DATE),
    format('Import FX USD acquisition %s @ %s (case %s)',
      trim(to_char(v_usd, 'FM999999999990.######')),
      trim(to_char(v_rate, 'FM999999999990.########')),
      v_case.case_no),
    'import_fx_case_usd_acquisition', v_acq_id, p_created_by, v_entry_no, v_carry, v_carry
  )
  RETURNING id INTO v_je_id;

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_je_id, p_destination_wallet_account_id, v_carry, 0, 'USD/TT wallet carrying PKR');

  IF v_adv_apply > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je_id, v_clearing, 0, v_adv_apply, 'Apply Agent FX Advance Clearing');
  END IF;
  IF v_ap_create > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je_id, v_ap_id, 0, v_ap_create, 'Agent AP for USD on credit');
  END IF;

  UPDATE public.import_fx_case_usd_acquisitions SET journal_entry_id = v_je_id WHERE id = v_acq_id;

  INSERT INTO public.import_fx_case_usd_lots (
    company_id, import_fx_case_id, acquisition_id, wallet_account_id, status,
    usd_original_qty, usd_remaining_qty, pkr_original_carrying, pkr_remaining_carrying, effective_pkr_per_usd
  ) VALUES (
    p_company_id, p_case_id, v_acq_id, p_destination_wallet_account_id, 'ACTIVE',
    v_usd, v_usd, v_carry, v_carry, v_rate
  );

  INSERT INTO public.import_fx_client_operations (
    company_id, event_type, client_operation_id, journal_entry_id, result_json
  ) VALUES (
    p_company_id, 'w3_usd_acquisition', v_op, v_je_id,
    jsonb_build_object('event_id', v_acq_id, 'journal_entry_id', v_je_id, 'carrying_pkr', v_carry)
  )
  ON CONFLICT (company_id, event_type, client_operation_id) DO NOTHING;

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, event_type, event_status, posts_journal, payload, created_by
  ) VALUES (
    p_company_id, p_case_id, 'W3_USD_ACQUISITION_POSTED', 'CONFIRMED', true,
    jsonb_build_object(
      'acquisition_id', v_acq_id, 'journal_entry_id', v_je_id,
      'usd_quantity', v_usd, 'carrying_pkr', v_carry, 'funding_type', v_funding
    ),
    p_created_by
  );

  UPDATE public.import_fx_case_stages
  SET stage_status = 'IN_PROGRESS', updated_at = now()
  WHERE case_id = p_case_id AND stage_code = 'USD_ACQUISITION';

  PERFORM public._import_fx_w3_set_partially_posted(p_case_id);

  RETURN jsonb_build_object(
    'success', true, 'idempotent_replay', false, 'posts_journal', true,
    'event_id', v_acq_id, 'journal_entry_id', v_je_id, 'entry_no', v_entry_no,
    'usd_quantity', v_usd, 'carrying_pkr', v_carry,
    'advance_applied_pkr', v_adv_apply, 'agent_ap_created_pkr', v_ap_create,
    'accounting_status', 'PARTIALLY_POSTED'
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing FROM public.import_fx_case_usd_acquisitions
    WHERE company_id = p_company_id AND client_operation_id = trim(p_client_operation_id) LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent_replay', true, 'posts_journal', true,
        'event_id', v_existing.id, 'journal_entry_id', v_existing.journal_entry_id,
        'usd_quantity', v_existing.usd_quantity, 'carrying_pkr', v_existing.carrying_pkr,
        'accounting_status', (SELECT accounting_status FROM public.import_fx_cases WHERE id = p_case_id)
      );
    END IF;
    RAISE;
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'IMPORT_FX_%' THEN
      RETURN jsonb_build_object('success', false, 'code', split_part(SQLERRM, ':', 1), 'error', SQLERRM, 'posts_journal', false);
    END IF;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_import_fx_usd_acquisition(
  uuid, uuid, uuid, date, numeric, numeric, uuid, text, numeric, jsonb, boolean, text, text, numeric, text, uuid
) TO authenticated;
REVOKE ALL ON FUNCTION public.post_import_fx_usd_acquisition(
  uuid, uuid, uuid, date, numeric, numeric, uuid, text, numeric, jsonb, boolean, text, text, numeric, text, uuid
) FROM PUBLIC, anon;

-- Reverse advance (blocked if applications remain)
CREATE OR REPLACE FUNCTION public.reverse_import_fx_agent_advance(
  p_company_id uuid,
  p_advance_id uuid,
  p_client_operation_id text,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adv public.import_fx_case_advances%ROWTYPE;
  v_apps int;
  v_entry_no text;
  v_je_id uuid;
  v_rev_id uuid;
  v_op uuid;
  v_status text;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);
  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'MULTI_CURRENCY_DISABLED');
  END IF;
  BEGIN v_op := trim(p_client_operation_id)::uuid; EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_CLIENT_OPERATION_REQUIRED');
  END;

  SELECT * INTO v_adv FROM public.import_fx_case_advances
  WHERE id = p_advance_id AND company_id = p_company_id FOR UPDATE;
  IF NOT FOUND OR v_adv.status <> 'POSTED' THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_ADVANCE_NOT_REVERSIBLE');
  END IF;

  SELECT count(*) INTO v_apps FROM public.import_fx_case_advance_applications
  WHERE advance_id = v_adv.id AND status = 'POSTED';
  IF v_apps > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'IMPORT_FX_CASE_ADVANCE_HAS_APPLICATIONS',
      'error', 'Reverse USD acquisitions that consume this advance first'
    );
  END IF;

  BEGIN
    v_entry_no := public.generate_document_number(
      p_company_id, public.erp_numbering_global_branch_sentinel(), 'manual_journal', false
    );
  EXCEPTION WHEN OTHERS THEN
    v_entry_no := 'IFXAR-' || to_char(now(), 'YYYYMMDDHH24MISS');
  END;

  INSERT INTO public.import_fx_case_advances (
    company_id, branch_id, import_fx_case_id, agent_contact_id, status,
    posting_date, amount_pkr, remaining_unapplied_pkr, payment_source_account_id,
    clearing_account_id, external_reference, notes, client_operation_id,
    reversal_of_id, created_by, posted_at, reversed_at
  ) VALUES (
    v_adv.company_id, v_adv.branch_id, v_adv.import_fx_case_id, v_adv.agent_contact_id, 'REVERSED',
    CURRENT_DATE, v_adv.amount_pkr, 0, v_adv.payment_source_account_id,
    v_adv.clearing_account_id, v_adv.external_reference, 'Reversal', trim(p_client_operation_id),
    v_adv.id, p_created_by, now(), now()
  ) RETURNING id INTO v_rev_id;

  INSERT INTO public.journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by, document_no, total_debit, total_credit
  ) VALUES (
    v_adv.company_id, v_adv.branch_id, v_entry_no, CURRENT_DATE,
    'Reverse Import FX agent advance',
    'import_fx_case_advance_reverse', v_rev_id, p_created_by, v_entry_no,
    v_adv.amount_pkr, v_adv.amount_pkr
  ) RETURNING id INTO v_je_id;

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_je_id, v_adv.payment_source_account_id, v_adv.amount_pkr, 0, 'Reverse cash/bank'),
    (v_je_id, v_adv.clearing_account_id, 0, v_adv.amount_pkr, 'Reverse clearing');

  UPDATE public.import_fx_case_advances
  SET status = 'REVERSED', reversed_by_id = v_rev_id, reversed_at = now(),
      remaining_unapplied_pkr = 0, journal_entry_id = COALESCE(journal_entry_id, v_je_id)
  WHERE id = v_adv.id;

  UPDATE public.import_fx_case_advances SET journal_entry_id = v_je_id WHERE id = v_rev_id;

  INSERT INTO public.import_fx_client_operations (
    company_id, event_type, client_operation_id, journal_entry_id, result_json
  ) VALUES (
    p_company_id, 'w3_agent_advance_reverse', v_op, v_je_id,
    jsonb_build_object('reversed_advance_id', v_adv.id, 'reversal_id', v_rev_id)
  ) ON CONFLICT (company_id, event_type, client_operation_id) DO NOTHING;

  v_status := public._import_fx_w3_recompute_accounting_status(v_adv.import_fx_case_id);

  RETURN jsonb_build_object(
    'success', true, 'posts_journal', true, 'reversal_id', v_rev_id,
    'journal_entry_id', v_je_id, 'accounting_status', v_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_import_fx_agent_advance(uuid, uuid, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.reverse_import_fx_agent_advance(uuid, uuid, text, uuid) FROM PUBLIC, anon;

-- Reverse USD acquisition (blocked if lot remaining < original i.e. consumed)
CREATE OR REPLACE FUNCTION public.reverse_import_fx_usd_acquisition(
  p_company_id uuid,
  p_acquisition_id uuid,
  p_client_operation_id text,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acq public.import_fx_case_usd_acquisitions%ROWTYPE;
  v_lot public.import_fx_case_usd_lots%ROWTYPE;
  v_app record;
  v_entry_no text;
  v_je_id uuid;
  v_rev_id uuid;
  v_op uuid;
  v_status text;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);
  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'MULTI_CURRENCY_DISABLED');
  END IF;
  BEGIN v_op := trim(p_client_operation_id)::uuid; EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_CLIENT_OPERATION_REQUIRED');
  END;

  SELECT * INTO v_acq FROM public.import_fx_case_usd_acquisitions
  WHERE id = p_acquisition_id AND company_id = p_company_id FOR UPDATE;
  IF NOT FOUND OR v_acq.status <> 'POSTED' THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_ACQUISITION_NOT_REVERSIBLE');
  END IF;

  SELECT * INTO v_lot FROM public.import_fx_case_usd_lots
  WHERE acquisition_id = v_acq.id AND status = 'ACTIVE' FOR UPDATE;
  IF FOUND AND (v_lot.usd_remaining_qty < v_lot.usd_original_qty OR v_lot.status = 'CONSUMED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'IMPORT_FX_CASE_LOT_CONSUMED',
      'error', 'USD lot partially/fully consumed by a later wave; reverse dependents first'
    );
  END IF;

  BEGIN
    v_entry_no := public.generate_document_number(
      p_company_id, public.erp_numbering_global_branch_sentinel(), 'manual_journal', false
    );
  EXCEPTION WHEN OTHERS THEN
    v_entry_no := 'IFXUR-' || to_char(now(), 'YYYYMMDDHH24MISS');
  END;

  INSERT INTO public.import_fx_case_usd_acquisitions (
    company_id, branch_id, import_fx_case_id, agent_contact_id, destination_wallet_account_id,
    status, acquisition_date, usd_quantity, pkr_per_usd, carrying_pkr, funding_type,
    advance_applied_pkr, agent_ap_created_pkr, client_operation_id,
    agent_ap_account_id, clearing_account_id, reversal_of_id, created_by, posted_at, reversed_at
  ) VALUES (
    v_acq.company_id, v_acq.branch_id, v_acq.import_fx_case_id, v_acq.agent_contact_id,
    v_acq.destination_wallet_account_id, 'REVERSED', CURRENT_DATE,
    v_acq.usd_quantity, v_acq.pkr_per_usd, v_acq.carrying_pkr, v_acq.funding_type,
    v_acq.advance_applied_pkr, v_acq.agent_ap_created_pkr, trim(p_client_operation_id),
    v_acq.agent_ap_account_id, v_acq.clearing_account_id, v_acq.id, p_created_by, now(), now()
  ) RETURNING id INTO v_rev_id;

  INSERT INTO public.journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by, document_no, total_debit, total_credit
  ) VALUES (
    v_acq.company_id, v_acq.branch_id, v_entry_no, CURRENT_DATE,
    'Reverse Import FX USD acquisition',
    'import_fx_case_usd_acquisition_reverse', v_rev_id, p_created_by, v_entry_no,
    v_acq.carrying_pkr, v_acq.carrying_pkr
  ) RETURNING id INTO v_je_id;

  -- Invert original legs
  IF v_acq.advance_applied_pkr > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je_id, v_acq.clearing_account_id, v_acq.advance_applied_pkr, 0, 'Restore clearing');
  END IF;
  IF v_acq.agent_ap_created_pkr > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je_id, v_acq.agent_ap_account_id, v_acq.agent_ap_created_pkr, 0, 'Restore Agent AP');
  END IF;
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_je_id, v_acq.destination_wallet_account_id, 0, v_acq.carrying_pkr, 'Reverse USD wallet');

  -- Restore advance applications
  FOR v_app IN
    SELECT * FROM public.import_fx_case_advance_applications
    WHERE acquisition_id = v_acq.id AND status = 'POSTED'
    FOR UPDATE
  LOOP
    UPDATE public.import_fx_case_advances
    SET remaining_unapplied_pkr = remaining_unapplied_pkr + v_app.applied_pkr
    WHERE id = v_app.advance_id;
    UPDATE public.import_fx_case_advance_applications
    SET status = 'REVERSED', reversed_at = now()
    WHERE id = v_app.id;
  END LOOP;

  IF FOUND OR v_lot.id IS NOT NULL THEN
    UPDATE public.import_fx_case_usd_lots
    SET status = 'REVERSED', usd_remaining_qty = 0, pkr_remaining_carrying = 0, reversed_at = now()
    WHERE acquisition_id = v_acq.id AND status = 'ACTIVE';
  END IF;

  UPDATE public.import_fx_case_usd_acquisitions
  SET status = 'REVERSED', reversed_by_id = v_rev_id, reversed_at = now()
  WHERE id = v_acq.id;

  UPDATE public.import_fx_case_usd_acquisitions SET journal_entry_id = v_je_id WHERE id = v_rev_id;

  INSERT INTO public.import_fx_client_operations (
    company_id, event_type, client_operation_id, journal_entry_id, result_json
  ) VALUES (
    p_company_id, 'w3_usd_acquisition_reverse', v_op, v_je_id,
    jsonb_build_object('reversed_acquisition_id', v_acq.id, 'reversal_id', v_rev_id)
  ) ON CONFLICT (company_id, event_type, client_operation_id) DO NOTHING;

  v_status := public._import_fx_w3_recompute_accounting_status(v_acq.import_fx_case_id);

  RETURN jsonb_build_object(
    'success', true, 'posts_journal', true, 'reversal_id', v_rev_id,
    'journal_entry_id', v_je_id, 'accounting_status', v_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_import_fx_usd_acquisition(uuid, uuid, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.reverse_import_fx_usd_acquisition(uuid, uuid, text, uuid) FROM PUBLIC, anon;
