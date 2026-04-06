-- =============================================================================
-- FINAL ACCOUNTING STABILIZATION — READ-ONLY AUDIT PACK
-- Supabase SQL Editor: replace :company_id / :branch_id once (see params CTE below).
-- No UPDATE/DELETE. Safe to re-run.
-- =============================================================================
-- Period for journal-based TB/P&L lines: edit period_start / period_end to match
-- the Financial reports date range you are validating.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EDIT THESE VALUES ONLY
-- -----------------------------------------------------------------------------
WITH params AS (
  SELECT
    'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'::uuid AS company_id, -- :company_id
    NULL::uuid AS branch_id,                                      -- :branch_id (NULL = all branches)
    '2000-01-01'::date AS period_start,
    '2099-12-31'::date AS period_end
),

je_filtered AS (
  SELECT jel.account_id, jel.debit, jel.credit
  FROM public.journal_entry_lines jel
  INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  CROSS JOIN params p
  WHERE je.company_id = p.company_id
    AND COALESCE(je.is_void, FALSE) = FALSE
    AND (je.entry_date)::date >= p.period_start
    AND (je.entry_date)::date <= p.period_end
    AND (
      p.branch_id IS NULL
      OR je.branch_id IS NULL
      OR je.branch_id = p.branch_id
    )
),

tb_totals AS (
  SELECT
    ROUND(COALESCE(SUM(debit), 0)::numeric, 4) AS total_debit,
    ROUND(COALESCE(SUM(credit), 0)::numeric, 4) AS total_credit
  FROM je_filtered
),

accounts_codes AS (
  SELECT a.id, UPPER(TRIM(a.code)) AS code, a.name, a.type
  FROM public.accounts a
  CROSS JOIN params p
  WHERE a.company_id = p.company_id AND COALESCE(a.is_active, TRUE)
),

control_net AS (
  SELECT
    ac.code,
    ac.name,
    ROUND(
      CASE
        WHEN ac.code IN ('1100', '1180', '1200') THEN SUM(COALESCE(jf.debit, 0) - COALESCE(jf.credit, 0))
        WHEN ac.code IN ('2000', '2010') THEN SUM(COALESCE(jf.credit, 0) - COALESCE(jf.debit, 0))
        ELSE SUM(COALESCE(jf.debit, 0) - COALESCE(jf.credit, 0))
      END::numeric,
      4
    ) AS net_signed
  FROM je_filtered jf
  INNER JOIN accounts_codes ac ON ac.id = jf.account_id
  WHERE ac.code IN ('1100', '1200', '2000', '2010', '1180')
  GROUP BY ac.code, ac.name
),

tb_by_account AS (
  SELECT
    ac.code,
    ac.name,
    ac.type,
    ROUND(SUM(COALESCE(jf.debit, 0))::numeric, 4) AS debit,
    ROUND(SUM(COALESCE(jf.credit, 0))::numeric, 4) AS credit
  FROM je_filtered jf
  INNER JOIN accounts_codes ac ON ac.id = jf.account_id
  GROUP BY ac.code, ac.name, ac.type
),

pnl_agg AS (
  SELECT
    COALESCE(SUM(CASE WHEN LOWER(TRIM(ac.type)) = 'revenue' THEN ac.credit - ac.debit ELSE 0 END), 0)::numeric AS total_revenue,
    COALESCE(SUM(CASE
      WHEN LOWER(TRIM(ac.type)) = 'expense' AND (ac.debit - ac.credit) > 0
        AND (LOWER(ac.name) LIKE '%cost%' OR LOWER(ac.name) LIKE '%cogs%' OR UPPER(TRIM(ac.code)) LIKE '5%')
      THEN ac.debit - ac.credit ELSE 0 END), 0)::numeric AS cos_heuristic,
    COALESCE(SUM(CASE
      WHEN LOWER(TRIM(ac.type)) = 'expense' AND (ac.debit - ac.credit) > 0
        AND NOT (LOWER(ac.name) LIKE '%cost%' OR LOWER(ac.name) LIKE '%cogs%' OR UPPER(TRIM(ac.code)) LIKE '5%')
      THEN ac.debit - ac.credit ELSE 0 END), 0)::numeric AS opex_heuristic
  FROM tb_by_account ac
),

op_summary AS (
  SELECT
    COALESCE(SUM(cbs.receivables), 0)::numeric AS sum_recv,
    COALESCE(SUM(cbs.payables), 0)::numeric AS sum_pay
  FROM params p
  CROSS JOIN LATERAL public.get_contact_balances_summary(p.company_id, p.branch_id) AS cbs
),

op_by_type AS (
  SELECT
    COALESCE(SUM(CASE WHEN c.type IN ('customer', 'both') THEN cbs.receivables ELSE 0 END), 0)::numeric AS customer_recv,
    COALESCE(SUM(CASE WHEN c.type IN ('supplier', 'both') THEN cbs.payables ELSE 0 END), 0)::numeric AS supplier_pay,
    COALESCE(SUM(CASE WHEN c.type = 'worker' THEN cbs.payables ELSE 0 END), 0)::numeric AS worker_pay
  FROM params p
  INNER JOIN public.contacts c ON c.company_id = p.company_id
  INNER JOIN public.get_contact_balances_summary(p.company_id, p.branch_id) AS cbs ON cbs.contact_id = c.id
),

party_totals AS (
  SELECT
    COALESCE(SUM(pgl.gl_ar_receivable), 0)::numeric AS sum_party_ar,
    COALESCE(SUM(pgl.gl_ap_payable), 0)::numeric AS sum_party_ap,
    COALESCE(SUM(pgl.gl_worker_payable), 0)::numeric AS sum_party_wp
  FROM params p
  CROSS JOIN public.get_contact_party_gl_balances(p.company_id, p.branch_id) AS pgl
),

worker_ledger_unpaid AS (
  SELECT
    COALESCE(SUM(CASE WHEN wle.status IS NULL OR LOWER(TRIM(wle.status::text)) <> 'paid'
      THEN GREATEST(0, wle.amount::numeric) ELSE 0 END), 0)::numeric AS unpaid_total
  FROM params p
  LEFT JOIN public.worker_ledger_entries wle ON wle.company_id = p.company_id
),

dash AS (
  SELECT public.get_financial_dashboard_metrics(p.company_id, p.branch_id) AS metrics
  FROM params p
)

SELECT 'canonical_tb' AS section, 'total_debit' AS metric, NULL::text AS detail, t.total_debit::text AS value_text
FROM tb_totals t
UNION ALL SELECT 'canonical_tb', 'total_credit', NULL, t.total_credit::text FROM tb_totals t
UNION ALL SELECT 'canonical_tb', 'tb_difference', NULL, (t.total_debit - t.total_credit)::text FROM tb_totals t
UNION ALL SELECT 'canonical_tb', 'TB_BALANCED', NULL, CASE WHEN ABS(t.total_debit - t.total_credit) < 0.01 THEN 'PASS' ELSE 'FAIL' END FROM tb_totals t

UNION ALL SELECT 'control_accounts', 'net_' || cn.code, cn.name, cn.net_signed::text FROM control_net cn

UNION ALL SELECT 'pnl_proxy', 'revenue', NULL, p.total_revenue::text FROM pnl_agg p
UNION ALL SELECT 'pnl_proxy', 'cos_heuristic', NULL, p.cos_heuristic::text FROM pnl_agg p
UNION ALL SELECT 'pnl_proxy', 'opex_heuristic', NULL, p.opex_heuristic::text FROM pnl_agg p
UNION ALL SELECT 'pnl_proxy', 'net_profit_heuristic', NULL, (p.total_revenue - p.cos_heuristic - p.opex_heuristic)::text FROM pnl_agg p

UNION ALL SELECT 'operational_rpc', 'sum_receivables', NULL, o.sum_recv::text FROM op_summary o
UNION ALL SELECT 'operational_rpc', 'sum_payables', NULL, o.sum_pay::text FROM op_summary o
UNION ALL SELECT 'operational_rpc', 'customer_recv', NULL, x.customer_recv::text FROM op_by_type x
UNION ALL SELECT 'operational_rpc', 'supplier_pay', NULL, x.supplier_pay::text FROM op_by_type x
UNION ALL SELECT 'operational_rpc', 'worker_pay', NULL, x.worker_pay::text FROM op_by_type x

UNION ALL SELECT 'party_gl_rpc', 'sum_party_ar', NULL, pt.sum_party_ar::text FROM party_totals pt
UNION ALL SELECT 'party_gl_rpc', 'sum_party_ap', NULL, pt.sum_party_ap::text FROM party_totals pt
UNION ALL SELECT 'party_gl_rpc', 'sum_party_wp', NULL, pt.sum_party_wp::text FROM party_totals pt

UNION ALL SELECT 'variance', 'ar_1100_minus_party_ar', NULL,
  ((SELECT cn.net_signed FROM control_net cn WHERE cn.code = '1100') - (SELECT pt.sum_party_ar FROM party_totals pt))::text
UNION ALL SELECT 'variance', 'ap_2000_minus_party_ap', NULL,
  ((SELECT cn.net_signed FROM control_net cn WHERE cn.code = '2000') - (SELECT pt.sum_party_ap FROM party_totals pt))::text

UNION ALL SELECT 'worker_studio', 'unpaid_worker_ledger_total', NULL, w.unpaid_total::text FROM worker_ledger_unpaid w

UNION ALL SELECT 'dashboard_rpc', 'get_financial_dashboard_metrics_json', NULL, d.metrics::text FROM dash d
ORDER BY section, metric;

-- Unmapped lines on controls (run after the main query; uses same params — re-paste UUIDs or run in same session)
-- Replace UUIDs in the subquery below to match params above.

SELECT 'unmapped_ap_2000' AS section, u.reference_type, u.net_amount
FROM public.get_control_unmapped_party_gl_buckets(
  '00000000-0000-0000-0000-000000000000'::uuid,
  NULL::uuid,
  '2000'
) AS u;

SELECT 'unmapped_ar_1100' AS section, u.reference_type, u.net_amount
FROM public.get_control_unmapped_party_gl_buckets(
  '00000000-0000-0000-0000-000000000000'::uuid,
  NULL::uuid,
  '1100'
) AS u;

SELECT 'unmapped_wp_2010' AS section, u.reference_type, u.net_amount
FROM public.get_control_unmapped_party_gl_buckets(
  '00000000-0000-0000-0000-000000000000'::uuid,
  NULL::uuid,
  '2010'
) AS u;

-- =============================================================================
-- MANDATORY VERDICT LINES (fill after review):
-- Canonical GL (TB/BS/P&L) = PASS / FAIL
-- AR operational vs GL parity = FIXED / PARTIAL / NOT FIXED
-- AP control residual ≈ 50,000 = FIXED / EXPLAINED / NOT FIXED
-- Worker operational vs GL parity = FIXED / PARTIAL / NOT FIXED
-- Dashboard basis map = FIXED / PARTIAL / NOT FIXED
-- READY FOR DESIGN POLISH = NO
-- =============================================================================
