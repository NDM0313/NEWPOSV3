-- Path 21 hotfix: money_exchange-only agent + distinct from purchase supplier.
-- Forensic evidence (live MCP, Qing Boyu test — do NOT rewrite these JEs):
--   JV-000341  fx_currency_purchase  Dr 1205 HAMID IK RMB 215k / Cr AP-SUP0001 Qing Boyu 215k
--   FX credit  CNY 5,000 @ 43; agent_contact_id = Qing Boyu (contacts.type=supplier); linked_purchase_id null; paid
--   PAY-0325   agent settle on_account  Dr AP-SUP0001 / Cr 1010
--   PAY-0326   China settle → PUR-0005  Dr AP-SUP0001 / Cr 1205
--   PUR-0005   Qing Boyu supplier; total PKR 8,669,795.88
-- Root cause: agent picker/RPC allowed supplier|both|money_exchange → same AP-{slug} for agent credit + China AP.
-- Net AP coherent (+215k −215k −215k = −215k); Supplier Ledger Payments Paid double-counted display only.
-- Fix: eligibility + operational role filters (app). Official CoA AP account ledger stays full history.
-- Successor to 20260811160000. Preserves Wave A multiCurrency / currency gates and JE meaning.

CREATE OR REPLACE FUNCTION public.record_fx_currency_purchase_on_credit(
  p_company_id uuid,
  p_branch_id uuid,
  p_agent_contact_id uuid,
  p_wallet_account_id uuid,
  p_document_currency text,
  p_foreign_amount numeric,
  p_fx_rate_to_base numeric,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_linked_purchase_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet RECORD;
  v_agent RECORD;
  v_purchase RECORD;
  v_ap_id uuid;
  v_amount_pkr numeric(18, 2);
  v_currency text;
  v_credit_id uuid;
  v_je_id uuid;
  v_entry_no text;
  v_doc_no text;
  v_branch uuid;
BEGIN
  IF p_company_id IS NULL OR p_agent_contact_id IS NULL OR p_wallet_account_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'company, agent, and wallet are required');
  END IF;

  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RETURN json_build_object(
      'success', false,
      'code', 'MULTI_CURRENCY_DISABLED',
      'error', 'MULTI_CURRENCY_DISABLED: Import FX requires Multi Currency Enabled in Settings'
    );
  END IF;

  IF COALESCE(p_foreign_amount, 0) <= 0 OR COALESCE(p_fx_rate_to_base, 0) <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'foreign_amount and fx_rate_to_base must be > 0');
  END IF;

  v_currency := public._normalize_import_fx_currency(p_document_currency);
  IF v_currency = '' OR v_currency = 'PKR' THEN
    RETURN json_build_object(
      'success', false,
      'code', 'IMPORT_FX_CURRENCY_NOT_ACTIVE',
      'error', 'IMPORT_FX_CURRENCY_NOT_ACTIVE: FX credit purchase requires a foreign document currency'
    );
  END IF;
  IF NOT public._company_import_fx_currency_allowed(p_company_id, v_currency) THEN
    RETURN json_build_object(
      'success', false,
      'code', 'IMPORT_FX_CURRENCY_NOT_ACTIVE',
      'error', format(
        'IMPORT_FX_CURRENCY_NOT_ACTIVE: %s is not in activeCurrencies',
        v_currency
      )
    );
  END IF;

  v_amount_pkr := round(p_foreign_amount * p_fx_rate_to_base, 2);
  IF v_amount_pkr <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'computed amount_pkr must be > 0');
  END IF;

  SELECT id, code, name, type::text AS type, company_id, COALESCE(is_active, true) AS is_active
  INTO v_wallet
  FROM accounts
  WHERE id = p_wallet_account_id AND company_id = p_company_id
  LIMIT 1;

  IF v_wallet.id IS NULL OR NOT v_wallet.is_active THEN
    RETURN json_build_object('success', false, 'error', 'wallet account not found');
  END IF;
  IF NOT public._is_tt_agent_wallet_account(v_wallet.code, v_wallet.name) THEN
    RETURN json_build_object('success', false, 'error', 'wallet must be a TT-agent 12xx wallet account');
  END IF;

  SELECT id, name, type::text AS type, company_id, COALESCE(is_active, true) AS is_active
  INTO v_agent
  FROM contacts
  WHERE id = p_agent_contact_id AND company_id = p_company_id
  LIMIT 1;

  IF v_agent.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'agent contact not found');
  END IF;
  IF COALESCE(v_agent.is_active, true) IS NOT TRUE THEN
    RETURN json_build_object(
      'success', false,
      'code', 'IMPORT_FX_AGENT_ROLE_INVALID',
      'error', 'IMPORT_FX_AGENT_ROLE_INVALID: agent contact is inactive'
    );
  END IF;
  -- Path 21: money_exchange only (do not allow China supplier as agent)
  IF lower(trim(COALESCE(v_agent.type, ''))) <> 'money_exchange' THEN
    RETURN json_build_object(
      'success', false,
      'code', 'IMPORT_FX_AGENT_ROLE_INVALID',
      'error', 'IMPORT_FX_AGENT_ROLE_INVALID: agent contact type must be money_exchange'
    );
  END IF;

  IF p_linked_purchase_id IS NOT NULL THEN
    SELECT id, supplier_id
    INTO v_purchase
    FROM purchases
    WHERE id = p_linked_purchase_id AND company_id = p_company_id
    LIMIT 1;

    IF v_purchase.id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'linked purchase not found');
    END IF;
    IF v_purchase.supplier_id IS NOT NULL
       AND v_purchase.supplier_id = p_agent_contact_id THEN
      RETURN json_build_object(
        'success', false,
        'code', 'IMPORT_FX_AGENT_SAME_AS_SUPPLIER',
        'error', 'IMPORT_FX_AGENT_SAME_AS_SUPPLIER: The money-exchange agent cannot be the same party as the purchase supplier.'
      );
    END IF;
  END IF;

  v_ap_id := public._ensure_ap_subaccount_for_contact(p_company_id, p_agent_contact_id);
  IF v_ap_id IS NULL OR public._is_account_control_code(v_ap_id, '2000') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Could not resolve Agent AP sub-ledger under 2000'
    );
  END IF;

  v_branch := p_branch_id;

  BEGIN
    v_entry_no := public.generate_document_number(
      p_company_id,
      public.erp_numbering_global_branch_sentinel(),
      'manual_journal',
      false
    );
  EXCEPTION WHEN OTHERS THEN
    v_entry_no := 'FXC-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || floor(random() * 1000)::text;
  END;
  v_doc_no := v_entry_no;

  INSERT INTO public.fx_currency_purchases (
    company_id, branch_id, agent_contact_id, wallet_account_id,
    document_currency, foreign_amount, fx_rate_to_base, amount_pkr,
    paid_amount_pkr, due_amount_pkr, status, linked_purchase_id,
    document_no, notes, created_by
  )
  VALUES (
    p_company_id, v_branch, p_agent_contact_id, p_wallet_account_id,
    v_currency, p_foreign_amount, p_fx_rate_to_base, v_amount_pkr,
    0, v_amount_pkr, 'open', p_linked_purchase_id,
    v_doc_no, p_notes, p_created_by
  )
  RETURNING id INTO v_credit_id;

  INSERT INTO public.journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by, document_no,
    total_debit, total_credit
  )
  VALUES (
    p_company_id,
    v_branch,
    v_entry_no,
    CURRENT_DATE,
    format(
      'FX credit purchase %s %s @ %s → PKR %s (agent %s)',
      v_currency,
      trim(to_char(p_foreign_amount, 'FM999999999990.00')),
      trim(to_char(p_fx_rate_to_base, 'FM999999999990.########')),
      trim(to_char(v_amount_pkr, 'FM999999999990.00')),
      COALESCE(v_agent.name, 'agent')
    ),
    'fx_currency_purchase',
    v_credit_id,
    p_created_by,
    v_doc_no,
    v_amount_pkr,
    v_amount_pkr
  )
  RETURNING id INTO v_je_id;

  INSERT INTO public.journal_entry_lines (
    journal_entry_id, account_id, debit, credit, description
  )
  VALUES
    (
      v_je_id, p_wallet_account_id, v_amount_pkr, 0,
      'FC wallet funded (credit purchase)'
    ),
    (
      v_je_id, v_ap_id, 0, v_amount_pkr,
      'Agent payable for FC credit purchase'
    );

  UPDATE public.fx_currency_purchases
  SET journal_entry_id = v_je_id, updated_at = now()
  WHERE id = v_credit_id;

  RETURN json_build_object(
    'success', true,
    'fx_currency_purchase_id', v_credit_id,
    'journal_entry_id', v_je_id,
    'entry_no', v_entry_no,
    'amount_pkr', v_amount_pkr,
    'due_amount_pkr', v_amount_pkr
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_fx_currency_purchase_on_credit IS
  'Path 21: Dr TT wallet / Cr Agent AP (PKR). Agent must be money_exchange; optional linked purchase supplier must differ. Wave A gates preserved.';

GRANT EXECUTE ON FUNCTION public.record_fx_currency_purchase_on_credit(
  uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_fx_currency_purchase_on_credit(
  uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, uuid
) TO service_role;
