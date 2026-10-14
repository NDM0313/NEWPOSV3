-- Single-row payment ↔ journal relink (metadata only — no GL line edits).

CREATE OR REPLACE FUNCTION public.amounts_close(a NUMERIC, b NUMERIC)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT abs(COALESCE(a, 0) - COALESCE(b, 0)) < 0.02;
$$;

CREATE OR REPLACE FUNCTION public.developer_repair_relink_payment_je(
  p_company_id UUID,
  p_payment_id UUID,
  p_journal_entry_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay RECORD;
  v_je RECORD;
  v_existing_je UUID;
  v_je_amount NUMERIC;
  v_before JSONB;
  v_after JSONB;
BEGIN
  SELECT id, company_id, amount, payment_date, contact_id, reference_type, reference_id, voided_at
  INTO v_pay
  FROM payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;
  IF v_pay.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Payment company mismatch';
  END IF;
  IF v_pay.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Payment is voided';
  END IF;

  SELECT id, company_id, payment_id, entry_date, is_void, reference_type, reference_id
  INTO v_je
  FROM journal_entries
  WHERE id = p_journal_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found: %', p_journal_entry_id;
  END IF;
  IF v_je.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Journal entry company mismatch';
  END IF;
  IF COALESCE(v_je.is_void, false) THEN
    RAISE EXCEPTION 'Journal entry is void';
  END IF;

  SELECT COALESCE(MAX(GREATEST(COALESCE(debit, 0), COALESCE(credit, 0))), 0)
  INTO v_je_amount
  FROM journal_entry_lines
  WHERE journal_entry_id = p_journal_entry_id;

  IF NOT public.amounts_close(v_pay.amount, v_je_amount) THEN
    RAISE EXCEPTION 'Amount mismatch between payment and journal entry';
  END IF;

  IF v_je.payment_id IS NOT NULL AND v_je.payment_id <> p_payment_id THEN
    RAISE EXCEPTION 'Journal entry already linked to another payment';
  END IF;

  SELECT je.id INTO v_existing_je
  FROM journal_entries je
  WHERE je.payment_id = p_payment_id
    AND je.id <> p_journal_entry_id
    AND COALESCE(je.is_void, false) = false
  LIMIT 1;

  IF v_existing_je IS NOT NULL THEN
    RAISE EXCEPTION 'Payment already linked to active journal entry %', v_existing_je;
  END IF;

  v_before := jsonb_build_object(
    'payment_id', p_payment_id,
    'journal_entry_id', p_journal_entry_id,
    'je_payment_id', v_je.payment_id
  );

  UPDATE journal_entries
  SET payment_id = p_payment_id,
      updated_at = NOW()
  WHERE id = p_journal_entry_id;

  v_after := jsonb_build_object(
    'payment_id', p_payment_id,
    'journal_entry_id', p_journal_entry_id,
    'je_payment_id', p_payment_id
  );

  RETURN jsonb_build_object('before', v_before, 'after', v_after);
END;
$$;

GRANT EXECUTE ON FUNCTION public.developer_repair_relink_payment_je(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_repair_relink_payment_je(UUID, UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.developer_repair_relink_payment_je IS
  'Developer Center: link journal_entries.payment_id to payments row when amounts and company match. No GL line edits.';
