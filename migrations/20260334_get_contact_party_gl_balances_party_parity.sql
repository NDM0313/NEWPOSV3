-- Parity: get_contact_party_gl_balances party resolution matches app extended resolver
-- (partyBalanceTieOutService / runPartyBalanceTieOut). Supersedes logic in 20260333.
--
-- Deterministic CASE order (first match wins):
--   1. manual_receipt          → journal_entries.reference_id (customer/contact uuid)
--   2. manual_payment          → journal_entries.reference_id (supplier/contact uuid)
--   3. sale / sale_return / sale_adjustment / sale_extra_expense → sales.customer_id
--   4. purchase / purchase_return / purchase_adjustment / purchase_reversal → purchases.supplier_id
--   5. worker_payment / worker_advance_settlement → journal_entries.reference_id (worker contact uuid)
--   6. studio_production_stage / studio_production_stage_reversal → studio_production_stages.assigned_worker_id
--   7. rental                  → rentals.customer_id
--   8. payment_id              → payments.contact_id (fallback when rows above did not match)

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
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'manual_receipt'
          AND je.reference_id IS NOT NULL
          THEN je.reference_id::uuid
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'manual_payment'
          AND je.reference_id IS NOT NULL
          THEN je.reference_id::uuid
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'sale_return', 'sale_adjustment', 'sale_extra_expense')
          AND je.reference_id IS NOT NULL
          THEN (
            SELECT s.customer_id FROM public.sales s
            WHERE s.id = je.reference_id::uuid AND s.company_id = p_company_id LIMIT 1
          )
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('purchase', 'purchase_return', 'purchase_adjustment', 'purchase_reversal')
          AND je.reference_id IS NOT NULL
          THEN (
            SELECT p.supplier_id FROM public.purchases p
            WHERE p.id = je.reference_id::uuid AND p.company_id = p_company_id LIMIT 1
          )
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('worker_payment', 'worker_advance_settlement')
          AND je.reference_id IS NOT NULL
          THEN je.reference_id::uuid
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('studio_production_stage', 'studio_production_stage_reversal')
          AND je.reference_id IS NOT NULL
          THEN (
            SELECT st.assigned_worker_id FROM public.studio_production_stages st
            WHERE st.id = je.reference_id::uuid LIMIT 1
          )
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'rental'
          AND je.reference_id IS NOT NULL
          THEN (
            SELECT r.customer_id FROM public.rentals r
            WHERE r.id = je.reference_id::uuid AND r.company_id = p_company_id LIMIT 1
          )
        WHEN je.payment_id IS NOT NULL THEN
          (SELECT pay.contact_id FROM public.payments pay
           WHERE pay.id = je.payment_id AND pay.company_id = p_company_id LIMIT 1)
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
  'GL per-contact balances on 1100/2000/2010/1180. Party resolution order: manual_receipt; manual_payment; sale*; purchase*; worker_*; studio_production_stage*; rental; payment.contact_id.';

GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID) TO service_role;
