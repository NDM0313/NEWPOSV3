-- Phase 2.15 — filtered unified (journal-only path) totals
WITH liq AS (
  SELECT a.id
  FROM accounts a
  WHERE a.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
    AND COALESCE(a.is_active, TRUE)
    AND public._unified_ledger_is_liquidity_account(a.code, a.name, a.type::text, 'all')
),
period AS (
  SELECT jel.debit dr, jel.credit cr, je.reference_type, je.payment_id
  FROM journal_entry_lines jel
  INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
  INNER JOIN liq ON liq.id = jel.account_id
  WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
    AND COALESCE(je.is_void, FALSE) = FALSE
    AND je.payment_id IS NULL
    AND LOWER(COALESCE(je.reference_type, '')) NOT IN (
      'sale', 'purchase', 'expense', 'rental', 'worker_payment', 'courier_payment', 'studio_order'
    )
    AND je.entry_date >= '2000-01-01'::date
    AND je.entry_date <= '2026-06-26'::date
)
SELECT COUNT(*) rows,
  ROUND(SUM(dr)::numeric, 2) cash_in,
  ROUND(SUM(cr)::numeric, 2) cash_out
FROM period;
