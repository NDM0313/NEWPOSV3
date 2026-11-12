-- Phase 2.15 — unified GL liquidity lines by reference_type (DIN CHINA wide range)
WITH liq AS (
  SELECT a.id
  FROM accounts a
  WHERE a.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
    AND COALESCE(a.is_active, TRUE)
    AND (
      LOWER(a.type::text) IN ('cash', 'bank', 'mobile_wallet', 'wallet', 'card', 'pos')
      OR TRIM(COALESCE(a.code, '')) ~ '^101'
      OR TRIM(COALESCE(a.code, '')) ~ '^102'
    )
)
SELECT
  LOWER(COALESCE(je.reference_type, '(null)')) AS ref_type,
  COUNT(*) AS rows,
  ROUND(SUM(jel.debit)::numeric, 2) AS sum_dr,
  ROUND(SUM(jel.credit)::numeric, 2) AS sum_cr
FROM journal_entry_lines jel
INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
INNER JOIN liq ON liq.id = jel.account_id
WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND COALESCE(je.is_void, FALSE) = FALSE
  AND je.entry_date >= '2000-01-01'::date
  AND je.entry_date <= '2026-06-26'::date
GROUP BY 1
ORDER BY sum_cr DESC NULLS LAST
LIMIT 20;
