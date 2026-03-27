-- Operational receivables must reflect customer cash received that is NOT tied to a sale row
-- (sales.due is unchanged for those flows). GL already credits AR via journal; without this,
-- Contacts / get_contact_balances_summary stayed high vs GL (e.g. Add Entry V2 manual_receipt).
--
-- Subtract payments: payment_type = received AND reference_type IN (manual_receipt, on_account).
-- Sale-linked payments (reference_type = sale) already reduce sales.due_amount / paid_amount — do not subtract again.

CREATE OR REPLACE FUNCTION public.get_contact_balances_summary(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  contact_id UUID,
  receivables NUMERIC,
  payables NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS contact_id,
    GREATEST(
      0::numeric,
      (CASE WHEN c.type IN ('customer', 'both') THEN GREATEST(0, COALESCE(c.opening_balance, 0)::numeric) ELSE 0 END)
      + COALESCE(
          (SELECT SUM(GREATEST(0, COALESCE(s.due_amount, (COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0)))::numeric))
           FROM sales s
           WHERE s.company_id = p_company_id
             AND s.customer_id = c.id
             AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
             AND LOWER(TRIM(COALESCE(s.status::text, ''))) = 'final'),
          0
        )
      - COALESCE(
          (SELECT SUM(GREATEST(0, p.amount::numeric))
           FROM payments p
           WHERE p.company_id = p_company_id
             AND p.contact_id = c.id
             AND LOWER(TRIM(COALESCE(p.payment_type::text, ''))) = 'received'
             AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
             AND LOWER(TRIM(COALESCE(p.reference_type::text, ''))) IN ('manual_receipt', 'on_account')),
          0
        )
    ) AS receivables,
    (CASE
       WHEN c.type = 'worker' THEN
         CASE
           WHEN EXISTS (
             SELECT 1 FROM worker_ledger_entries wle
             WHERE wle.company_id = p_company_id AND wle.worker_id = c.id
           )
           THEN GREATEST(0, COALESCE(
             (SELECT SUM(GREATEST(0, wle.amount::numeric))
              FROM worker_ledger_entries wle
              WHERE wle.company_id = p_company_id
                AND wle.worker_id = c.id
                AND (wle.status IS NULL OR LOWER(TRIM(wle.status::text)) <> 'paid')),
             0::numeric
           ))
           ELSE GREATEST(0, COALESCE(
             (SELECT w.current_balance::numeric FROM workers w WHERE w.id = c.id AND w.company_id = p_company_id LIMIT 1),
             c.current_balance,
             c.opening_balance,
             0
           )::numeric)
         END
       WHEN c.type IN ('supplier', 'both') THEN
         GREATEST(0, COALESCE(c.supplier_opening_balance, c.opening_balance, 0)::numeric)
         + COALESCE(
             (SELECT SUM(GREATEST(0, COALESCE(p.due_amount, (COALESCE(p.total, 0) - COALESCE(p.paid_amount, 0)))::numeric))
              FROM purchases p
              WHERE p.company_id = p_company_id
                AND p.supplier_id = c.id
                AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
                AND LOWER(TRIM(COALESCE(p.status::text, ''))) IN ('final', 'received')),
             0
           )
       ELSE 0::numeric
     END) AS payables
  FROM contacts c
  WHERE c.company_id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.get_contact_balances_summary(UUID, UUID) IS
  'Per-contact receivables/payables. Receivables: opening + final sales due minus received payments with reference_type manual_receipt or on_account (not sale-linked). Purchases: final/received. Workers: unpaid worker_ledger or workers.current_balance.';

-- Company/branch rollup: match RPC document leg minus same payment bucket.
CREATE OR REPLACE VIEW public.v_ar_ap_operational_totals AS
WITH sales_recv AS (
  SELECT
    s.company_id,
    s.branch_id,
    SUM(GREATEST(0, COALESCE(s.due_amount, (COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0)))::numeric)) AS operational_receivables
  FROM public.sales s
  WHERE LOWER(TRIM(COALESCE(s.status::text, ''))) = 'final'
  GROUP BY s.company_id, s.branch_id
),
cust_prepay AS (
  SELECT
    p.company_id,
    p.branch_id,
    SUM(GREATEST(0, p.amount::numeric)) AS prepaid_recv
  FROM public.payments p
  WHERE LOWER(TRIM(COALESCE(p.payment_type::text, ''))) = 'received'
    AND LOWER(TRIM(COALESCE(p.reference_type::text, ''))) IN ('manual_receipt', 'on_account')
  GROUP BY p.company_id, p.branch_id
),
recv AS (
  SELECT
    COALESCE(sr.company_id, cp.company_id) AS company_id,
    COALESCE(sr.branch_id, cp.branch_id) AS branch_id,
    GREATEST(
      0::numeric,
      COALESCE(sr.operational_receivables, 0::numeric) - COALESCE(cp.prepaid_recv, 0::numeric)
    ) AS operational_receivables
  FROM sales_recv sr
  FULL OUTER JOIN cust_prepay cp
    ON sr.company_id = cp.company_id AND sr.branch_id IS NOT DISTINCT FROM cp.branch_id
),
pay AS (
  SELECT
    p.company_id,
    p.branch_id,
    SUM(GREATEST(0, COALESCE(p.due_amount, (COALESCE(p.total, 0) - COALESCE(p.paid_amount, 0)))::numeric)) AS operational_payables
  FROM public.purchases p
  WHERE LOWER(TRIM(COALESCE(p.status::text, ''))) IN ('final', 'received')
  GROUP BY p.company_id, p.branch_id
)
SELECT
  COALESCE(r.company_id, p.company_id) AS company_id,
  COALESCE(r.branch_id, p.branch_id) AS branch_id,
  COALESCE(r.operational_receivables, 0)::numeric AS operational_receivables,
  COALESCE(p.operational_payables, 0)::numeric AS operational_payables
FROM recv r
FULL OUTER JOIN pay p ON r.company_id = p.company_id AND r.branch_id IS NOT DISTINCT FROM p.branch_id;

COMMENT ON VIEW public.v_ar_ap_operational_totals IS
  'Posted-scope AR/AP: final sales due minus manual_receipt/on_account customer payments; purchases final/received. Aligns with get_contact_balances_summary.';

GRANT SELECT ON public.v_ar_ap_operational_totals TO authenticated;
GRANT SELECT ON public.v_ar_ap_operational_totals TO service_role;
