-- Phase D: parametric GL correction for mobile rental 1100 leakage (per journal line).
-- Extends create_gl_correction_journal beyond hq-sl-0003-orphan-ar whitelist.

-- ─── 1. List eligible rental 1100 leakage defects (read-only) ───
CREATE OR REPLACE FUNCTION public.list_rental_1100_leakage_defects(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  defect_id TEXT,
  journal_entry_line_id UUID,
  journal_entry_id UUID,
  entry_no TEXT,
  entry_date DATE,
  contact_id UUID,
  customer_name TEXT,
  party_ar_account_id UUID,
  party_ar_account_code TEXT,
  amount NUMERIC,
  direction TEXT,
  reference_type TEXT,
  source_label TEXT,
  fingerprint TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control_id UUID;
BEGIN
  SELECT a.id INTO v_control_id
  FROM public.accounts a
  WHERE a.company_id = p_company_id
    AND trim(COALESCE(a.code, '')) = '1100'
    AND COALESCE(a.is_active, TRUE)
  LIMIT 1;

  IF v_control_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH src AS (
    SELECT
      jel.id AS line_id,
      je.id AS je_id,
      je.entry_no AS je_no,
      je.entry_date AS je_date,
      je.reference_type AS je_ref_type,
      jel.debit AS line_debit,
      jel.credit AS line_credit,
      COALESCE(r.customer_id, pay.contact_id) AS cust_id,
      COALESCE(c.name, r.customer_name, pay.contact_name, 'Customer') AS cust_name,
      COALESCE(r.booking_no, pay.reference_number, je.entry_no) AS src_label,
      CASE
        WHEN COALESCE(jel.debit, 0) > 0.001 THEN 'debit_on_control'
        ELSE 'credit_on_control'
      END AS line_direction,
      GREATEST(COALESCE(jel.debit, 0), COALESCE(jel.credit, 0)) AS line_amt
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    LEFT JOIN public.rentals r
      ON je.reference_type = 'rental' AND je.reference_id = r.id
    LEFT JOIN public.payments pay ON je.payment_id = pay.id
    LEFT JOIN public.contacts c ON c.id = COALESCE(r.customer_id, pay.contact_id)
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND jel.account_id = v_control_id
      AND GREATEST(COALESCE(jel.debit, 0), COALESCE(jel.credit, 0)) > 0.001
      AND (
        p_branch_id IS NULL
        OR je.branch_id IS NULL
        OR je.branch_id = p_branch_id
      )
      AND (
        (je.reference_type = 'rental' AND r.customer_id IS NOT NULL)
        OR (
          lower(trim(COALESCE(je.reference_type, ''))) = 'payment'
          AND pay.reference_type = 'rental'
          AND pay.contact_id IS NOT NULL
        )
      )
      AND trim(COALESCE(je.entry_no, '')) NOT IN ('JE-0160', 'JE-0161')
  )
  SELECT
    ('rental-1100-leakage:' || s.line_id::text)::text,
    s.line_id,
    s.je_id,
    s.je_no::text,
    s.je_date,
    s.cust_id,
    s.cust_name::text,
    public._ensure_ar_subaccount_for_contact(p_company_id, s.cust_id),
    (
      SELECT trim(COALESCE(a.code, ''))
      FROM public.accounts a
      WHERE a.id = public._ensure_ar_subaccount_for_contact(p_company_id, s.cust_id)
      LIMIT 1
    )::text,
    round(s.line_amt, 2),
    s.line_direction::text,
    s.je_ref_type::text,
    s.src_label::text,
    ('developer_repair:gl_correction:rental-1100-leakage:' || s.line_id::text)::text
  FROM src s
  WHERE s.cust_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.journal_entries corr
      WHERE corr.company_id = p_company_id
        AND corr.action_fingerprint = 'developer_repair:gl_correction:rental-1100-leakage:' || s.line_id::text
        AND COALESCE(corr.is_void, FALSE) = FALSE
    )
  ORDER BY s.je_date DESC, s.line_amt DESC;
END;
$$;

COMMENT ON FUNCTION public.list_rental_1100_leakage_defects(UUID, UUID) IS
  'Detect mobile rental GL rows posted to AR control 1100 instead of AR-CUS* sub-ledgers.';

GRANT EXECUTE ON FUNCTION public.list_rental_1100_leakage_defects(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_rental_1100_leakage_defects(UUID, UUID) TO service_role;

-- ─── 2. Parametric line validator ───
CREATE OR REPLACE FUNCTION public.developer_repair_validate_parametric_gl_lines(
  p_company_id UUID,
  p_contact_id UUID,
  p_lines JSONB
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line JSONB;
  v_count INT := 0;
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
  v_has_control BOOLEAN := FALSE;
  v_has_party BOOLEAN := FALSE;
  v_amt NUMERIC;
  v_code TEXT;
  v_acct_id UUID;
  v_linked UUID;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'Parametric GL lines must be a JSON array';
  END IF;

  v_count := jsonb_array_length(p_lines);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Parametric GL correction requires exactly 2 lines, got %', v_count;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    v_amt := GREATEST(
      COALESCE((v_line->>'debit')::numeric, 0),
      COALESCE((v_line->>'credit')::numeric, 0)
    );
    IF v_amt > 500000 THEN
      RAISE EXCEPTION 'Parametric GL line amount exceeds cap (Rs 500,000)';
    END IF;
    IF v_amt <= 0 THEN
      RAISE EXCEPTION 'Parametric GL line amount must be positive';
    END IF;

    v_code := upper(trim(COALESCE(v_line->>'accountCode', '')));
    IF v_code = '1100' THEN
      v_has_control := TRUE;
    ELSIF v_code LIKE 'AR-%' THEN
      v_has_party := TRUE;
      SELECT a.id, a.linked_contact_id
        INTO v_acct_id, v_linked
      FROM public.accounts a
      WHERE a.company_id = p_company_id
        AND upper(trim(COALESCE(a.code, ''))) = v_code
        AND COALESCE(a.is_active, TRUE)
      LIMIT 1;
      IF v_acct_id IS NULL THEN
        RAISE EXCEPTION 'Party AR account % not found for company', v_code;
      END IF;
      IF p_contact_id IS NOT NULL AND v_linked IS DISTINCT FROM p_contact_id THEN
        RAISE EXCEPTION 'Party AR account % is not linked to contact %', v_code, p_contact_id;
      END IF;
    ELSE
      RAISE EXCEPTION 'Parametric GL line account % not whitelisted (1100 or AR-* only)', v_code;
    END IF;

    v_total_debit := v_total_debit + COALESCE((v_line->>'debit')::numeric, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::numeric, 0);
  END LOOP;

  IF NOT v_has_control OR NOT v_has_party THEN
    RAISE EXCEPTION 'Parametric GL correction must include one 1100 line and one AR-* line';
  END IF;

  IF abs(v_total_debit - v_total_credit) > 0.02 THEN
    RAISE EXCEPTION 'Parametric GL correction lines are not balanced (Dr % Cr %)', v_total_debit, v_total_credit;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.developer_repair_validate_parametric_gl_lines(UUID, UUID, JSONB) IS
  'Validate additive parametric GL correction: balanced 1100 + AR-* only, amount cap Rs 500k.';

GRANT EXECUTE ON FUNCTION public.developer_repair_validate_parametric_gl_lines(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_repair_validate_parametric_gl_lines(UUID, UUID, JSONB) TO service_role;

-- ─── 3. Before-state builder for rental leakage defect ───
CREATE OR REPLACE FUNCTION public.developer_repair_gl_correction_before_rental_leakage(
  p_company_id UUID,
  p_defect_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_defect TEXT := lower(trim(COALESCE(p_defect_id, '')));
  v_line_id UUID;
  v_row RECORD;
  v_control_id UUID;
  v_party_ar UUID;
  v_party_code TEXT;
  v_amt NUMERIC;
  v_direction TEXT;
  v_fingerprint TEXT;
  v_corr_lines JSONB;
  v_wrong_row JSONB;
BEGIN
  IF v_defect NOT LIKE 'rental-1100-leakage:%' THEN
    RAISE EXCEPTION 'Invalid rental leakage defect id: %', p_defect_id;
  END IF;

  v_line_id := (regexp_replace(v_defect, '^rental-1100-leakage:', ''))::uuid;
  v_fingerprint := 'developer_repair:gl_correction:' || v_defect;

  IF EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.company_id = p_company_id
      AND je.action_fingerprint = v_fingerprint
      AND COALESCE(je.is_void, FALSE) = FALSE
  ) THEN
    RAISE EXCEPTION 'GL correction already applied for defect %', p_defect_id;
  END IF;

  SELECT a.id INTO v_control_id
  FROM public.accounts a
  WHERE a.company_id = p_company_id AND trim(COALESCE(a.code, '')) = '1100'
  LIMIT 1;

  SELECT
    jel.id AS line_id,
    je.id AS je_id,
    je.entry_no,
    je.reference_type,
    jel.debit,
    jel.credit,
    COALESCE(r.customer_id, pay.contact_id) AS contact_id,
    COALESCE(c.name, r.customer_name, pay.contact_name, 'Customer') AS customer_name,
    COALESCE(r.booking_no, pay.reference_number, je.entry_no) AS source_label,
    je.branch_id
  INTO v_row
  FROM public.journal_entry_lines jel
  INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  LEFT JOIN public.rentals r ON je.reference_type = 'rental' AND je.reference_id = r.id
  LEFT JOIN public.payments pay ON je.payment_id = pay.id
  LEFT JOIN public.contacts c ON c.id = COALESCE(r.customer_id, pay.contact_id)
  WHERE jel.id = v_line_id
    AND je.company_id = p_company_id
    AND jel.account_id = v_control_id
    AND COALESCE(je.is_void, FALSE) = FALSE;

  IF NOT FOUND OR v_row.contact_id IS NULL THEN
    RAISE EXCEPTION 'Rental 1100 leakage source line not found or contact missing: %', p_defect_id;
  END IF;

  v_party_ar := public._ensure_ar_subaccount_for_contact(p_company_id, v_row.contact_id);
  SELECT trim(COALESCE(a.code, '')) INTO v_party_code
  FROM public.accounts a WHERE a.id = v_party_ar LIMIT 1;

  IF v_party_ar IS NULL OR v_party_code = '' OR v_party_code = '1100' THEN
    RAISE EXCEPTION 'Could not resolve AR sub-ledger for contact %', v_row.contact_id;
  END IF;

  v_amt := round(GREATEST(COALESCE(v_row.debit, 0), COALESCE(v_row.credit, 0)), 2);
  IF v_amt <= 0 THEN
    RAISE EXCEPTION 'Source line amount must be positive';
  END IF;

  IF COALESCE(v_row.debit, 0) > 0.001 THEN
    v_direction := 'debit_on_control';
    v_corr_lines := jsonb_build_array(
      jsonb_build_object('accountCode', v_party_code, 'debit', v_amt, 'credit', 0,
        'description', format('Re-route AR debit from 1100 to %s (%s)', v_party_code, v_row.source_label)),
      jsonb_build_object('accountCode', '1100', 'debit', 0, 'credit', v_amt,
        'description', format('Clear erroneous debit on 1100 (%s)', v_row.entry_no))
    );
    v_wrong_row := jsonb_build_object(
      'entryNo', v_row.entry_no,
      'accountCode', '1100',
      'debit', v_amt,
      'credit', 0,
      'note', format('Rental revenue Dr on 1100 instead of %s — remains unchanged', v_party_code)
    );
  ELSE
    v_direction := 'credit_on_control';
    v_corr_lines := jsonb_build_array(
      jsonb_build_object('accountCode', '1100', 'debit', v_amt, 'credit', 0,
        'description', format('Clear erroneous credit on 1100 (%s)', v_row.entry_no)),
      jsonb_build_object('accountCode', v_party_code, 'debit', 0, 'credit', v_amt,
        'description', format('Re-route AR credit from 1100 to %s (%s)', v_party_code, v_row.source_label))
    );
    v_wrong_row := jsonb_build_object(
      'entryNo', v_row.entry_no,
      'accountCode', '1100',
      'debit', 0,
      'credit', v_amt,
      'note', format('Rental payment Cr on 1100 instead of %s — remains unchanged', v_party_code)
    );
  END IF;

  PERFORM public.developer_repair_validate_parametric_gl_lines(
    p_company_id, v_row.contact_id, v_corr_lines
  );

  RETURN jsonb_build_object(
    'defectId', v_defect,
    'direction', v_direction,
    'orphanAmount', v_amt,
    'partyArAccountCode', v_party_code,
    'wrongCreditAccountCode', '1100',
    'sourceEntryNo', v_row.entry_no,
    'sourceJeId', v_row.je_id,
    'sourceLineId', v_row.line_id,
    'sourceLabel', v_row.source_label,
    'contactId', v_row.contact_id,
    'customerName', v_row.customer_name,
    'originalWrongRows', jsonb_build_array(v_wrong_row),
    'correctionLines', v_corr_lines
  );
END;
$$;

COMMENT ON FUNCTION public.developer_repair_gl_correction_before_rental_leakage(UUID, TEXT) IS
  'Build dry-run before JSON for rental 1100 leakage parametric GL correction.';

GRANT EXECUTE ON FUNCTION public.developer_repair_gl_correction_before_rental_leakage(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_repair_gl_correction_before_rental_leakage(UUID, TEXT) TO service_role;

-- ─── 4. Extend create_gl_correction_journal with target router ───
CREATE OR REPLACE FUNCTION public.create_gl_correction_journal(
  p_company_id UUID,
  p_repair_target TEXT,
  p_dry_run_hash TEXT,
  p_confirm_phrase TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target TEXT := lower(trim(COALESCE(p_repair_target, '')));
  v_phrase TEXT := trim(COALESCE(p_confirm_phrase, ''));
  v_hash TEXT := lower(trim(COALESCE(p_dry_run_hash, '')));
  v_before JSONB;
  v_after JSONB;
  v_expected_hash TEXT;
  v_branch_id UUID;
  v_entry_no TEXT;
  v_je_id UUID;
  v_audit_id UUID;
  v_wrong_acct UUID;
  v_party_ar UUID;
  v_orphan NUMERIC := 150;
  v_fingerprint TEXT;
  v_existing UUID;
  v_sale_id UUID;
  v_line JSONB;
  v_acct_id UUID;
  v_desc TEXT;
  v_source_je_id UUID;
  v_party_code TEXT;
  v_contact_id UUID;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id required';
  END IF;

  IF v_phrase <> 'APPLY GL CORRECTION' THEN
    RAISE EXCEPTION 'Confirm phrase must be exactly: APPLY GL CORRECTION';
  END IF;

  -- ─── HQ-SL-0003 (unchanged path) ───
  IF v_target = 'hq-sl-0003-orphan-ar' THEN
    v_fingerprint := 'developer_repair:gl_correction:hq-sl-0003-orphan-ar';

    SELECT je.id INTO v_existing
    FROM journal_entries je
    WHERE je.company_id = p_company_id
      AND je.action_fingerprint = v_fingerprint
      AND COALESCE(je.is_void, false) = false
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RAISE EXCEPTION 'GL correction already applied (active JE %)', v_existing;
    END IF;

    v_before := public.developer_repair_gl_correction_before_hq_sl_0003(p_company_id);
    v_expected_hash := public.developer_repair_compute_gl_correction_dry_run_hash(p_company_id);

    IF v_hash = '' OR v_hash <> v_expected_hash THEN
      RAISE EXCEPTION 'Dry-run hash mismatch — re-run dry-run preview before apply';
    END IF;

    SELECT s.id, s.branch_id INTO v_sale_id, v_branch_id
    FROM sales s
    WHERE s.company_id = p_company_id AND s.invoice_no = 'HQ-SL-0003'
    LIMIT 1;

    SELECT id INTO v_party_ar FROM accounts WHERE company_id = p_company_id AND code = 'AR-CUS0000' LIMIT 1;
    SELECT id INTO v_wrong_acct FROM accounts WHERE company_id = p_company_id AND code = '1100' LIMIT 1;

    v_entry_no := public.generate_document_number(p_company_id, v_branch_id, 'MANUAL_JOURNAL', false);

    INSERT INTO journal_entries (
      company_id, branch_id, entry_no, entry_date, description,
      reference_type, reference_id, created_by, is_posted, action_fingerprint
    )
    VALUES (
      p_company_id, v_branch_id, v_entry_no, CURRENT_DATE,
      'GL correction: JE-0161 credited 1100 not AR-CUS0000 for cancelled HQ-SL-0003',
      'gl_correction', v_sale_id, p_user_id, true, v_fingerprint
    )
    RETURNING id INTO v_je_id;

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES
      (v_je_id, v_wrong_acct, v_orphan, 0, 'Clear erroneous reversal credit on 1100 (HQ-SL-0003)'),
      (v_je_id, v_party_ar, 0, v_orphan, 'Clear orphan Dr on AR-CUS0000 from HQ-SL-0003 cancel mismatch');

    BEGIN
      UPDATE journal_entries SET total_debit = v_orphan, total_credit = v_orphan WHERE id = v_je_id;
    EXCEPTION WHEN undefined_column THEN NULL;
    END;

    v_after := v_before || jsonb_build_object(
      'newCorrectionJe', jsonb_build_object(
        'journalEntryId', v_je_id, 'entryNo', v_entry_no,
        'referenceType', 'gl_correction', 'totalDebit', v_orphan, 'totalCredit', v_orphan
      ),
      'note', 'Additive correction JE only — JE-0160, JE-0161, JE-0168 unchanged'
    );

  -- ─── Rental 1100 leakage (parametric per line) ───
  ELSIF v_target LIKE 'rental-1100-leakage:%' THEN
    v_fingerprint := 'developer_repair:gl_correction:' || v_target;

    SELECT je.id INTO v_existing
    FROM journal_entries je
    WHERE je.company_id = p_company_id
      AND je.action_fingerprint = v_fingerprint
      AND COALESCE(je.is_void, false) = false
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RAISE EXCEPTION 'GL correction already applied (active JE %)', v_existing;
    END IF;

    v_before := public.developer_repair_gl_correction_before_rental_leakage(p_company_id, v_target);

    v_expected_hash := public.developer_repair_compute_dry_run_hash(
      'gl.create_correction_draft',
      jsonb_build_object('defectId', v_target),
      v_before
    );

    IF v_hash = '' OR v_hash <> v_expected_hash THEN
      RAISE EXCEPTION 'Dry-run hash mismatch — re-run dry-run preview before apply';
    END IF;

    v_orphan := (v_before->>'orphanAmount')::numeric;
    v_party_code := v_before->>'partyArAccountCode';
    v_contact_id := (v_before->>'contactId')::uuid;
    v_source_je_id := (v_before->>'sourceJeId')::uuid;

    PERFORM public.developer_repair_validate_parametric_gl_lines(
      p_company_id, v_contact_id, v_before->'correctionLines'
    );

    SELECT je.branch_id INTO v_branch_id
    FROM journal_entries je WHERE je.id = v_source_je_id LIMIT 1;

    v_desc := format(
      'GL correction: rental 1100 leakage — %s → %s',
      v_before->>'sourceEntryNo',
      v_party_code
    );

    v_entry_no := public.generate_document_number(p_company_id, v_branch_id, 'MANUAL_JOURNAL', false);

    INSERT INTO journal_entries (
      company_id, branch_id, entry_no, entry_date, description,
      reference_type, reference_id, created_by, is_posted, action_fingerprint
    )
    VALUES (
      p_company_id, v_branch_id, v_entry_no, CURRENT_DATE,
      v_desc, 'gl_correction', v_source_je_id, p_user_id, true, v_fingerprint
    )
    RETURNING id INTO v_je_id;

    FOR v_line IN SELECT value FROM jsonb_array_elements(v_before->'correctionLines') LOOP
      SELECT a.id INTO v_acct_id
      FROM accounts a
      WHERE a.company_id = p_company_id
        AND upper(trim(COALESCE(a.code, ''))) = upper(trim(v_line->>'accountCode'))
      LIMIT 1;
      IF v_acct_id IS NULL THEN
        RAISE EXCEPTION 'Account not found for code %', v_line->>'accountCode';
      END IF;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES (
        v_je_id, v_acct_id,
        COALESCE((v_line->>'debit')::numeric, 0),
        COALESCE((v_line->>'credit')::numeric, 0),
        COALESCE(v_line->>'description', v_desc)
      );
    END LOOP;

    BEGIN
      UPDATE journal_entries SET total_debit = v_orphan, total_credit = v_orphan WHERE id = v_je_id;
    EXCEPTION WHEN undefined_column THEN NULL;
    END;

    v_after := v_before || jsonb_build_object(
      'newCorrectionJe', jsonb_build_object(
        'journalEntryId', v_je_id, 'entryNo', v_entry_no,
        'referenceType', 'gl_correction', 'totalDebit', v_orphan, 'totalCredit', v_orphan
      ),
      'note', format('Additive correction for rental 1100 leakage — source line %s unchanged', v_before->>'sourceLineId')
    );

  ELSE
    RAISE EXCEPTION 'Unknown or unsupported repair target: %', p_repair_target;
  END IF;

  INSERT INTO developer_repair_audit (
    company_id, user_id, action_id, risk_level, target_table, target_id,
    before_json, after_json, dry_run_hash, confirm_phrase, status
  )
  VALUES (
    p_company_id, p_user_id, 'gl.create_correction_draft', 'high',
    'journal_entries', v_je_id::text,
    v_before, v_after, v_expected_hash, v_phrase, 'success'
  )
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'success', true,
    'journal_entry_id', v_je_id,
    'entry_no', v_entry_no,
    'audit_id', v_audit_id,
    'before', v_before,
    'after', v_after
  );
END;
$$;

COMMENT ON FUNCTION public.create_gl_correction_journal IS
  'Additive GL correction JE. Targets: hq-sl-0003-orphan-ar, rental-1100-leakage:{line_id}.';

NOTIFY pgrst, 'reload schema';
