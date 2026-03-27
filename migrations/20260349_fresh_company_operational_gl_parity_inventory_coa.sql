-- Fresh-company parity: operational contact balances vs GL posting scope + canonical Inventory (1200) under group 1090.
-- 1) get_contact_balances_summary: only sales with status final; only purchases final/received (same as journal posting).
-- 2) Ensure asset group 1090 exists per company with 1200; link 1200 → 1090 when parent missing or wrong.

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
    (CASE WHEN c.type IN ('customer', 'both') THEN GREATEST(0, COALESCE(c.opening_balance, 0)::numeric) ELSE 0 END)
    + COALESCE(
        (SELECT SUM(GREATEST(0, COALESCE(s.due_amount, (COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0)))::numeric))
         FROM sales s
         WHERE s.company_id = p_company_id
           AND s.customer_id = c.id
           AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
           AND LOWER(TRIM(COALESCE(s.status::text, ''))) = 'final'),
        0
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
  'Per-contact receivables/payables. Sales: final only. Purchases: final/received only (GL posting scope). Workers: unpaid worker_ledger or workers.current_balance.';

-- Inventory group 1090 + parent repair for 1200 (idempotent). Matches defaultAccountsService GROUP_ROWS.
INSERT INTO public.accounts (company_id, code, name, type, balance, is_active, is_group, parent_id)
SELECT DISTINCT inv.company_id,
  '1090',
  'Inventory',
  'asset',
  0::numeric,
  true,
  true,
  NULL::uuid
FROM public.accounts inv
WHERE TRIM(COALESCE(inv.code, '')) = '1200'
  AND NOT EXISTS (
    SELECT 1 FROM public.accounts g
    WHERE g.company_id = inv.company_id AND TRIM(COALESCE(g.code, '')) = '1090'
  );

UPDATE public.accounts
SET is_group = true
WHERE TRIM(COALESCE(code, '')) = '1090';

UPDATE public.accounts child
SET parent_id = grp.id
FROM public.accounts grp
WHERE TRIM(COALESCE(child.code, '')) = '1200'
  AND TRIM(COALESCE(grp.code, '')) = '1090'
  AND child.company_id = grp.company_id
  AND (child.parent_id IS NULL OR child.parent_id <> grp.id);

-- Align AR/AP operational totals view with GL posting scope (same filters as get_contact_balances_summary document leg).
CREATE OR REPLACE VIEW public.v_ar_ap_operational_totals AS
WITH recv AS (
  SELECT
    s.company_id,
    s.branch_id,
    SUM(GREATEST(0, COALESCE(s.due_amount, (COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0)))::numeric)) AS operational_receivables
  FROM public.sales s
  WHERE LOWER(TRIM(COALESCE(s.status::text, ''))) = 'final'
  GROUP BY s.company_id, s.branch_id
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
  'Posted-scope AR/AP: sales final only; purchases final/received only. Matches get_contact_balances_summary document sums + GL posting.';

GRANT SELECT ON public.v_ar_ap_operational_totals TO authenticated;
GRANT SELECT ON public.v_ar_ap_operational_totals TO service_role;
