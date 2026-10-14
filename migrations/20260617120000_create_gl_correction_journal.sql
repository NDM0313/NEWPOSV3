-- Targeted GL correction journal (additive JE only) for Developer Repair Center.
-- Whitelist: hq-sl-0003-orphan-ar (JE-0161 credited 1100 not AR-CUS0000).
-- Does NOT update JE-0160, JE-0161, JE-0168, or any existing journal lines.

CREATE OR REPLACE FUNCTION public.developer_repair_fnv1a_hash(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  i INT;
  c INT;
  h BIGINT := 2166136261;
BEGIN
  IF p_input IS NULL THEN
    RETURN lpad(to_hex(2166136261::bigint), 8, '0');
  END IF;
  FOR i IN 1..length(p_input) LOOP
    c := ascii(substring(p_input FROM i FOR 1));
    h := (h # c) & 4294967295;
    h := (h * 16777619) & 4294967295;
  END LOOP;
  RETURN lpad(to_hex(h), 8, '0');
END;
$$;

COMMENT ON FUNCTION public.developer_repair_fnv1a_hash IS
  'FNV-1a 32-bit hash — matches src/app/lib/developerRepairHash.ts for dry-run verification.';

CREATE OR REPLACE FUNCTION public.developer_repair_compute_dry_run_hash(
  p_action_id TEXT,
  p_params JSONB,
  p_before JSONB
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.developer_repair_fnv1a_hash(
    jsonb_build_object(
      'actionId', p_action_id,
      'before', p_before,
      'params', p_params
    )::text
  );
$$;

CREATE OR REPLACE FUNCTION public.developer_repair_gl_correction_before_hq_sl_0003(
  p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_sale_je RECORD;
  v_rev_je RECORD;
  v_party_ar UUID;
  v_wrong_acct UUID;
  v_orphan NUMERIC := 150;
BEGIN
  SELECT s.id, s.invoice_no, s.status, s.branch_id
  INTO v_sale
  FROM sales s
  WHERE s.company_id = p_company_id
    AND s.invoice_no = 'HQ-SL-0003'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'HQ-SL-0003 not found for company';
  END IF;

  SELECT je.id, je.entry_no
  INTO v_sale_je
  FROM journal_entries je
  WHERE je.company_id = p_company_id
    AND je.entry_no = 'JE-0160'
    AND je.reference_type = 'sale'
    AND je.reference_id = v_sale.id
    AND COALESCE(je.is_void, false) = false
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'JE-0160 sale journal not found for HQ-SL-0003';
  END IF;

  SELECT je.id, je.entry_no
  INTO v_rev_je
  FROM journal_entries je
  WHERE je.company_id = p_company_id
    AND je.entry_no = 'JE-0161'
    AND je.reference_type = 'sale_reversal'
    AND je.reference_id = v_sale.id
    AND COALESCE(je.is_void, false) = false
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'JE-0161 sale_reversal journal not found for HQ-SL-0003';
  END IF;

  SELECT a.id INTO v_party_ar
  FROM accounts a
  WHERE a.company_id = p_company_id AND a.code = 'AR-CUS0000'
  LIMIT 1;

  SELECT a.id INTO v_wrong_acct
  FROM accounts a
  WHERE a.company_id = p_company_id AND a.code = '1100'
  LIMIT 1;

  IF v_party_ar IS NULL OR v_wrong_acct IS NULL THEN
    RAISE EXCEPTION 'AR-CUS0000 or account 1100 missing for company';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM journal_entry_lines jel
    WHERE jel.journal_entry_id = v_sale_je.id
      AND jel.account_id = v_party_ar
      AND abs(COALESCE(jel.debit, 0) - v_orphan) < 0.02
      AND COALESCE(jel.credit, 0) < 0.02
  ) THEN
    RAISE EXCEPTION 'JE-0160 must have Dr 150 on AR-CUS0000 (unchanged precondition)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM journal_entry_lines jel
    WHERE jel.journal_entry_id = v_rev_je.id
      AND jel.account_id = v_wrong_acct
      AND abs(COALESCE(jel.credit, 0) - v_orphan) < 0.02
  ) THEN
    RAISE EXCEPTION 'JE-0161 must credit account 1100 Rs 150 (unchanged precondition)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM journal_entry_lines jel
    WHERE jel.journal_entry_id = v_rev_je.id
      AND jel.account_id = v_party_ar
      AND abs(COALESCE(jel.credit, 0) - v_orphan) < 0.02
  ) THEN
    RAISE EXCEPTION 'JE-0161 already credits AR-CUS0000 — correction not required';
  END IF;

  RETURN jsonb_build_object(
    'defectId', 'hq-sl-0003-orphan-ar',
    'normalStatementBalance', 0,
    'originalWrongRows', jsonb_build_array(
      jsonb_build_object(
        'accountCode', 'AR-CUS0000',
        'credit', 0,
        'debit', 150,
        'entryNo', 'JE-0160',
        'note', 'Original sale Dr on AR-CUS0000 — remains unchanged'
      ),
      jsonb_build_object(
        'accountCode', '1100',
        'credit', 150,
        'debit', 0,
        'entryNo', 'JE-0161',
        'note', 'Reversal credited 1100 instead of AR-CUS0000 — remains unchanged'
      )
    ),
    'orphanAmount', 150,
    'rawGlPartyBalance', 151,
    'reversalJeNo', 'JE-0161',
    'saleInvoiceNo', 'HQ-SL-0003',
    'saleJeNo', 'JE-0160'
  );
END;
$$;

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
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id required';
  END IF;

  IF v_phrase <> 'APPLY GL CORRECTION' THEN
    RAISE EXCEPTION 'Confirm phrase must be exactly: APPLY GL CORRECTION';
  END IF;

  IF v_target <> 'hq-sl-0003-orphan-ar' THEN
    RAISE EXCEPTION 'Unknown or unsupported repair target: %', p_repair_target;
  END IF;

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

  v_expected_hash := public.developer_repair_compute_dry_run_hash(
    'gl.create_correction_draft',
    jsonb_build_object('defectId', 'hq-sl-0003-orphan-ar'),
    v_before
  );

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
    company_id,
    branch_id,
    entry_no,
    entry_date,
    description,
    reference_type,
    reference_id,
    created_by,
    is_posted,
    action_fingerprint
  )
  VALUES (
    p_company_id,
    v_branch_id,
    v_entry_no,
    CURRENT_DATE,
    'GL correction: JE-0161 credited 1100 not AR-CUS0000 for cancelled HQ-SL-0003',
    'gl_correction',
    v_sale_id,
    p_user_id,
    true,
    v_fingerprint
  )
  RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (
      v_je_id,
      v_wrong_acct,
      v_orphan,
      0,
      'Clear erroneous reversal credit on 1100 (HQ-SL-0003)'
    ),
    (
      v_je_id,
      v_party_ar,
      0,
      v_orphan,
      'Clear orphan Dr on AR-CUS0000 from HQ-SL-0003 cancel mismatch'
    );

  BEGIN
    UPDATE journal_entries
    SET total_debit = v_orphan,
        total_credit = v_orphan
    WHERE id = v_je_id;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  v_after := v_before || jsonb_build_object(
    'rawGlPartyBalance', 1,
    'normalStatementBalance', 0,
    'newCorrectionJe', jsonb_build_object(
      'journalEntryId', v_je_id,
      'entryNo', v_entry_no,
      'referenceType', 'gl_correction',
      'totalDebit', v_orphan,
      'totalCredit', v_orphan
    ),
    'note', 'Additive correction JE only — JE-0160, JE-0161, JE-0168 unchanged'
  );

  INSERT INTO developer_repair_audit (
    company_id,
    user_id,
    action_id,
    risk_level,
    target_table,
    target_id,
    before_json,
    after_json,
    dry_run_hash,
    confirm_phrase,
    status
  )
  VALUES (
    p_company_id,
    p_user_id,
    'gl.create_correction_draft',
    'high',
    'journal_entries',
    v_je_id::text,
    v_before,
    v_after,
    v_expected_hash,
    v_phrase,
    'success'
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

GRANT EXECUTE ON FUNCTION public.developer_repair_fnv1a_hash(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_repair_compute_dry_run_hash(TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_repair_gl_correction_before_hq_sl_0003(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_gl_correction_journal(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.developer_repair_fnv1a_hash(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.developer_repair_compute_dry_run_hash(TEXT, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.developer_repair_gl_correction_before_hq_sl_0003(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_gl_correction_journal(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.create_gl_correction_journal IS
  'Developer Repair: additive GL correction JE only. Whitelist targets. Verifies confirm phrase and dry-run hash. Never edits existing JEs.';

NOTIFY pgrst, 'reload schema';
