-- Fresh-company parity: canonical Inventory (1200) under group 1090.
-- get_contact_balances_summary lives in 20260353 → 20260411 → 20260430 (not here) so this migration cannot replace newer RPC logic.

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
