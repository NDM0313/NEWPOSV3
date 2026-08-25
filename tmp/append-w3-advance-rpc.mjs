import fs from 'fs';

const parts = [];

parts.push(`
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
`);

// USD acquisition + reverse RPCs in companion file for maintainability
fs.appendFileSync(
  'migrations/20260813180000_import_fx_case_w3_advance_usd_acquisition.sql',
  parts.join('\n')
);
console.log('appended advance');
