-- W3.1: harden reverse_import_fx_usd_acquisition for custody routing.
-- - Debit credit reverse uses gl_debit_account_id (wallet may be NULL)
-- - Block when custody available_qty reduced or distribution lines exist beyond planned block
-- Additive successor — does not rewrite prior migrations.

BEGIN;

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
  v_gl uuid;
  v_custody record;
  v_prior jsonb;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);
  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'MULTI_CURRENCY_DISABLED');
  END IF;
  BEGIN v_op := trim(p_client_operation_id)::uuid; EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_CLIENT_OPERATION_REQUIRED');
  END;

  SELECT result_json INTO v_prior
  FROM public.import_fx_client_operations
  WHERE company_id = p_company_id
    AND event_type = 'w3_usd_acquisition_reverse'
    AND client_operation_id = v_op;
  IF v_prior IS NOT NULL THEN
    RETURN v_prior || jsonb_build_object('idempotent_replay', true, 'success', true);
  END IF;

  SELECT * INTO v_acq FROM public.import_fx_case_usd_acquisitions
  WHERE id = p_acquisition_id AND company_id = p_company_id FOR UPDATE;
  IF NOT FOUND OR v_acq.status <> 'POSTED' THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_ACQUISITION_NOT_REVERSIBLE');
  END IF;

  v_gl := COALESCE(v_acq.gl_debit_account_id, v_acq.destination_wallet_account_id);
  IF v_gl IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_ACQUISITION_NOT_REVERSIBLE',
      'error', 'Missing GL debit account on acquisition');
  END IF;

  -- Block if custody quantity already consumed by later waves
  IF to_regclass('public.import_fx_case_usd_custody_positions') IS NOT NULL THEN
    SELECT * INTO v_custody
    FROM public.import_fx_case_usd_custody_positions
    WHERE acquisition_id = v_acq.id
    FOR UPDATE;
    IF FOUND THEN
      IF v_custody.status = 'REVERSED' THEN
        RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_ACQUISITION_NOT_REVERSIBLE');
      END IF;
      IF v_custody.available_quantity < v_custody.quantity
         OR v_custody.status IN ('FULLY_DISTRIBUTED', 'CLOSED') THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'IMPORT_FX_CASE_CUSTODY_CONSUMED',
          'error', 'Custody/distribution already consumed; reverse dependents first'
        );
      END IF;
    END IF;
  END IF;

  -- Block if any distribution line marked executed (W4/W5 future)
  IF to_regclass('public.import_fx_case_distribution_lines') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.import_fx_case_distribution_lines dl
      JOIN public.import_fx_case_distribution_batches b ON b.id = dl.batch_id
      WHERE b.acquisition_id = v_acq.id
        AND (dl.executed_qty > 0 OR dl.status = 'EXECUTED' OR b.status = 'EXECUTED')
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'IMPORT_FX_CASE_DISTRIBUTION_CONSUMED',
        'error', 'Distribution already executed; reverse dependents first'
      );
    END IF;
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
    gl_debit_account_id, routing_mode, holder_contact_id,
    retained_usd_qty, distributed_usd_qty,
    status, acquisition_date, usd_quantity, pkr_per_usd, carrying_pkr, funding_type,
    advance_applied_pkr, agent_ap_created_pkr, client_operation_id,
    agent_ap_account_id, clearing_account_id, reversal_of_id, created_by, posted_at, reversed_at
  ) VALUES (
    v_acq.company_id, v_acq.branch_id, v_acq.import_fx_case_id, v_acq.agent_contact_id,
    v_acq.destination_wallet_account_id,
    v_gl, COALESCE(v_acq.routing_mode, 'COMPANY_WALLET'), v_acq.holder_contact_id,
    COALESCE(v_acq.retained_usd_qty, v_acq.usd_quantity), COALESCE(v_acq.distributed_usd_qty, 0),
    'REVERSED', CURRENT_DATE,
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

  IF v_acq.advance_applied_pkr > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je_id, v_acq.clearing_account_id, v_acq.advance_applied_pkr, 0, 'Restore clearing');
  END IF;
  IF v_acq.agent_ap_created_pkr > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je_id, v_acq.agent_ap_account_id, v_acq.agent_ap_created_pkr, 0, 'Restore Agent AP');
  END IF;
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_je_id, v_gl, 0, v_acq.carrying_pkr, 'Reverse USD custody/wallet carrying');

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

  IF v_lot.id IS NOT NULL THEN
    UPDATE public.import_fx_case_usd_lots
    SET status = 'REVERSED', usd_remaining_qty = 0, pkr_remaining_carrying = 0, reversed_at = now()
    WHERE acquisition_id = v_acq.id AND status = 'ACTIVE';
  END IF;

  IF to_regclass('public.import_fx_case_usd_custody_positions') IS NOT NULL THEN
    UPDATE public.import_fx_case_usd_custody_positions
    SET status = 'REVERSED',
        available_quantity = 0,
        available_pkr_carrying_value = 0,
        updated_at = now()
    WHERE acquisition_id = v_acq.id AND status = 'ACTIVE';
  END IF;

  IF to_regclass('public.import_fx_case_distribution_batches') IS NOT NULL THEN
    UPDATE public.import_fx_case_distribution_lines dl
    SET status = 'CANCELLED'
    FROM public.import_fx_case_distribution_batches b
    WHERE b.id = dl.batch_id AND b.acquisition_id = v_acq.id
      AND dl.status IN ('DRAFT', 'READY', 'EXECUTION_BLOCKED');
    UPDATE public.import_fx_case_distribution_batches
    SET status = 'CANCELLED', updated_at = now()
    WHERE acquisition_id = v_acq.id
      AND status IN ('DRAFT', 'READY', 'EXECUTION_BLOCKED');
  END IF;

  UPDATE public.import_fx_case_usd_acquisitions
  SET status = 'REVERSED', reversed_by_id = v_rev_id, reversed_at = now()
  WHERE id = v_acq.id;

  UPDATE public.import_fx_case_usd_acquisitions SET journal_entry_id = v_je_id WHERE id = v_rev_id;

  INSERT INTO public.import_fx_client_operations (
    company_id, event_type, client_operation_id, journal_entry_id, result_json
  ) VALUES (
    p_company_id, 'w3_usd_acquisition_reverse', v_op, v_je_id,
    jsonb_build_object(
      'success', true, 'posts_journal', true,
      'reversed_acquisition_id', v_acq.id, 'reversal_id', v_rev_id,
      'journal_entry_id', v_je_id
    )
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

COMMIT;
