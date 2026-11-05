-- Phase 2b — bulk per-contact party GL balances using unified ledger basis + branch rules.
-- Additive only: mirrors get_contact_party_gl_balances return shape for AR/AP Diagnostics.

CREATE OR REPLACE FUNCTION public.get_unified_contact_party_gl_balances(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT NULL,
  p_basis TEXT DEFAULT 'effective_party'
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
AS $BODY$
BEGIN
  PERFORM public._unified_ledger_assert_caller_access(p_company_id, p_branch_id);

  p_basis := LOWER(TRIM(COALESCE(p_basis, 'effective_party')));
  IF p_basis NOT IN ('official_gl', 'effective_party', 'audit_full_history') THEN
    p_basis := 'effective_party';
  END IF;

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
  wa_acct AS (
    SELECT a.id AS wa_id
    FROM public.accounts a
    WHERE a.company_id = p_company_id
      AND TRIM(COALESCE(a.code, '')) = '1180'
      AND COALESCE(a.is_active, TRUE)
    LIMIT 1
  ),
  je_lines AS (
    SELECT
      jel.account_id,
      jel.debit AS dr,
      jel.credit AS cr,
      je.reference_type AS ref_type,
      je.action_fingerprint AS action_fp,
      acc.linked_contact_id AS acc_linked_contact_id,
      CASE
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'correction_reversal'
          AND je.reference_id IS NOT NULL
          AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public._gl_resolve_party_id_for_journal_entry(p_company_id, je.reference_id::uuid)
        ELSE public._gl_resolve_party_id_for_journal_entry(p_company_id, je.id)
      END AS party_id_resolved,
      pay.voided_at AS pay_voided_at,
      s.status AS linked_sale_status
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    LEFT JOIN public.accounts acc ON acc.id = jel.account_id AND acc.company_id = p_company_id
    LEFT JOIN public.payments pay ON pay.id = COALESCE(
      je.payment_id,
      CASE
        WHEN lower(trim(COALESCE(je.reference_type, ''))) = 'payment_adjustment'
          AND je.reference_id IS NOT NULL
          AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN je.reference_id::uuid
        ELSE NULL
      END
    )
    LEFT JOIN public.sales s ON s.id = je.reference_id
      AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'sale_adjustment', 'sale_reversal')
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND (p_as_of_date IS NULL OR je.entry_date::date <= p_as_of_date)
      AND public._unified_ledger_strict_branch_includes_row(p_branch_id, je.branch_id, je.reference_type)
  ),
  basis_filtered AS (
    SELECT j.*
    FROM je_lines j
    WHERE public._unified_ledger_basis_includes_row(
      p_basis, j.ref_type, j.action_fp, j.pay_voided_at, j.linked_sale_status::text
    )
  ),
  attributed AS (
    SELECT
      bf.*,
      COALESCE(bf.acc_linked_contact_id, bf.party_id_resolved) AS party_key
    FROM basis_filtered bf
  ),
  ar_agg AS (
    SELECT a.party_key AS party_id, SUM(a.dr - a.cr) AS net
    FROM attributed a
    WHERE a.party_key IS NOT NULL
      AND a.account_id IN (SELECT id FROM ar_subtree)
    GROUP BY a.party_key
  ),
  ap_agg AS (
    SELECT a.party_key AS party_id, SUM(a.cr - a.dr) AS net
    FROM attributed a
    WHERE a.party_key IS NOT NULL
      AND a.account_id IN (SELECT id FROM ap_subtree)
    GROUP BY a.party_key
  ),
  wp_agg AS (
    SELECT a.party_key AS party_id, SUM(a.cr - a.dr) AS net
    FROM attributed a
    WHERE a.party_key IS NOT NULL
      AND a.account_id IN (SELECT id FROM wp_subtree)
    GROUP BY a.party_key
  ),
  wa_agg AS (
    SELECT a.party_id_resolved AS party_id, SUM(a.dr - a.cr) AS net_dr
    FROM attributed a
    CROSS JOIN wa_acct wa
    WHERE wa.wa_id IS NOT NULL
      AND a.account_id = wa.wa_id
      AND a.party_id_resolved IS NOT NULL
    GROUP BY a.party_id_resolved
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
$BODY$;

COMMENT ON FUNCTION public.get_unified_contact_party_gl_balances(UUID, UUID, DATE, TEXT) IS
  'Phase 2b — per-contact AR/AP/worker GL nets using unified basis + strict branch rules (AR/AP Diagnostics).';

GRANT EXECUTE ON FUNCTION public.get_unified_contact_party_gl_balances(UUID, UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_contact_party_gl_balances(UUID, UUID, DATE, TEXT) TO service_role;
