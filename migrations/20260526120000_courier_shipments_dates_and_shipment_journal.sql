-- Courier shipment lifecycle dates + post_sale_shipment_journal RPC (mobile/web parity).
-- Additive only. Safe to re-run.

SET search_path = public;

ALTER TABLE courier_shipments
  ADD COLUMN IF NOT EXISTS booking_date DATE DEFAULT CURRENT_DATE;

ALTER TABLE courier_shipments
  ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;

ALTER TABLE courier_shipments
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

ALTER TABLE courier_shipments
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

COMMENT ON COLUMN courier_shipments.booking_date IS 'Date shipment was booked with courier.';
COMMENT ON COLUMN courier_shipments.expected_delivery_date IS 'Expected delivery date communicated to customer/courier.';

-- ---------------------------------------------------------------------------
-- post_sale_shipment_journal: AR/Shipping Income + Shipping Expense/Courier Payable
-- Idempotent when reference_type=shipment + reference_id already exists.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.post_sale_shipment_journal(
  p_shipment_id UUID,
  p_performed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s                     sale_shipments%ROWTYPE;
  v_company_id          UUID;
  v_charged             NUMERIC(15, 2);
  v_cost                NUMERIC(15, 2);
  v_existing_id         UUID;
  v_journal_entry_id    UUID;
  v_entry_no            TEXT;
  v_ar_id               UUID;
  v_income_id           UUID;
  v_expense_id          UUID;
  v_courier_payable_id  UUID;
  v_courier_contact_id  UUID;
  v_courier_name        TEXT;
  v_invoice_no          TEXT;
  v_total_debit         NUMERIC(15, 2) := 0;
  v_total_credit        NUMERIC(15, 2) := 0;
  v_label               TEXT;
BEGIN
  IF p_shipment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'p_shipment_id required');
  END IF;

  SELECT * INTO s FROM public.sale_shipments WHERE id = p_shipment_id;
  IF s.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'sale_shipment not found');
  END IF;

  v_company_id := s.company_id;
  v_charged := ROUND(COALESCE(s.charged_to_customer, 0)::numeric, 2);
  v_cost := ROUND(COALESCE(s.actual_cost, 0)::numeric, 2);

  IF v_charged <= 0 AND v_cost <= 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'zero_amounts');
  END IF;

  SELECT je.id INTO v_existing_id
  FROM public.journal_entries je
  WHERE je.company_id = v_company_id
    AND je.reference_type = 'shipment'
    AND je.reference_id = p_shipment_id
    AND COALESCE(je.is_void, false) = false
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped', true,
      'journal_entry_id', v_existing_id
    );
  END IF;

  SELECT COALESCE(sl.invoice_no, sl.order_no, '') INTO v_invoice_no
  FROM public.sales sl
  WHERE sl.id = s.sale_id;

  v_label := CASE WHEN v_invoice_no <> '' THEN ' – ' || v_invoice_no ELSE '' END;

  -- AR 1100
  SELECT a.id INTO v_ar_id
  FROM public.accounts a
  WHERE a.company_id = v_company_id AND trim(a.code) = '1100' AND COALESCE(a.is_active, true)
  LIMIT 1;

  IF v_ar_id IS NULL AND v_charged > 0 THEN
    INSERT INTO public.accounts (company_id, code, name, type, balance, is_active)
    VALUES (v_company_id, '1100', 'Accounts Receivable', 'asset', 0, true)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT a.id INTO v_ar_id FROM public.accounts a
    WHERE a.company_id = v_company_id AND trim(a.code) = '1100' LIMIT 1;
  END IF;

  -- Shipping Income 4110
  SELECT a.id INTO v_income_id
  FROM public.accounts a
  WHERE a.company_id = v_company_id AND trim(a.code) = '4110' AND COALESCE(a.is_active, true)
  LIMIT 1;

  IF v_income_id IS NULL AND v_charged > 0 THEN
    INSERT INTO public.accounts (company_id, code, name, type, balance, is_active)
    VALUES (v_company_id, '4110', 'Shipping Income', 'Revenue', 0, true)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT a.id INTO v_income_id FROM public.accounts a
    WHERE a.company_id = v_company_id AND trim(a.code) = '4110' LIMIT 1;
  END IF;

  -- Shipping Expense 5100
  SELECT a.id INTO v_expense_id
  FROM public.accounts a
  WHERE a.company_id = v_company_id AND trim(a.code) = '5100' AND COALESCE(a.is_active, true)
  LIMIT 1;

  IF v_expense_id IS NULL AND v_cost > 0 THEN
    INSERT INTO public.accounts (company_id, code, name, type, balance, is_active)
    VALUES (v_company_id, '5100', 'Shipping Expense', 'Expense', 0, true)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT a.id INTO v_expense_id FROM public.accounts a
    WHERE a.company_id = v_company_id AND trim(a.code) = '5100' LIMIT 1;
  END IF;

  -- Courier payable: prefer couriers.account_id, else get_or_create by contact
  v_courier_name := COALESCE(s.courier_name, 'Courier');
  IF s.courier_master_id IS NOT NULL THEN
    SELECT c.contact_id, c.name, c.account_id
    INTO v_courier_contact_id, v_courier_name, v_courier_payable_id
    FROM public.couriers c
    WHERE c.id = s.courier_master_id
    LIMIT 1;
  END IF;

  IF v_cost > 0 AND v_courier_payable_id IS NULL THEN
    IF v_courier_contact_id IS NOT NULL THEN
      v_courier_payable_id := public.get_or_create_courier_payable_account(
        v_company_id,
        v_courier_contact_id,
        v_courier_name
      );
    ELSE
      SELECT a.id INTO v_courier_payable_id
      FROM public.accounts a
      WHERE a.company_id = v_company_id AND trim(a.code) = '2030' AND COALESCE(a.is_active, true)
      LIMIT 1;
    END IF;
  END IF;

  v_total_debit := COALESCE(v_charged, 0) + COALESCE(v_cost, 0);
  v_total_credit := v_total_debit;

  IF v_total_debit <= 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'no_lines');
  END IF;

  v_entry_no := 'JE-SHIP-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(
    (SELECT COUNT(*) + 1 FROM public.journal_entries WHERE company_id = v_company_id)::TEXT,
    4,
    '0'
  );

  INSERT INTO public.journal_entries (
    company_id,
    branch_id,
    entry_no,
    entry_date,
    description,
    reference_type,
    reference_id,
    created_by,
    total_debit,
    total_credit,
    is_posted,
    posted_at,
    is_manual
  )
  VALUES (
    v_company_id,
    s.branch_id,
    v_entry_no,
    COALESCE(s.booking_date, CURRENT_DATE),
    'Shipment accounting' || v_label,
    'shipment',
    p_shipment_id,
    p_performed_by,
    v_total_debit,
    v_total_credit,
    true,
    NOW(),
    false
  )
  RETURNING id INTO v_journal_entry_id;

  IF v_charged > 0 AND v_ar_id IS NOT NULL AND v_income_id IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_name, debit, credit, description)
    VALUES
      (v_journal_entry_id, v_ar_id, 'Accounts Receivable', v_charged, 0, 'Shipping charged to customer' || v_label),
      (v_journal_entry_id, v_income_id, 'Shipping Income', 0, v_charged, 'Shipping Income' || v_label);
  END IF;

  IF v_cost > 0 AND v_expense_id IS NOT NULL AND v_courier_payable_id IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_name, debit, credit, description)
    VALUES
      (v_journal_entry_id, v_expense_id, 'Shipping Expense', v_cost, 0, 'Shipping expense – ' || v_courier_name || v_label),
      (v_journal_entry_id, v_courier_payable_id, v_courier_name || ' Payable', 0, v_cost, 'Courier Payable – ' || v_courier_name || v_label);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'skipped', false,
    'journal_entry_id', v_journal_entry_id,
    'entry_no', v_entry_no
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.post_sale_shipment_journal(UUID, UUID) IS
  'Posts shipment GL: Dr AR / Cr Shipping Income (charged) and Dr Shipping Expense / Cr Courier Payable (cost). Idempotent.';

GRANT EXECUTE ON FUNCTION public.post_sale_shipment_journal(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_sale_shipment_journal(UUID, UUID) TO service_role;
