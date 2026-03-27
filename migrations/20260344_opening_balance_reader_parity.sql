-- Opening balance JE reader parity (Phase: fresh-company GL / party / integrity).
-- 1) AR/AP heuristic: treat opening_balance_contact_* as mapped (not "unmapped" noise).
-- 2) Branch: company-wide JEs (journal_entries.branch_id IS NULL) visible when p_branch_id is set.
-- 3) get_contact_party_gl_balances: resolve party from opening reference_id on control lines.

CREATE OR REPLACE VIEW public.v_reconciliation_ar_ap_line_audit AS
WITH lines AS (
  SELECT
    je.company_id,
    je.branch_id,
    je.id AS journal_entry_id,
    je.entry_no,
    je.entry_date,
    je.reference_type,
    je.reference_id,
    jel.id AS journal_line_id,
    jel.account_id,
    a.code AS account_code,
    a.name AS account_name,
    a.type AS account_type,
    jel.debit,
    jel.credit,
    CASE
      WHEN trim(COALESCE(a.code, '')) = '1100' THEN 'AR'
      WHEN trim(COALESCE(a.code, '')) = '2000' THEN 'AP'
      WHEN lower(COALESCE(a.name, '')) LIKE '%receivable%'
        AND lower(COALESCE(a.type, '')) LIKE '%asset%' THEN 'AR'
      WHEN lower(COALESCE(a.name, '')) LIKE '%payable%'
        AND lower(COALESCE(a.type, '')) LIKE '%liab%' THEN 'AP'
      ELSE NULL
    END AS control_bucket
  FROM public.journal_entry_lines jel
  INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  INNER JOIN public.accounts a ON a.id = jel.account_id AND COALESCE(a.is_active, TRUE) = TRUE
  WHERE COALESCE(je.is_void, FALSE) = FALSE
)
SELECT
  l.*,
  CASE
    WHEN l.control_bucket = 'AR' THEN
      CASE
        WHEN l.reference_id IS NULL THEN TRUE
        WHEN lower(COALESCE(l.reference_type, '')) IN (
          'sale', 'sale_reversal', 'sale_adjustment', 'sale_extra_expense', 'sale_return',
          'credit_note', 'refund', 'manual_receipt', 'on_account', 'rental',
          'shipment', 'shipment_reversal', 'studio_production', 'studio_production_stage',
          'studio_production_stage_reversal', 'payment_adjustment',
          'opening_balance_contact_ar'
        ) THEN FALSE
        ELSE TRUE
      END
    WHEN l.control_bucket = 'AP' THEN
      CASE
        WHEN l.reference_id IS NULL THEN TRUE
        WHEN lower(COALESCE(l.reference_type, '')) IN (
          'purchase', 'purchase_return', 'purchase_adjustment', 'purchase_reversal',
          'manual_payment', 'courier_payment', 'shipment', 'shipment_reversal',
          'payment_adjustment',
          'opening_balance_contact_ap',
          'opening_balance_contact_worker'
        ) THEN FALSE
        ELSE TRUE
      END
    ELSE FALSE
  END AS is_unmapped_heuristic
FROM lines l
WHERE l.control_bucket IS NOT NULL;

COMMENT ON VIEW public.v_reconciliation_ar_ap_line_audit IS
  'AR/AP control lines + heuristic unmapped flag. Includes opening_balance_contact_ar / _ap / _worker as mapped.';

CREATE OR REPLACE FUNCTION public.count_unmapped_ar_ap_journal_entries(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  ar_unmapped_entry_count BIGINT,
  ap_unmapped_entry_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT v.journal_entry_id, v.control_bucket
    FROM public.v_reconciliation_ar_ap_line_audit v
    WHERE v.company_id = p_company_id
      AND v.entry_date <= p_as_of_date
      AND (
        p_branch_id IS NULL
        OR v.branch_id IS NULL
        OR v.branch_id = p_branch_id
      )
      AND v.is_unmapped_heuristic = TRUE
  )
  SELECT
    (SELECT COUNT(DISTINCT journal_entry_id) FROM filtered WHERE control_bucket = 'AR')::BIGINT,
    (SELECT COUNT(DISTINCT journal_entry_id) FROM filtered WHERE control_bucket = 'AP')::BIGINT;
$$;

COMMENT ON FUNCTION public.count_unmapped_ar_ap_journal_entries(UUID, UUID, DATE) IS
  'Distinct non-void JEs with unmapped-heuristic AR/AP lines. Branch filter includes NULL branch_id (company-wide) JEs.';

CREATE OR REPLACE FUNCTION public.count_unmapped_ar_ap_journal_entries_split(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  ar_unmapped_entry_count BIGINT,
  ap_supplier_unmapped_entry_count BIGINT,
  ap_worker_unmapped_entry_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH u AS (
    SELECT
      v.journal_entry_id,
      v.control_bucket,
      CASE
        WHEN v.control_bucket = 'AP' THEN
          CASE
            WHEN trim(COALESCE(v.account_code, '')) = '2010' THEN 'worker'
            WHEN lower(COALESCE(v.account_name, '')) LIKE '%worker payable%' THEN 'worker'
            ELSE 'supplier'
          END
        ELSE NULL
      END AS ap_sub_bucket
    FROM public.v_reconciliation_ar_ap_line_audit v
    WHERE v.company_id = p_company_id
      AND v.entry_date <= p_as_of_date
      AND v.is_unmapped_heuristic = TRUE
      AND (
        p_branch_id IS NULL
        OR v.branch_id IS NULL
        OR v.branch_id = p_branch_id
      )
  )
  SELECT
    (SELECT COUNT(DISTINCT journal_entry_id) FROM u WHERE control_bucket = 'AR')::BIGINT,
    (SELECT COUNT(DISTINCT journal_entry_id) FROM u WHERE control_bucket = 'AP' AND ap_sub_bucket = 'supplier')::BIGINT,
    (SELECT COUNT(DISTINCT journal_entry_id) FROM u WHERE control_bucket = 'AP' AND ap_sub_bucket = 'worker')::BIGINT;
$$;

COMMENT ON FUNCTION public.count_unmapped_ar_ap_journal_entries_split(UUID, UUID, DATE) IS
  'Unmapped JE counts split by AP sub-bucket; branch filter includes NULL branch_id JEs.';

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
  'GL per-contact on 1100/2000/2010/1180. Party resolution includes opening_balance_contact_ar/ap/worker (reference_id = contact). Branch: includes NULL branch_id JEs when branch filter set.';
