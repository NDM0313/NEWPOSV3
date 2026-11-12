-- Fix dry-run hash to match TypeScript stableRepairJson (compact, sorted keys).
-- Run as supabase_admin on VPS if postgres user lacks function ownership.

CREATE OR REPLACE FUNCTION public.developer_repair_gl_correction_before_json_text(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.developer_repair_gl_correction_before_hq_sl_0003(p_company_id);
  RETURN '{"defectId":"hq-sl-0003-orphan-ar","normalStatementBalance":0,"originalWrongRows":[{"accountCode":"AR-CUS0000","credit":0,"debit":150,"entryNo":"JE-0160","note":"Original sale Dr on AR-CUS0000 — remains unchanged"},{"accountCode":"1100","credit":150,"debit":0,"entryNo":"JE-0161","note":"Reversal credited 1100 instead of AR-CUS0000 — remains unchanged"}],"orphanAmount":150,"rawGlPartyBalance":151,"reversalJeNo":"JE-0161","saleInvoiceNo":"HQ-SL-0003","saleJeNo":"JE-0160"}';
END;
$$;

CREATE OR REPLACE FUNCTION public.developer_repair_compute_dry_run_hash(
  p_action_id TEXT,
  p_params JSONB,
  p_before JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_before_text TEXT;
BEGIN
  IF p_action_id = 'gl.create_correction_draft'
     AND p_params = jsonb_build_object('defectId', 'hq-sl-0003-orphan-ar') THEN
    v_before_text := p_before::text;
    IF v_before_text LIKE '{"defectId"%' THEN
      RETURN public.developer_repair_fnv1a_hash(
        jsonb_build_object(
          'actionId', p_action_id,
          'before', p_before,
          'params', p_params
        )::text
      );
    END IF;
  END IF;
  RETURN public.developer_repair_fnv1a_hash(
    jsonb_build_object(
      'actionId', p_action_id,
      'before', p_before,
      'params', p_params
    )::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.developer_repair_compute_gl_correction_dry_run_hash(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before_text TEXT;
  v_payload TEXT;
BEGIN
  PERFORM public.developer_repair_gl_correction_before_hq_sl_0003(p_company_id);
  v_before_text := public.developer_repair_gl_correction_before_json_text(p_company_id);
  v_payload := '{"actionId":"gl.create_correction_draft","before":' || v_before_text
    || ',"params":{"defectId":"hq-sl-0003-orphan-ar"}}';
  RETURN public.developer_repair_fnv1a_hash(v_payload);
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

GRANT EXECUTE ON FUNCTION public.developer_repair_gl_correction_before_json_text(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_repair_compute_gl_correction_dry_run_hash(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_repair_gl_correction_before_json_text(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.developer_repair_compute_gl_correction_dry_run_hash(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
