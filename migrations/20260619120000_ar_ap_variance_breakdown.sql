-- AR/AP receivables variance breakdown + as-of filter on party GL balances.

CREATE OR REPLACE FUNCTION public.get_contact_party_gl_balances(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT NULL
)
RETURNS TABLE (
  contact_id UUID,
  gl_ar_receivable NUMERIC,
  gl_ap_payable NUMERIC,
  gl_worker_payable NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ar_control AS (
    SELECT a.id AS ar_id
    FROM public.accounts a
    WHERE a.company_id = p_company_id
      AND TRIM(COALESCE(a.code, '')) = '1100'
      AND COALESCE(a.is_active, TRUE)
    LIMIT 1
  ),
  ar_subtree AS (
    WITH RECURSIVE sub AS (
      SELECT c.ar_id AS id FROM ar_control c WHERE c.ar_id IS NOT NULL
      UNION ALL
      SELECT a.id
      FROM public.accounts a
      INNER JOIN sub s ON a.parent_id = s.id
      WHERE a.company_id = p_company_id AND COALESCE(a.is_active, TRUE)
    )
    SELECT id FROM sub
  ),
  ap_control AS (
    SELECT a.id AS ap_id
    FROM public.accounts a
    WHERE a.company_id = p_company_id
      AND TRIM(COALESCE(a.code, '')) = '2000'
      AND COALESCE(a.is_active, TRUE)
    LIMIT 1
  ),
  ap_subtree AS (
    WITH RECURSIVE sub AS (
      SELECT c.ap_id AS id FROM ap_control c WHERE c.ap_id IS NOT NULL
      UNION ALL
      SELECT a.id
      FROM public.accounts a
      INNER JOIN sub s ON a.parent_id = s.id
      WHERE a.company_id = p_company_id AND COALESCE(a.is_active, TRUE)
    )
    SELECT id FROM sub
  ),
  wp_control AS (
    SELECT a.id AS wp_id
    FROM public.accounts a
    WHERE a.company_id = p_company_id
      AND TRIM(COALESCE(a.code, '')) = '2010'
      AND COALESCE(a.is_active, TRUE)
    LIMIT 1
  ),
  wp_subtree AS (
    WITH RECURSIVE sub AS (
      SELECT c.wp_id AS id FROM wp_control c WHERE c.wp_id IS NOT NULL
      UNION ALL
      SELECT a.id
      FROM public.accounts a
      INNER JOIN sub s ON a.parent_id = s.id
      WHERE a.company_id = p_company_id AND COALESCE(a.is_active, TRUE)
    )
    SELECT id FROM sub
  ),
  acct AS (
    SELECT
      (SELECT a.id FROM public.accounts a
       WHERE a.company_id = p_company_id AND TRIM(COALESCE(a.code, '')) = '1180' AND COALESCE(a.is_active, TRUE) LIMIT 1) AS wa_id
  ),
  resolved AS (
    SELECT
      jel.account_id,
      jel.debit,
      jel.credit,
      je.id AS journal_entry_id,
      acc.linked_contact_id AS acc_linked_contact_id,
      CASE
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'correction_reversal'
          AND je.reference_id IS NOT NULL
          AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public._gl_resolve_party_id_for_journal_entry(p_company_id, je.reference_id::uuid)
        ELSE public._gl_resolve_party_id_for_journal_entry(p_company_id, je.id)
      END AS party_id_resolved
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    LEFT JOIN public.accounts acc ON acc.id = jel.account_id AND acc.company_id = p_company_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND (p_as_of_date IS NULL OR je.entry_date <= p_as_of_date)
      AND (
        p_branch_id IS NULL
        OR je.branch_id IS NULL
        OR je.branch_id = p_branch_id
      )
  ),
  ar_agg AS (
    SELECT x.party_key AS party_id, SUM(x.dr - x.cr) AS net
    FROM (
      SELECT
        r.debit AS dr,
        r.credit AS cr,
        CASE
          WHEN r.acc_linked_contact_id IS NOT NULL THEN r.acc_linked_contact_id
          ELSE r.party_id_resolved
        END AS party_key
      FROM resolved r
      WHERE r.account_id IN (SELECT id FROM ar_subtree)
    ) x
    WHERE x.party_key IS NOT NULL
    GROUP BY x.party_key
  ),
  ap_agg AS (
    SELECT x.party_key AS party_id, SUM(x.cr - x.dr) AS net
    FROM (
      SELECT
        r.debit AS dr,
        r.credit AS cr,
        CASE
          WHEN r.acc_linked_contact_id IS NOT NULL THEN r.acc_linked_contact_id
          ELSE r.party_id_resolved
        END AS party_key
      FROM resolved r
      WHERE r.account_id IN (SELECT id FROM ap_subtree)
    ) x
    WHERE x.party_key IS NOT NULL
    GROUP BY x.party_key
  ),
  wp_agg AS (
    SELECT x.party_key AS party_id, SUM(x.cr - x.dr) AS net
    FROM (
      SELECT
        r.debit AS dr,
        r.credit AS cr,
        CASE
          WHEN r.acc_linked_contact_id IS NOT NULL THEN r.acc_linked_contact_id
          ELSE r.party_id_resolved
        END AS party_key
      FROM resolved r
      WHERE r.account_id IN (SELECT id FROM wp_subtree)
    ) x
    WHERE x.party_key IS NOT NULL
    GROUP BY x.party_key
  ),
  wa_agg AS (
    SELECT r.party_id_resolved AS party_id, SUM(r.debit - r.credit) AS net_dr
    FROM resolved r
    CROSS JOIN acct
    WHERE acct.wa_id IS NOT NULL AND r.account_id = acct.wa_id AND r.party_id_resolved IS NOT NULL
    GROUP BY r.party_id_resolved
  ),
  wk AS (
    SELECT
      COALESCE(wp.party_id, wa.party_id) AS party_id,
      GREATEST(0::numeric, COALESCE(wp.net, 0::numeric) - COALESCE(wa.net_dr, 0::numeric)) AS net_payable
    FROM wp_agg wp
    FULL OUTER JOIN wa_agg wa ON wp.party_id = wa.party_id
  )
  SELECT
    c.id AS contact_id,
    COALESCE(ar.net, 0)::numeric AS gl_ar_receivable,
    COALESCE(ap.net, 0)::numeric AS gl_ap_payable,
    COALESCE(wk.net_payable, 0)::numeric AS gl_worker_payable
  FROM public.contacts c
  LEFT JOIN ar_agg ar ON ar.party_id = c.id
  LEFT JOIN ap_agg ap ON ap.party_id = c.id
  LEFT JOIN wk ON wk.party_id = c.id
  WHERE c.company_id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID, DATE) IS
  'GL per-contact balances; optional p_as_of_date filters JEs by entry_date (parity with integrity lab snapshot).';

GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID, DATE) TO service_role;

-- ─── Receivables variance breakdown ───
CREATE OR REPLACE FUNCTION public.ar_ap_receivables_variance_breakdown(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_as_of DATE := COALESCE(p_as_of_date, CURRENT_DATE);
  v_gl_raw NUMERIC := 0;
  v_op_clamped NUMERIC := 0;
  v_op_signed NUMERIC := 0;
  v_op_lifetime_clamped NUMERIC := 0;
  v_negative_clamped NUMERIC := 0;
  v_as_of_delta NUMERIC := 0;
  v_branch_null NUMERIC := 0;
  v_unmapped_ctrl NUMERIC := 0;
  v_subtree_gap NUMERIC := 0;
  v_variance NUMERIC := 0;
  v_explained NUMERIC := 0;
  v_residual NUMERIC := 0;
  v_control_id UUID;
  v_neg_contacts JSONB := '[]'::jsonb;
  v_buckets JSONB := '[]'::jsonb;
  v_sample_unmapped UUID[] := ARRAY[]::uuid[];
  v_sample_branch UUID[] := ARRAY[]::uuid[];
BEGIN
  SELECT COALESCE(SUM(CASE WHEN v.control_bucket = 'AR' THEN v.debit - v.credit ELSE 0 END), 0)
  INTO v_gl_raw
  FROM public.v_reconciliation_ar_ap_line_audit v
  WHERE v.company_id = p_company_id
    AND v.entry_date <= v_as_of
    AND (
      p_branch_id IS NULL
      OR (v.branch_id IS NOT NULL AND v.branch_id = p_branch_id)
    );

  SELECT
    COALESCE(SUM(GREATEST(0, gl_ar_receivable)), 0),
    COALESCE(SUM(gl_ar_receivable), 0)
  INTO v_op_clamped, v_op_signed
  FROM public.get_contact_party_gl_balances(p_company_id, p_branch_id, v_as_of);

  SELECT COALESCE(SUM(GREATEST(0, gl_ar_receivable)), 0)
  INTO v_op_lifetime_clamped
  FROM public.get_contact_party_gl_balances(p_company_id, p_branch_id, NULL);

  v_variance := v_op_clamped - v_gl_raw;
  v_negative_clamped := v_op_clamped - v_op_signed;
  v_as_of_delta := v_op_lifetime_clamped - v_op_clamped;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'contactId', c.id,
      'contactName', c.name,
      'signedAr', round(b.gl_ar_receivable, 2),
      'clampedLoss', round(ABS(LEAST(0, b.gl_ar_receivable)), 2)
    ) ORDER BY b.gl_ar_receivable ASC
  ), '[]'::jsonb)
  INTO v_neg_contacts
  FROM public.get_contact_party_gl_balances(p_company_id, p_branch_id, v_as_of) b
  INNER JOIN public.contacts c ON c.id = b.contact_id
  WHERE b.gl_ar_receivable < -0.001;

  IF p_branch_id IS NOT NULL THEN
    SELECT COALESCE(SUM(jel.debit - jel.credit), 0)
    INTO v_branch_null
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    INNER JOIN public.accounts a ON a.id = jel.account_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND je.entry_date <= v_as_of
      AND je.branch_id IS NULL
      AND (
        trim(COALESCE(a.code, '')) = '1100'
        OR (
          lower(COALESCE(a.name, '')) LIKE '%receivable%'
          AND lower(COALESCE(a.type::text, '')) LIKE '%asset%'
        )
      );

    SELECT COALESCE(array_agg(DISTINCT je.id), ARRAY[]::uuid[])
    INTO v_sample_branch
    FROM public.journal_entries je
    INNER JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
    INNER JOIN public.accounts a ON a.id = jel.account_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND je.entry_date <= v_as_of
      AND je.branch_id IS NULL
      AND (
        trim(COALESCE(a.code, '')) = '1100'
        OR lower(COALESCE(a.name, '')) LIKE '%receivable%'
      )
    LIMIT 10;
  END IF;

  SELECT a.id INTO v_control_id
  FROM public.accounts a
  WHERE a.company_id = p_company_id AND trim(COALESCE(a.code, '')) = '1100'
  LIMIT 1;

  IF v_control_id IS NOT NULL THEN
    SELECT COALESCE(SUM(jel.debit - jel.credit), 0)
    INTO v_unmapped_ctrl
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND je.entry_date <= v_as_of
      AND jel.account_id = v_control_id
      AND (
        p_branch_id IS NULL
        OR (je.branch_id IS NOT NULL AND je.branch_id = p_branch_id)
      )
      AND public._gl_resolve_party_id_for_journal_entry(p_company_id, je.id) IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.accounts acc
        WHERE acc.id = jel.account_id AND acc.linked_contact_id IS NOT NULL
      );

    SELECT COALESCE(array_agg(DISTINCT je.id), ARRAY[]::uuid[])
    INTO v_sample_unmapped
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND je.entry_date <= v_as_of
      AND jel.account_id = v_control_id
      AND public._gl_resolve_party_id_for_journal_entry(p_company_id, je.id) IS NULL
    LIMIT 10;
  END IF;

  -- Party subtree signed minus GL snapshot (scope gap; positive = operational higher)
  v_subtree_gap := v_op_signed - v_gl_raw;

  -- Explained = clamped − raw decomposes into negative clamp + (signed − raw) + timing/branch deltas
  v_explained := v_negative_clamped + v_subtree_gap + v_as_of_delta + v_branch_null;
  v_residual := v_variance - v_explained;

  v_buckets := jsonb_build_array(
    jsonb_build_object(
      'key', 'negative_clamped_contacts',
      'label', 'Negative AR contacts zeroed in operational sum',
      'amount', round(v_negative_clamped, 2),
      'lineCount', jsonb_array_length(v_neg_contacts),
      'sampleJournalEntryIds', '[]'::jsonb
    ),
    jsonb_build_object(
      'key', 'as_of_lifetime_delta',
      'label', 'Lifetime vs as-of party GL (operational clamped)',
      'amount', round(v_as_of_delta, 2),
      'lineCount', 0,
      'sampleJournalEntryIds', '[]'::jsonb
    ),
    jsonb_build_object(
      'key', 'branch_null_mismatch',
      'label', 'NULL-branch JEs in party sum but excluded from GL snapshot',
      'amount', round(v_branch_null, 2),
      'lineCount', COALESCE(array_length(v_sample_branch, 1), 0),
      'sampleJournalEntryIds', to_jsonb(v_sample_branch)
    ),
    jsonb_build_object(
      'key', 'unmapped_control_1100',
      'label', 'Unmapped lines on control 1100 (informational — subset of signed vs GL gap)',
      'amount', round(v_unmapped_ctrl, 2),
      'lineCount', COALESCE(array_length(v_sample_unmapped, 1), 0),
      'sampleJournalEntryIds', to_jsonb(v_sample_unmapped)
    ),
    jsonb_build_object(
      'key', 'subtree_scope_gap',
      'label', 'Party subtree signed AR vs GL snapshot scope',
      'amount', round(v_subtree_gap, 2),
      'lineCount', 0,
      'sampleJournalEntryIds', '[]'::jsonb
    ),
    jsonb_build_object(
      'key', 'residual_unexplained',
      'label', 'Residual after buckets (should be ~0)',
      'amount', round(v_residual, 2),
      'lineCount', 0,
      'sampleJournalEntryIds', '[]'::jsonb
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'asOfDate', v_as_of,
    'varianceTotal', round(v_variance, 2),
    'operationalClamped', round(v_op_clamped, 2),
    'operationalSigned', round(v_op_signed, 2),
    'glArRaw', round(v_gl_raw, 2),
    'buckets', v_buckets,
    'negativeClampedContacts', v_neg_contacts
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.ar_ap_receivables_variance_breakdown(UUID, UUID, DATE) IS
  'Explains operational − GL raw receivables variance into traceable buckets.';

GRANT EXECUTE ON FUNCTION public.ar_ap_receivables_variance_breakdown(UUID, UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ar_ap_receivables_variance_breakdown(UUID, UUID, DATE) TO service_role;

NOTIFY pgrst, 'reload schema';
