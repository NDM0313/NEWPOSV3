-- G-PAR-02: Align get_contact_party_gl_balances with G-REV-01 (correction_reversal → original JE party).
-- Add get_control_unmapped_party_gl_buckets for residual trace (reference_type buckets on control code only).
-- Non-destructive: CREATE OR REPLACE functions + GRANT.

CREATE OR REPLACE FUNCTION public._gl_resolve_party_id_for_journal_entry(
  p_company_id uuid,
  p_je_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $BODY$
  SELECT CASE
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'opening_balance_contact_ar'
      AND je.reference_id IS NOT NULL
      THEN je.reference_id::uuid
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'opening_balance_contact_ap'
      AND je.reference_id IS NOT NULL
      THEN je.reference_id::uuid
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'opening_balance_contact_worker'
      AND je.reference_id IS NOT NULL
      THEN je.reference_id::uuid
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
  END
  FROM public.journal_entries je
  WHERE je.id = p_je_id AND je.company_id = p_company_id;
$BODY$;

COMMENT ON FUNCTION public._gl_resolve_party_id_for_journal_entry(UUID, UUID) IS
  'Internal: map one journal entry to party contact_id for GL party slice (AR/AP/WP/WA lines).';

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
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'correction_reversal'
          AND je.reference_id IS NOT NULL
          AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public._gl_resolve_party_id_for_journal_entry(p_company_id, je.reference_id::uuid)
        ELSE public._gl_resolve_party_id_for_journal_entry(p_company_id, je.id)
      END AS party_id
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND (
        p_branch_id IS NULL
        OR je.branch_id IS NULL
        OR je.branch_id = p_branch_id
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
  'GL per-contact on 1100/2000/2010/1180. Party resolution includes correction_reversal (reference_id = original JE id → party from original). Branch: NULL branch_id JEs included when branch filter set.';

CREATE OR REPLACE FUNCTION public.get_control_unmapped_party_gl_buckets(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_control_code TEXT DEFAULT '1100'
)
RETURNS TABLE (
  reference_type TEXT,
  net_amount NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := UPPER(TRIM(COALESCE(p_control_code, '')));
  v_account_id UUID;
  v_use_ar_convention BOOLEAN;
BEGIN
  SELECT a.id INTO v_account_id
  FROM public.accounts a
  WHERE a.company_id = p_company_id
    AND UPPER(TRIM(COALESCE(a.code, ''))) = v_code
    AND COALESCE(a.is_active, TRUE)
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RETURN;
  END IF;

  v_use_ar_convention := v_code IN ('1100', '1180');

  RETURN QUERY
  WITH resolved AS (
    SELECT
      jel.account_id,
      jel.debit,
      jel.credit,
      je.reference_type,
      CASE
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'correction_reversal'
          AND je.reference_id IS NOT NULL
          AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public._gl_resolve_party_id_for_journal_entry(p_company_id, je.reference_id::uuid)
        ELSE public._gl_resolve_party_id_for_journal_entry(p_company_id, je.id)
      END AS party_id
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND (
        p_branch_id IS NULL
        OR je.branch_id IS NULL
        OR je.branch_id = p_branch_id
      )
      AND jel.account_id = v_account_id
  ),
  bucketed AS (
    SELECT
      COALESCE(LOWER(TRIM(COALESCE(r.reference_type, ''))), '(blank)') AS rt,
      SUM(
        CASE
          WHEN v_use_ar_convention THEN (r.debit - r.credit)
          ELSE (r.credit - r.debit)
        END
      )::numeric AS net_amt
    FROM resolved r
    WHERE r.party_id IS NULL
    GROUP BY 1
    HAVING ABS(SUM(
      CASE
        WHEN v_use_ar_convention THEN (r.debit - r.credit)
        ELSE (r.credit - r.debit)
      END
    )) > 0.0000001
  )
  SELECT b.rt::text, ROUND(b.net_amt::numeric, 4)
  FROM bucketed b
  ORDER BY ABS(b.net_amt) DESC;
END;
$$;

COMMENT ON FUNCTION public.get_control_unmapped_party_gl_buckets(UUID, UUID, TEXT) IS
  'Unmapped journal lines on one control account (by code): net per reference_type. 1100/1180 use Dr−Cr; 2000/2010 use Cr−Dr. Sum(net_amount) equals GL residual vs party sum when party RPC uses same resolver.';

GRANT EXECUTE ON FUNCTION public._gl_resolve_party_id_for_journal_entry(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public._gl_resolve_party_id_for_journal_entry(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_control_unmapped_party_gl_buckets(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_control_unmapped_party_gl_buckets(UUID, UUID, TEXT) TO service_role;
