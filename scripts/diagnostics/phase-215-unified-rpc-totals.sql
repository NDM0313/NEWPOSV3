-- Phase 2.15 — unified RPC totals (official_gl vs effective_party)
SELECT
  basis,
  (data->>'row_count')::int AS row_count,
  ROUND((data->>'period_opening_balance')::numeric, 2) AS opening,
  ROUND(
    (
      SELECT COALESCE(SUM((r->>'debit')::numeric), 0)
      FROM json_array_elements(COALESCE(data->'rows', '[]'::json)) r
    )::numeric,
    2
  ) AS cash_in,
  ROUND(
    (
      SELECT COALESCE(SUM((r->>'credit')::numeric), 0)
      FROM json_array_elements(COALESCE(data->'rows', '[]'::json)) r
    )::numeric,
    2
  ) AS cash_out
FROM (
  SELECT 'official_gl' AS basis,
    public.get_unified_cash_bank_ledger(
      '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
      NULL::uuid,
      '2000-01-01'::date,
      '2026-06-26'::date,
      'official_gl',
      'all'
    ) AS data
  UNION ALL
  SELECT 'effective_party' AS basis,
    public.get_unified_cash_bank_ledger(
      '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
      NULL::uuid,
      '2000-01-01'::date,
      '2026-06-26'::date,
      'effective_party',
      'all'
    ) AS data
) q;
