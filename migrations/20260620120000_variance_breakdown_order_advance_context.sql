-- Variance breakdown: linked unposted order sales per negative AR contact + clearer bucket labels.

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
      'clampedLoss', round(ABS(LEAST(0, b.gl_ar_receivable)), 2),
      'linkedUnpostedSales', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'saleId', s.id,
            'invoiceNo', COALESCE(NULLIF(trim(s.invoice_no), ''), NULLIF(trim(s.order_no), ''), s.id::text),
            'status', s.status,
            'paidAmount', round(COALESCE(s.paid_amount, 0), 2),
            'documentDate', s.invoice_date
          ) ORDER BY s.invoice_date DESC NULLS LAST
        )
        FROM public.sales s
        WHERE s.company_id = p_company_id
          AND s.customer_id = c.id
          AND lower(trim(s.status::text)) <> 'final'
          AND COALESCE(s.paid_amount, 0) > 0.001
          AND NOT EXISTS (
            SELECT 1 FROM public.journal_entries je
            WHERE je.company_id = p_company_id
              AND COALESCE(je.is_void, FALSE) = FALSE
              AND lower(trim(je.reference_type::text)) = 'sale'
              AND je.reference_id = s.id
          )
      ), '[]'::jsonb)
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

  v_subtree_gap := v_op_signed - v_gl_raw;
  v_explained := v_negative_clamped + v_subtree_gap + v_as_of_delta + v_branch_null;
  v_residual := v_variance - v_explained;

  v_buckets := jsonb_build_array(
    jsonb_build_object(
      'key', 'negative_clamped_contacts',
      'label', 'Order advances / overpayments hidden from total',
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
      'label', '1100 lines without customer (informational)',
      'amount', round(v_unmapped_ctrl, 2),
      'lineCount', COALESCE(array_length(v_sample_unmapped, 1), 0),
      'sampleJournalEntryIds', to_jsonb(v_sample_unmapped)
    ),
    jsonb_build_object(
      'key', 'subtree_scope_gap',
      'label', 'AR sub-ledger vs GL snapshot difference',
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
  'Explains operational − GL raw receivables variance; negative contacts include linked unposted order sales.';

NOTIFY pgrst, 'reload schema';
