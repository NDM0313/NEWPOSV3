-- ---------------------------------------------------------------------------
-- 6) record_fx_currency_purchase_on_credit
--    Dr wallet (PKR) / Cr Agent AP (PKR). Inverse of paid payment RPC.
-- ---------------------------------------------------------------------------
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
  IF COALESCE(p_foreign_amount, 0) <= 0 OR COALESCE(p_fx_rate_to_base, 0) <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'foreign_amount and fx_rate_to_base must be > 0');
  END IF;

  v_currency := upper(trim(COALESCE(p_document_currency, '')));
  IF v_currency = 'RMB' THEN v_currency := 'CNY'; END IF;
  IF v_currency NOT IN ('CNY', 'USD') THEN
    RETURN json_build_object('success', false, 'error', 'document_currency must be CNY or USD');
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

  SELECT id, name, type::text AS type, company_id
  INTO v_agent
  FROM contacts
  WHERE id = p_agent_contact_id AND company_id = p_company_id
  LIMIT 1;

  IF v_agent.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'agent contact not found');
  END IF;
  IF lower(trim(COALESCE(v_agent.type, ''))) NOT IN ('supplier', 'both', 'money_exchange') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'agent contact type must be money_exchange, supplier, or both'
    );
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
  'Dual-credit FX: Dr TT-agent wallet / Cr Agent AP in PKR. Does not use record_payment_with_accounting.';

GRANT EXECUTE ON FUNCTION public.record_fx_currency_purchase_on_credit(
  uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_fx_currency_purchase_on_credit(
  uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, uuid
) TO service_role;

-- ---------------------------------------------------------------------------
-- 7) apply_fx_currency_purchase_settlement
--    After createSupplierPayment (on_account) to agent — bump paid/due/status.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_fx_currency_purchase_settlement(
  p_company_id uuid,
  p_fx_currency_purchase_id uuid,
  p_payment_id uuid,
  p_amount_pkr numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.fx_currency_purchases%ROWTYPE;
  v_pay RECORD;
  v_amt numeric(18, 2);
  v_paid numeric(18, 2);
  v_due numeric(18, 2);
  v_status text;
BEGIN
  IF p_company_id IS NULL OR p_fx_currency_purchase_id IS NULL OR p_payment_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'company, credit id, and payment id required');
  END IF;
  v_amt := round(COALESCE(p_amount_pkr, 0), 2);
  IF v_amt <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'amount_pkr must be > 0');
  END IF;

  SELECT * INTO v_row
  FROM public.fx_currency_purchases
  WHERE id = p_fx_currency_purchase_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'fx_currency_purchase not found');
  END IF;
  IF v_row.status = 'void' THEN
    RETURN json_build_object('success', false, 'error', 'fx_currency_purchase is void');
  END IF;

  SELECT id, company_id, contact_id, amount, payment_type::text AS payment_type, voided_at
  INTO v_pay
  FROM payments
  WHERE id = p_payment_id AND company_id = p_company_id
  LIMIT 1;

  IF v_pay.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'payment not found');
  END IF;
  IF v_pay.voided_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'payment is voided');
  END IF;
  IF lower(COALESCE(v_pay.payment_type, '')) <> 'paid' THEN
    RETURN json_build_object('success', false, 'error', 'settlement payment must be paid');
  END IF;
  IF v_pay.contact_id IS DISTINCT FROM v_row.agent_contact_id THEN
    RETURN json_build_object('success', false, 'error', 'payment contact must match agent');
  END IF;
  IF v_amt > round(COALESCE(v_row.due_amount_pkr, 0), 2) + 0.009 THEN
    RETURN json_build_object('success', false, 'error', 'amount exceeds remaining due');
  END IF;

  INSERT INTO public.fx_currency_purchase_settlements (
    company_id, fx_currency_purchase_id, payment_id, amount_pkr
  )
  VALUES (p_company_id, p_fx_currency_purchase_id, p_payment_id, v_amt)
  ON CONFLICT (fx_currency_purchase_id, payment_id) DO NOTHING;

  SELECT COALESCE(SUM(amount_pkr), 0) INTO v_paid
  FROM public.fx_currency_purchase_settlements
  WHERE fx_currency_purchase_id = p_fx_currency_purchase_id;

  v_due := GREATEST(0, round(v_row.amount_pkr - v_paid, 2));
  IF v_paid <= 0.009 THEN
    v_status := 'open';
  ELSIF v_due <= 0.009 THEN
    v_status := 'paid';
  ELSE
    v_status := 'partial';
  END IF;

  UPDATE public.fx_currency_purchases
  SET
    paid_amount_pkr = v_paid,
    due_amount_pkr = v_due,
    status = v_status,
    updated_at = now()
  WHERE id = p_fx_currency_purchase_id;

  RETURN json_build_object(
    'success', true,
    'fx_currency_purchase_id', p_fx_currency_purchase_id,
    'paid_amount_pkr', v_paid,
    'due_amount_pkr', v_due,
    'status', v_status
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.apply_fx_currency_purchase_settlement IS
  'After agent PKR payment (createSupplierPayment), allocate amount to fx_currency_purchases paid/due/status.';

GRANT EXECUTE ON FUNCTION public.apply_fx_currency_purchase_settlement(uuid, uuid, uuid, numeric)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_fx_currency_purchase_settlement(uuid, uuid, uuid, numeric)
  TO service_role;
