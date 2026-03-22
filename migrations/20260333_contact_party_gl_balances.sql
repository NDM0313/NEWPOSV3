-- Per-contact party balances from journal lines on AR (1100), AP (2000), Worker Payable (2010), Worker Advance (1180).
-- Used by Add Entry / receipt forms for GL-aligned due (manual receipts update GL, not sales.due).
-- Operational open-doc totals remain in get_contact_balances_summary.
-- NOTE: Party resolution parity with the app is in 20260334_get_contact_party_gl_balances_party_parity.sql (supersedes CASE below).

CREATE OR REPLACE FUNCTION public.get_contact_party_gl_balances(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL
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
  WITH acct AS (
    SELECT
      (SELECT a.id FROM public.accounts a
       WHERE a.company_id = p_company_id AND TRIM(COALESCE(a.code, '')) = '1100' AND COALESCE(a.is_active, TRUE) LIMIT 1) AS ar_id,
      (SELECT a.id FROM public.accounts a
       WHERE a.company_id = p_company_id AND TRIM(COALESCE(a.code, '')) = '2000' AND COALESCE(a.is_active, TRUE) LIMIT 1) AS ap_id,
      (SELECT a.id FROM public.accounts a
       WHERE a.company_id = p_company_id AND TRIM(COALESCE(a.code, '')) = '2010' AND COALESCE(a.is_active, TRUE) LIMIT 1) AS wp_id,
      (SELECT a.id FROM public.accounts a
       WHERE a.company_id = p_company_id AND TRIM(COALESCE(a.code, '')) = '1180' AND COALESCE(a.is_active, TRUE) LIMIT 1) AS wa_id
  ),
  resolved AS (
    SELECT
      jel.account_id,
      jel.debit,
      jel.credit,
      je.reference_type,
      je.reference_id,
      je.payment_id,
      CASE
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'manual_receipt' AND je.reference_id IS NOT NULL THEN je.reference_id::uuid
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'sale_extra_expense', 'sale_return') AND je.reference_id IS NOT NULL THEN
          (SELECT s.customer_id FROM public.sales s WHERE s.id = je.reference_id::uuid AND s.company_id = p_company_id LIMIT 1)
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('purchase', 'purchase_return', 'purchase_adjustment') AND je.reference_id IS NOT NULL THEN
          (SELECT p.supplier_id FROM public.purchases p WHERE p.id = je.reference_id::uuid AND p.company_id = p_company_id LIMIT 1)
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'worker_payment' AND je.reference_id IS NOT NULL THEN je.reference_id::uuid
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'worker_advance_settlement' AND je.reference_id IS NOT NULL THEN je.reference_id::uuid
        WHEN je.payment_id IS NOT NULL THEN
          (SELECT pay.contact_id FROM public.payments pay WHERE pay.id = je.payment_id AND pay.company_id = p_company_id LIMIT 1)
        ELSE NULL
      END AS party_id
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND (
        p_branch_id IS NULL
        OR (je.branch_id IS NOT NULL AND je.branch_id = p_branch_id)
      )
  ),
  ar_agg AS (
    SELECT r.party_id, SUM(r.debit - r.credit) AS net
    FROM resolved r
    CROSS JOIN acct
    WHERE acct.ar_id IS NOT NULL AND r.account_id = acct.ar_id AND r.party_id IS NOT NULL
    GROUP BY r.party_id
  ),
  ap_agg AS (
    SELECT r.party_id, SUM(r.credit - r.debit) AS net
    FROM resolved r
    CROSS JOIN acct
    WHERE acct.ap_id IS NOT NULL AND r.account_id = acct.ap_id AND r.party_id IS NOT NULL
    GROUP BY r.party_id
  ),
  wp_agg AS (
    SELECT r.party_id, SUM(r.credit - r.debit) AS net
    FROM resolved r
    CROSS JOIN acct
    WHERE acct.wp_id IS NOT NULL AND r.account_id = acct.wp_id AND r.party_id IS NOT NULL
    GROUP BY r.party_id
  ),
  wa_agg AS (
    SELECT r.party_id, SUM(r.debit - r.credit) AS net_dr
    FROM resolved r
    CROSS JOIN acct
    WHERE acct.wa_id IS NOT NULL AND r.account_id = acct.wa_id AND r.party_id IS NOT NULL
    GROUP BY r.party_id
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

COMMENT ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID) IS
  'GL-aligned per-contact balances from journal lines on AR/AP/Worker Payable/Advance (party resolved from JE reference_type, reference_id, payment_id).';

GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID) TO service_role;
