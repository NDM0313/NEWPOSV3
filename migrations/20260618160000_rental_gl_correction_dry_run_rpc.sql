-- Rental GL correction: server-authoritative dry-run hash (matches TS compact JSON / FNV-1a).
-- Fixes "Dry-run hash mismatch" on apply for rental-1100-leakage targets.

CREATE OR REPLACE FUNCTION public.developer_repair_jsonb_compact_text(p_jsonb JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    regexp_replace(COALESCE(p_jsonb, '{}'::jsonb)::text, ':\s+', ':', 'g'),
    ',\s+',
    ',',
    'g'
  );
$$;

COMMENT ON FUNCTION public.developer_repair_jsonb_compact_text(JSONB) IS
  'Compact JSON text (no spaces after : or ,) for dry-run hash parity with TypeScript stableRepairJson.';

CREATE OR REPLACE FUNCTION public.developer_repair_compute_rental_leakage_dry_run_hash(
  p_company_id UUID,
  p_defect_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_defect TEXT := lower(trim(COALESCE(p_defect_id, '')));
  v_before JSONB;
  v_before_text TEXT;
  v_payload TEXT;
BEGIN
  v_before := public.developer_repair_gl_correction_before_rental_leakage(p_company_id, v_defect);
  v_before_text := public.developer_repair_jsonb_compact_text(v_before);
  v_payload := '{"actionId":"gl.create_correction_draft","before":' || v_before_text
    || ',"params":{"defectId":"' || v_defect || '"}}';
  RETURN public.developer_repair_fnv1a_hash(v_payload);
END;
$$;

COMMENT ON FUNCTION public.developer_repair_compute_rental_leakage_dry_run_hash(UUID, TEXT) IS
  'FNV-1a dry-run hash for rental 1100 leakage GL correction — same payload shape as HQ-SL-0003 compact hash.';

CREATE OR REPLACE FUNCTION public.get_rental_leakage_gl_correction_dry_run(
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
  v_before JSONB;
  v_hash TEXT;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'company_id required');
  END IF;

  IF v_defect NOT LIKE 'rental-1100-leakage:%' THEN
    RETURN jsonb_build_object('ok', false, 'error', format('Invalid rental leakage defect id: %s', p_defect_id));
  END IF;

  v_before := public.developer_repair_gl_correction_before_rental_leakage(p_company_id, v_defect);
  v_hash := public.developer_repair_compute_rental_leakage_dry_run_hash(p_company_id, v_defect);

  RETURN jsonb_build_object(
    'ok', true,
    'defectId', v_defect,
    'before', v_before,
    'dryRunHash', v_hash
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.get_rental_leakage_gl_correction_dry_run(UUID, TEXT) IS
  'Server dry-run for rental 1100 leakage GL correction — before state + hash for UI apply.';

GRANT EXECUTE ON FUNCTION public.developer_repair_jsonb_compact_text(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_repair_jsonb_compact_text(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.developer_repair_compute_rental_leakage_dry_run_hash(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_repair_compute_rental_leakage_dry_run_hash(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_rental_leakage_gl_correction_dry_run(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rental_leakage_gl_correction_dry_run(UUID, TEXT) TO service_role;

-- Fix developer_repair_audit RLS (auth_user_id link pattern)
DROP POLICY IF EXISTS rls_fix_company ON public.developer_repair_audit;
DROP POLICY IF EXISTS developer_repair_audit_company ON public.developer_repair_audit;

CREATE POLICY developer_repair_audit_company ON public.developer_repair_audit
  FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT u.company_id FROM public.users u
      WHERE u.id = auth.uid() OR u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT u.company_id FROM public.users u
      WHERE u.id = auth.uid() OR u.auth_user_id = auth.uid()
    )
  );

-- Patch create_gl_correction_journal rental branch to use rental-specific hash
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
    v_expected_hash := public.developer_repair_compute_rental_leakage_dry_run_hash(p_company_id, v_target);

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

NOTIFY pgrst, 'reload schema';
