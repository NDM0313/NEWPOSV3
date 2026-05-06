-- Rental booking wear/devaluation: Dr expense (5300 / fallback 6100), Cr asset (default 1000 / fallback 1010).
-- Does NOT touch party AR or Rental Income — avoids netting expenses against receivables.
-- Idempotent via caller-supplied action_fingerprint (same keys as rental_party_devaluation:* in app).

SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_rental_expense_devaluation_journal(
  p_rental_id             UUID,
  p_amount                NUMERIC,
  p_action_fingerprint    TEXT,
  p_entry_date            DATE,
  p_created_by            UUID DEFAULT NULL,
  p_line_description      TEXT DEFAULT NULL,
  p_debit_account_code    TEXT DEFAULT '5300',
  p_credit_account_code   TEXT DEFAULT '1000'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r                     rentals%ROWTYPE;
  v_company_id          UUID;
  v_amt                 NUMERIC(15, 2);
  v_existing_id         UUID;
  v_journal_entry_id    UUID;
  v_entry_no            TEXT;
  v_desc                TEXT;
  v_debit_id            UUID;
  v_credit_id           UUID;
  v_debit_name          TEXT;
  v_credit_name         TEXT;
  v_primary_debit       TEXT;
  v_primary_credit      TEXT;
BEGIN
  IF p_rental_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'skipped', false, 'error', 'p_rental_id required');
  END IF;

  IF p_action_fingerprint IS NULL OR trim(p_action_fingerprint) = '' THEN
    RETURN jsonb_build_object('success', false, 'skipped', false, 'error', 'p_action_fingerprint required');
  END IF;

  SELECT * INTO r FROM public.rentals WHERE id = p_rental_id;
  IF r.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'skipped', false, 'error', 'rental not found');
  END IF;

  v_company_id := r.company_id;
  v_amt := ROUND(COALESCE(p_amount, 0)::numeric, 2);

  IF v_amt <= 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'zero_amount');
  END IF;

  IF r.customer_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'no_customer');
  END IF;

  SELECT je.id INTO v_existing_id
  FROM public.journal_entries je
  WHERE je.company_id = v_company_id
    AND je.action_fingerprint = p_action_fingerprint
    AND COALESCE(je.is_void, false) = false
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped', true,
      'journal_entry_id', v_existing_id
    );
  END IF;

  v_primary_debit := NULLIF(trim(COALESCE(p_debit_account_code, '5300')), '');
  IF v_primary_debit IS NULL THEN
    v_primary_debit := '5300';
  END IF;

  v_primary_credit := NULLIF(trim(COALESCE(p_credit_account_code, '1000')), '');
  IF v_primary_credit IS NULL THEN
    v_primary_credit := '1000';
  END IF;

  SELECT a.id, a.name INTO v_debit_id, v_debit_name
  FROM public.accounts a
  WHERE a.company_id = v_company_id
    AND trim(a.code) = v_primary_debit
    AND COALESCE(a.is_active, true)
  LIMIT 1;

  IF v_debit_id IS NULL AND v_primary_debit = '5300' THEN
    SELECT a.id, a.name INTO v_debit_id, v_debit_name
    FROM public.accounts a
    WHERE a.company_id = v_company_id
      AND trim(a.code) = '6100'
      AND COALESCE(a.is_active, true)
    LIMIT 1;
  END IF;

  SELECT a.id, a.name INTO v_credit_id, v_credit_name
  FROM public.accounts a
  WHERE a.company_id = v_company_id
    AND trim(a.code) = v_primary_credit
    AND COALESCE(a.is_active, true)
  LIMIT 1;

  IF v_credit_id IS NULL AND v_primary_credit = '1000' THEN
    SELECT a.id, a.name INTO v_credit_id, v_credit_name
    FROM public.accounts a
    WHERE a.company_id = v_company_id
      AND trim(a.code) = '1010'
      AND COALESCE(a.is_active, true)
    LIMIT 1;
  END IF;

  IF v_debit_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'skipped', false,
      'error',
      'debit account not found for codes ' || v_primary_debit ||
        CASE WHEN v_primary_debit = '5300' THEN ' / 6100' ELSE '' END
    );
  END IF;

  IF v_credit_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'skipped', false,
      'error',
      'credit account not found for codes ' || v_primary_credit ||
        CASE WHEN v_primary_credit = '1000' THEN ' / 1010' ELSE '' END
    );
  END IF;

  v_desc := COALESCE(
    NULLIF(trim(p_line_description), ''),
    'Rental wear / devaluation — ' || COALESCE(r.booking_no, r.id::TEXT)
  );

  v_entry_no := 'JE-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(
    (SELECT COUNT(*) + 1 FROM public.journal_entries WHERE company_id = v_company_id)::TEXT,
    4,
    '0'
  );

  BEGIN
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
      is_manual,
      action_fingerprint
    )
    VALUES (
      v_company_id,
      r.branch_id,
      v_entry_no,
      COALESCE(p_entry_date, r.booking_date, CURRENT_DATE),
      v_desc,
      'rental',
      p_rental_id,
      p_created_by,
      v_amt,
      v_amt,
      true,
      NOW(),
      false,
      p_action_fingerprint
    )
    RETURNING id INTO v_journal_entry_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT je.id INTO v_journal_entry_id
      FROM public.journal_entries je
      WHERE je.company_id = v_company_id
        AND je.action_fingerprint = p_action_fingerprint
        AND COALESCE(je.is_void, false) = false
      LIMIT 1;
      IF v_journal_entry_id IS NOT NULL THEN
        RETURN jsonb_build_object(
          'success', true,
          'skipped', true,
          'journal_entry_id', v_journal_entry_id
        );
      END IF;
      RAISE;
  END;

  INSERT INTO public.journal_entry_lines (
    journal_entry_id,
    account_id,
    account_name,
    debit,
    credit,
    description
  )
  VALUES
    (v_journal_entry_id, v_debit_id, COALESCE(v_debit_name, ''), v_amt, 0, v_desc),
    (v_journal_entry_id, v_credit_id, COALESCE(v_credit_name, ''), 0, v_amt, v_desc);

  BEGIN
    UPDATE public.journal_entries
    SET
      total_debit  = (SELECT COALESCE(SUM(debit), 0)  FROM public.journal_entry_lines WHERE journal_entry_id = v_journal_entry_id),
      total_credit = (SELECT COALESCE(SUM(credit), 0) FROM public.journal_entry_lines WHERE journal_entry_id = v_journal_entry_id)
    WHERE id = v_journal_entry_id;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'skipped', false,
    'journal_entry_id', v_journal_entry_id,
    'debit_account_id', v_debit_id,
    'credit_account_id', v_credit_id,
    'amount', v_amt
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'skipped', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_rental_expense_devaluation_journal(
  UUID, NUMERIC, TEXT, DATE, UUID, TEXT, TEXT, TEXT
) IS
  'Rental wear expense JE: Dr expense (5300↔6100), Cr cash/asset (1000↔1010). Idempotent via p_action_fingerprint. Does not post to AR or 4200.';

GRANT EXECUTE ON FUNCTION public.record_rental_expense_devaluation_journal(
  UUID, NUMERIC, TEXT, DATE, UUID, TEXT, TEXT, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.record_rental_expense_devaluation_journal(
  UUID, NUMERIC, TEXT, DATE, UUID, TEXT, TEXT, TEXT
) TO service_role;
