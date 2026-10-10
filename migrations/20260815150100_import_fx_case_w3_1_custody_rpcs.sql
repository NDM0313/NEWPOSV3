-- W3.1 RPCs: custody control helper, capability bump, acquisition-with-routing.
-- Posts journal only for USD acquisition GL (wallet or settings-mapped custody control).
-- Distribution lines are operational / EXECUTION_BLOCKED for W4/W5 purposes.

CREATE OR REPLACE FUNCTION public._import_fx_w31_get_custody_control_account_id(p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_raw text;
  v_id uuid;
BEGIN
  SELECT NULLIF(trim(COALESCE(bs.accounting_settings->>'importFxUsdCustodyControlAccountId', '')), '')
  INTO v_raw
  FROM public.business_settings bs
  WHERE bs.company_id = p_company_id
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

REVOKE ALL ON FUNCTION public._import_fx_w31_get_custody_control_account_id(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._import_fx_w31_assert_custody_control(p_company_id uuid, p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_acc RECORD;
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_USD_CUSTODY_CONTROL_NOT_CONFIGURED: Set Import FX USD Custody Control in Settings'
      USING ERRCODE = 'P0001';
  END IF;
  SELECT id, code, name, type, subtype, company_id, COALESCE(is_group, false) AS is_group,
         COALESCE(is_active, true) AS is_active
  INTO v_acc FROM public.accounts
  WHERE id = p_account_id AND company_id = p_company_id;
  IF v_acc.id IS NULL OR NOT v_acc.is_active OR v_acc.is_group THEN
    RAISE EXCEPTION 'IMPORT_FX_USD_CUSTODY_CONTROL_NOT_CONFIGURED: Control account missing/inactive/group'
      USING ERRCODE = 'P0001';
  END IF;
  IF lower(trim(COALESCE(v_acc.type, ''))) NOT IN ('asset', 'current_asset', 'current asset')
     AND lower(trim(COALESCE(v_acc.subtype, ''))) NOT IN ('asset', 'current_asset', 'bank', 'cash', 'other_current_asset') THEN
    -- allow asset-like; still reject known forbidden
    NULL;
  END IF;
  IF public._is_tt_agent_wallet_account(v_acc.code, v_acc.name) THEN
    -- TT wallets OK as company wallet destination, but custody control should be a mapped control asset.
    -- Allow TT wallet only when routing is COMPANY_WALLET (caller decides).
    NULL;
  END IF;
  IF left(regexp_replace(COALESCE(v_acc.code, ''), '[^0-9]', '', 'g'), 4) IN ('1180', '1395', '2295', '6100', '7100') THEN
    RAISE EXCEPTION 'IMPORT_FX_USD_CUSTODY_CONTROL_NOT_CONFIGURED: Forbidden CoA family'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._import_fx_w31_assert_custody_control(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.import_fx_w3_capability()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_w31 boolean := false;
BEGIN
  v_w31 := to_regclass('public.import_fx_case_usd_custody_positions') IS NOT NULL
    AND to_regclass('public.import_fx_case_distribution_batches') IS NOT NULL;
  RETURN jsonb_build_object(
    'success', true,
    'installed', true,
    'version', CASE WHEN v_w31 THEN 'w3.1' ELSE 'w3' END,
    'custody_routing', v_w31,
    'posts_journal_supported', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_fx_w3_capability() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._import_fx_w31_purpose_requires_wave(p_purpose text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(trim(COALESCE(p_purpose, '')))
    WHEN 'CONVERSION_COUNTERPARTY' THEN 'W4'
    WHEN 'SUPPLIER_INVOICE_SETTLEMENT' THEN 'W5'
    WHEN 'SUPPLIER_ADVANCE' THEN 'W5'
    WHEN 'CUSTOMER_REFUND' THEN 'LATER'
    WHEN 'EXPENSE_PAYMENT_ON_BEHALF' THEN 'LATER'
    WHEN 'BRANCH_OR_INTERCOMPANY_TRANSFER' THEN 'LATER'
    WHEN 'OTHER_REVIEW_REQUIRED' THEN 'REVIEW'
    WHEN 'THIRD_PARTY_CUSTODY' THEN NULL
    ELSE 'REVIEW'
  END;
$$;

-- ---------------------------------------------------------------------------
-- post_import_fx_usd_acquisition_with_routing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_import_fx_usd_acquisition_with_routing(
  p_company_id uuid,
  p_branch_id uuid,
  p_case_id uuid,
  p_acquisition_date date,
  p_usd_quantity numeric,
  p_pkr_per_usd numeric,
  p_routing_mode text,
  p_destination_wallet_account_id uuid DEFAULT NULL,
  p_holder_contact_id uuid DEFAULT NULL,
  p_retained_usd_qty numeric DEFAULT NULL,
  p_distribution_rows jsonb DEFAULT '[]'::jsonb,
  p_funding_type text DEFAULT 'CREDIT',
  p_advance_applied_pkr numeric DEFAULT NULL,
  p_manual_advance_allocations jsonb DEFAULT '[]'::jsonb,
  p_use_fifo boolean DEFAULT true,
  p_external_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_client_operation_id text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_op text := trim(COALESCE(p_client_operation_id, ''));
  v_prior jsonb;
  v_case public.import_fx_cases%ROWTYPE;
  v_agent RECORD;
  v_holder RECORD;
  v_wallet RECORD;
  v_gl_id uuid;
  v_routing text := upper(trim(COALESCE(p_routing_mode, 'COMPANY_WALLET')));
  v_funding text := upper(trim(COALESCE(p_funding_type, 'CREDIT')));
  v_usd numeric(18, 6);
  v_rate numeric(18, 8);
  v_carry numeric(18, 2);
  v_retained numeric(18, 6);
  v_distributed numeric(18, 6) := 0;
  v_adv_apply numeric(18, 2) := 0;
  v_ap_create numeric(18, 2) := 0;
  v_clearing uuid;
  v_ap_id uuid;
  v_unapplied numeric(18, 2);
  v_entry_no text;
  v_je_id uuid;
  v_acq_id uuid;
  v_lot_id uuid;
  v_custody_id uuid;
  v_batch_id uuid;
  v_adv RECORD;
  v_row jsonb;
  v_need numeric(18, 2);
  v_take numeric(18, 2);
  v_ord int := 0;
  v_manual jsonb;
  v_adv_id uuid;
  v_purpose text;
  v_wave text;
  v_line_qty numeric(18, 6);
  v_line_pkr numeric(18, 2);
  v_rec_id uuid;
  v_purchase_id uuid;
  v_status_batch text := 'EXECUTION_BLOCKED';
  v_any_blocked boolean := false;
  v_holder_type text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHENTICATED', 'posts_journal', false);
  END IF;
  IF NOT public._import_fx_case_assert_company_access(p_company_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_COMPANY_ACCESS_DENIED', 'posts_journal', false);
  END IF;
  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'MULTI_CURRENCY_DISABLED', 'posts_journal', false);
  END IF;
  IF to_regclass('public.import_fx_case_usd_custody_positions') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'W31_NOT_INSTALLED', 'posts_journal', false);
  END IF;
  IF v_op = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_CLIENT_OP_REQUIRED', 'posts_journal', false);
  END IF;
  IF v_funding NOT IN ('ADVANCE', 'CREDIT', 'MIXED') THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_INVALID_FUNDING', 'posts_journal', false);
  END IF;
  IF v_routing NOT IN (
    'COMPANY_WALLET', 'AGENT_CUSTODY', 'THIRD_PARTY_CUSTODY', 'DIRECT_DISTRIBUTION', 'SPLIT_HOLD_AND_DISTRIBUTE'
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_INVALID_ROUTING', 'posts_journal', false);
  END IF;

  SELECT result_json INTO v_prior
  FROM public.import_fx_client_operations
  WHERE company_id = p_company_id AND event_type = 'w3_usd_acquisition' AND client_operation_id = v_op;
  IF FOUND THEN
    RETURN COALESCE(v_prior, '{}'::jsonb) || jsonb_build_object('success', true, 'idempotent_replay', true, 'posts_journal', true);
  END IF;

  v_usd := round(COALESCE(p_usd_quantity, 0)::numeric, 6);
  v_rate := COALESCE(p_pkr_per_usd, 0);
  IF v_usd <= 0 OR v_rate <= 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_INVALID_AMOUNT', 'posts_journal', false);
  END IF;
  v_carry := round(v_usd * v_rate, 2);

  -- Distribution sum
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(p_distribution_rows, '[]'::jsonb))
  LOOP
    v_line_qty := round(COALESCE((v_row->>'usd_qty')::numeric, (v_row->>'instructed_qty')::numeric, 0), 6);
    IF v_line_qty <= 0 THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_INVALID_DISTRIBUTION', 'posts_journal', false);
    END IF;
    v_distributed := round(v_distributed + v_line_qty, 6);
  END LOOP;

  IF v_routing = 'COMPANY_WALLET' THEN
    v_retained := v_usd;
    v_distributed := 0;
  ELSIF v_routing = 'AGENT_CUSTODY' OR v_routing = 'THIRD_PARTY_CUSTODY' THEN
    v_retained := v_usd;
    IF v_distributed <> 0 THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_INVALID_DISTRIBUTION', 'posts_journal', false);
    END IF;
  ELSIF v_routing = 'DIRECT_DISTRIBUTION' THEN
    v_retained := 0;
    IF round(v_distributed, 6) <> round(v_usd, 6) THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_UNALLOCATED_USD', 'posts_journal', false);
    END IF;
  ELSE -- SPLIT
    v_retained := round(COALESCE(p_retained_usd_qty, 0), 6);
    IF v_retained < 0 OR round(v_retained + v_distributed, 6) <> round(v_usd, 6) THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_SPLIT_MISMATCH', 'posts_journal', false);
    END IF;
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

  -- Resolve GL debit + holder
  IF v_routing = 'COMPANY_WALLET' THEN
    SELECT id, code, name, company_id, COALESCE(is_active, true) AS is_active
    INTO v_wallet FROM public.accounts
    WHERE id = p_destination_wallet_account_id AND company_id = p_company_id;
    IF v_wallet.id IS NULL OR NOT v_wallet.is_active
       OR NOT public._is_tt_agent_wallet_account(v_wallet.code, v_wallet.name) THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_WALLET_NOT_TT', 'posts_journal', false);
    END IF;
    v_gl_id := v_wallet.id;
    v_holder_type := 'COMPANY_WALLET';
  ELSIF v_routing = 'AGENT_CUSTODY' THEN
    v_gl_id := public._import_fx_w31_get_custody_control_account_id(p_company_id);
    BEGIN
      PERFORM public._import_fx_w31_assert_custody_control(p_company_id, v_gl_id);
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_USD_CUSTODY_CONTROL_NOT_CONFIGURED', 'posts_journal', false);
    END;
    v_holder_type := 'AGENT';
    p_holder_contact_id := v_case.agent_contact_id;
  ELSIF v_routing = 'THIRD_PARTY_CUSTODY' OR (v_routing = 'SPLIT_HOLD_AND_DISTRIBUTE' AND v_retained > 0 AND p_holder_contact_id IS NOT NULL AND p_holder_contact_id <> v_case.agent_contact_id) THEN
    IF p_holder_contact_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_HOLDER_REQUIRED', 'posts_journal', false);
    END IF;
    SELECT id, type::text AS type, company_id, COALESCE(is_active, true) AS is_active
    INTO v_holder FROM public.contacts
    WHERE id = p_holder_contact_id AND company_id = p_company_id;
    IF v_holder.id IS NULL OR NOT v_holder.is_active THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_HOLDER_REQUIRED', 'posts_journal', false);
    END IF;
    v_gl_id := public._import_fx_w31_get_custody_control_account_id(p_company_id);
    BEGIN
      PERFORM public._import_fx_w31_assert_custody_control(p_company_id, v_gl_id);
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_USD_CUSTODY_CONTROL_NOT_CONFIGURED', 'posts_journal', false);
    END;
    v_holder_type := 'THIRD_PARTY';
  ELSIF v_routing = 'SPLIT_HOLD_AND_DISTRIBUTE' THEN
    -- retained with agent by default when holder blank or agent
    IF p_holder_contact_id IS NULL OR p_holder_contact_id = v_case.agent_contact_id THEN
      v_holder_type := 'AGENT';
      p_holder_contact_id := v_case.agent_contact_id;
    ELSE
      v_holder_type := 'THIRD_PARTY';
    END IF;
    IF p_destination_wallet_account_id IS NOT NULL AND v_retained > 0 AND v_holder_type = 'COMPANY_WALLET' THEN
      NULL;
    END IF;
    IF v_retained > 0 AND p_destination_wallet_account_id IS NOT NULL AND COALESCE(p_holder_contact_id, v_case.agent_contact_id) = v_case.agent_contact_id
       AND EXISTS (
         SELECT 1 FROM public.accounts a
         WHERE a.id = p_destination_wallet_account_id AND a.company_id = p_company_id
           AND public._is_tt_agent_wallet_account(a.code, a.name)
       ) THEN
      -- optional: retain in company wallet on split
      v_gl_id := p_destination_wallet_account_id;
      v_holder_type := 'COMPANY_WALLET';
      p_holder_contact_id := NULL;
    ELSE
      v_gl_id := public._import_fx_w31_get_custody_control_account_id(p_company_id);
      BEGIN
        PERFORM public._import_fx_w31_assert_custody_control(p_company_id, v_gl_id);
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_USD_CUSTODY_CONTROL_NOT_CONFIGURED', 'posts_journal', false);
      END;
    END IF;
  ELSE -- DIRECT_DISTRIBUTION
    v_gl_id := public._import_fx_w31_get_custody_control_account_id(p_company_id);
    BEGIN
      PERFORM public._import_fx_w31_assert_custody_control(p_company_id, v_gl_id);
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_USD_CUSTODY_CONTROL_NOT_CONFIGURED', 'posts_journal', false);
    END;
    v_holder_type := 'AGENT'; -- temporary operational park until instructions execute
    p_holder_contact_id := v_case.agent_contact_id;
  END IF;

  -- Funding split (same as W3)
  IF v_funding = 'CREDIT' THEN
    v_adv_apply := 0; v_ap_create := v_carry;
  ELSIF v_funding = 'ADVANCE' THEN
    v_adv_apply := v_carry; v_ap_create := 0;
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
    SELECT COALESCE(sum(remaining_unapplied_pkr), 0) INTO v_unapplied
    FROM public.import_fx_case_advances
    WHERE import_fx_case_id = p_case_id AND status = 'POSTED' AND remaining_unapplied_pkr > 0
    FOR UPDATE;
    IF v_unapplied < v_adv_apply THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_INSUFFICIENT_ADVANCE', 'posts_journal', false);
    END IF;
  END IF;

  IF v_ap_create > 0 THEN
    v_ap_id := public._ensure_ap_subaccount_for_contact(p_company_id, v_case.agent_contact_id);
    IF v_ap_id IS NULL OR public._is_account_control_code(v_ap_id, '2000') THEN
      RETURN jsonb_build_object('success', false, 'code', 'IMPORT_FX_CASE_AGENT_AP_UNRESOLVED', 'posts_journal', false);
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
    company_id, branch_id, import_fx_case_id, agent_contact_id,
    destination_wallet_account_id, gl_debit_account_id, routing_mode, holder_contact_id,
    retained_usd_qty, distributed_usd_qty,
    status, acquisition_date, usd_quantity, pkr_per_usd, carrying_pkr, funding_type,
    advance_applied_pkr, agent_ap_created_pkr, fee_pkr, external_reference, notes,
    client_operation_id, agent_ap_account_id, clearing_account_id, created_by, posted_at
  ) VALUES (
    p_company_id, COALESCE(p_branch_id, v_case.branch_id), p_case_id, v_case.agent_contact_id,
    CASE WHEN v_routing = 'COMPANY_WALLET' OR v_holder_type = 'COMPANY_WALLET' THEN v_gl_id ELSE NULL END,
    v_gl_id, v_routing, p_holder_contact_id,
    v_retained, v_distributed,
    'POSTED', COALESCE(p_acquisition_date, CURRENT_DATE),
    v_usd, v_rate, v_carry, v_funding, v_adv_apply, v_ap_create, NULL,
    NULLIF(trim(p_external_reference), ''), NULLIF(trim(p_notes), ''),
    v_op, v_ap_id, v_clearing, p_created_by, now()
  )
  RETURNING id INTO v_acq_id;

  -- Advance applications (FIFO)
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
        SET remaining_unapplied_pkr = remaining_unapplied_pkr - v_take WHERE id = v_adv.id;
        INSERT INTO public.import_fx_case_advance_applications (
          company_id, import_fx_case_id, advance_id, acquisition_id, applied_pkr, application_order, status
        ) VALUES (p_company_id, p_case_id, v_adv.id, v_acq_id, v_take, v_ord, 'POSTED');
        v_need := round(v_need - v_take, 2);
      END LOOP;
    END IF;
  END IF;

  INSERT INTO public.journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by, document_no, total_debit, total_credit
  ) VALUES (
    p_company_id, COALESCE(p_branch_id, v_case.branch_id), v_entry_no,
    COALESCE(p_acquisition_date, CURRENT_DATE),
    format('Import FX USD acquisition %s @ %s routing %s (case %s)',
      trim(to_char(v_usd, 'FM999999999990.######')),
      trim(to_char(v_rate, 'FM999999999990.########')),
      v_routing, v_case.case_no),
    'import_fx_case_usd_acquisition', v_acq_id, p_created_by, v_entry_no, v_carry, v_carry
  )
  RETURNING id INTO v_je_id;

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_je_id, v_gl_id, v_carry, 0,
    CASE WHEN v_routing = 'COMPANY_WALLET' THEN 'USD/TT wallet carrying PKR'
         ELSE 'USD custody control carrying PKR (operational holder separate)' END);

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
    company_id, import_fx_case_id, acquisition_id, wallet_account_id, gl_debit_account_id,
    routing_mode, holder_contact_id, status,
    usd_original_qty, usd_remaining_qty, pkr_original_carrying, pkr_remaining_carrying, effective_pkr_per_usd
  ) VALUES (
    p_company_id, p_case_id, v_acq_id,
    CASE WHEN v_holder_type = 'COMPANY_WALLET' THEN v_gl_id ELSE NULL END,
    v_gl_id, v_routing, p_holder_contact_id, 'ACTIVE',
    v_usd, v_usd, v_carry, v_carry, v_rate
  )
  RETURNING id INTO v_lot_id;

  -- Custody for retained qty (including full hold modes)
  IF v_retained > 0 THEN
    INSERT INTO public.import_fx_case_usd_custody_positions (
      company_id, branch_id, import_fx_case_id, acquisition_id, lot_id,
      holder_type, holder_contact_id, wallet_account_id, foreign_currency,
      quantity, available_quantity,
      pkr_carrying_value, available_pkr_carrying_value,
      status, notes, created_by
    ) VALUES (
      p_company_id, COALESCE(p_branch_id, v_case.branch_id), p_case_id, v_acq_id, v_lot_id,
      v_holder_type, p_holder_contact_id,
      CASE WHEN v_holder_type = 'COMPANY_WALLET' THEN v_gl_id ELSE NULL END,
      'USD',
      v_retained, v_retained,
      round(v_retained * v_rate, 2), round(v_retained * v_rate, 2),
      'ACTIVE',
      CASE WHEN v_holder_type = 'THIRD_PARTY' THEN 'Holding funds — supplier invoice not settled'
           WHEN v_holder_type = 'AGENT' THEN 'Agent will hold USD under company instructions'
           ELSE NULL END,
      p_created_by
    )
    RETURNING id INTO v_custody_id;
  END IF;

  -- Distribution batch/lines
  IF v_distributed > 0 THEN
    INSERT INTO public.import_fx_case_distribution_batches (
      company_id, branch_id, import_fx_case_id, acquisition_id, custody_position_id,
      instruction_date, status, client_operation_id, external_reference, notes, created_by
    ) VALUES (
      p_company_id, COALESCE(p_branch_id, v_case.branch_id), p_case_id, v_acq_id, v_custody_id,
      COALESCE(p_acquisition_date, CURRENT_DATE), 'EXECUTION_BLOCKED',
      v_op || ':dist', NULLIF(trim(p_external_reference), ''),
      'W3.1 operational instructions — financial execution pending later waves',
      p_created_by
    )
    RETURNING id INTO v_batch_id;

    v_ord := 0;
    FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(p_distribution_rows, '[]'::jsonb))
    LOOP
      v_ord := v_ord + 1;
      v_line_qty := round(COALESCE((v_row->>'usd_qty')::numeric, (v_row->>'instructed_qty')::numeric, 0), 6);
      v_line_pkr := round(v_line_qty * v_rate, 2);
      v_purpose := upper(trim(COALESCE(v_row->>'purpose', 'OTHER_REVIEW_REQUIRED')));
      v_wave := public._import_fx_w31_purpose_requires_wave(v_purpose);
      v_rec_id := NULLIF(trim(COALESCE(v_row->>'recipient_contact_id', '')), '')::uuid;
      v_purchase_id := NULLIF(trim(COALESCE(v_row->>'linked_purchase_id', '')), '')::uuid;
      IF v_rec_id IS NULL THEN
        RAISE EXCEPTION 'IMPORT_FX_CASE_INVALID_DISTRIBUTION' USING ERRCODE = 'P0001';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = v_rec_id AND c.company_id = p_company_id) THEN
        RAISE EXCEPTION 'IMPORT_FX_CASE_INVALID_DISTRIBUTION' USING ERRCODE = 'P0001';
      END IF;
      IF v_purpose = 'SUPPLIER_INVOICE_SETTLEMENT' AND v_purchase_id IS NULL THEN
        RAISE EXCEPTION 'IMPORT_FX_CASE_SUPPLIER_LINK_REQUIRED' USING ERRCODE = 'P0001';
      END IF;
      IF v_wave IS NOT NULL THEN
        v_any_blocked := true;
      END IF;
      INSERT INTO public.import_fx_case_distribution_lines (
        company_id, batch_id, import_fx_case_id, recipient_contact_id, recipient_role, purpose,
        linked_purchase_id, currency, instructed_qty, executed_qty, allocated_pkr_carrying,
        status, requires_wave, review_code, blocks_supplier_ap, external_reference, notes, line_order
      ) VALUES (
        p_company_id, v_batch_id, p_case_id, v_rec_id,
        NULLIF(trim(COALESCE(v_row->>'recipient_role', '')), ''),
        v_purpose, v_purchase_id, 'USD', v_line_qty, 0, v_line_pkr,
        'EXECUTION_BLOCKED', v_wave,
        CASE WHEN v_purpose = 'SUPPLIER_INVOICE_SETTLEMENT' THEN 'REQUIRES_W5_SETTLEMENT'
             WHEN v_purpose = 'CONVERSION_COUNTERPARTY' THEN 'REQUIRES_W4_CONVERSION'
             WHEN v_purpose = 'THIRD_PARTY_CUSTODY' THEN 'HOLDING_NOT_SUPPLIER_AP'
             ELSE 'REVIEW_REQUIRED' END,
        true,
        NULLIF(trim(COALESCE(v_row->>'reference', '')), ''),
        NULLIF(trim(COALESCE(v_row->>'notes', '')), ''),
        v_ord
      );
    END LOOP;
    IF NOT v_any_blocked THEN
      UPDATE public.import_fx_case_distribution_batches SET status = 'READY' WHERE id = v_batch_id;
    END IF;
  END IF;

  INSERT INTO public.import_fx_client_operations (
    company_id, event_type, client_operation_id, journal_entry_id, result_json
  ) VALUES (
    p_company_id, 'w3_usd_acquisition', v_op, v_je_id,
    jsonb_build_object(
      'success', true, 'event_id', v_acq_id, 'journal_entry_id', v_je_id, 'entry_no', v_entry_no,
      'carrying_pkr', v_carry, 'routing_mode', v_routing, 'lot_id', v_lot_id,
      'custody_position_id', v_custody_id, 'distribution_batch_id', v_batch_id,
      'posts_journal', true, 'blocks_supplier_ap', true
    )
  )
  ON CONFLICT (company_id, event_type, client_operation_id) DO NOTHING;

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, event_type, event_status, posts_journal, payload, created_by
  ) VALUES (
    p_company_id, p_case_id, 'W31_USD_ACQUISITION_ROUTED', 'CONFIRMED', true,
    jsonb_build_object(
      'acquisition_id', v_acq_id, 'routing_mode', v_routing, 'retained_usd', v_retained,
      'distributed_usd', v_distributed, 'journal_entry_id', v_je_id
    ),
    p_created_by
  );

  PERFORM public._import_fx_w3_set_partially_posted(p_case_id);

  RETURN jsonb_build_object(
    'success', true,
    'posts_journal', true,
    'event_id', v_acq_id,
    'journal_entry_id', v_je_id,
    'entry_no', v_entry_no,
    'routing_mode', v_routing,
    'lot_id', v_lot_id,
    'custody_position_id', v_custody_id,
    'distribution_batch_id', v_batch_id,
    'retained_usd_qty', v_retained,
    'distributed_usd_qty', v_distributed,
    'blocks_supplier_ap', true,
    'message', CASE WHEN v_distributed > 0
      THEN 'Acquisition posted. Distribution instructions are planned/blocked until W4/W5 — supplier AP not reduced.'
      ELSE 'Acquisition posted with custody position.' END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'code', SQLSTATE, 'error', SQLERRM, 'posts_journal', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_import_fx_usd_acquisition_with_routing(
  uuid, uuid, uuid, date, numeric, numeric, text, uuid, uuid, numeric, jsonb, text, numeric, jsonb, boolean, text, text, text, uuid
) TO authenticated, service_role;

COMMENT ON FUNCTION public.post_import_fx_usd_acquisition_with_routing IS
  'W3.1: USD acquisition with custody routing. Distribution lines do not settle Supplier AP or convert currency.';
