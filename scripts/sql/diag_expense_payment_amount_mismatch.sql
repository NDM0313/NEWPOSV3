-- Read-only: expense vs linked payment vs JE liquidity amount (Phase 2A mismatch detector)
-- Example: WHERE e.expense_no = 'EXP-0021'

WITH expense_pay AS (
  SELECT
    e.id AS expense_id,
    e.expense_no,
    e.amount AS expense_amount,
    e.status,
    p.id AS payment_id,
    p.reference_number AS payment_ref,
    p.amount AS payment_amount
  FROM expenses e
  LEFT JOIN LATERAL (
    SELECT id, reference_number, amount
    FROM payments
    WHERE reference_type = 'expense'
      AND reference_id = e.id
      AND voided_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  ) p ON TRUE
  WHERE e.status = 'paid'
),
je_liquidity AS (
  SELECT
    je.reference_id AS expense_id,
    je.id AS je_id,
    je.entry_no,
    COALESCE(SUM(jel.credit) FILTER (WHERE jel.credit > 0), 0) AS je_credit_total
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  WHERE je.reference_type = 'expense'
    AND COALESCE(je.is_void, false) = false
  GROUP BY je.reference_id, je.id, je.entry_no
)
SELECT
  ep.expense_no,
  ep.payment_ref,
  ep.expense_amount,
  ep.payment_amount,
  jl.je_credit_total AS je_liquidity_amount,
  ep.payment_amount AS roznamcha_amount,
  ep.expense_amount AS proposed_after_amount,
  ABS(COALESCE(ep.payment_amount, 0) - ep.expense_amount) > 0.01 AS payment_expense_mismatch,
  ABS(COALESCE(jl.je_credit_total, 0) - ep.expense_amount) <= 0.01 AS je_matches_expense,
  CASE
    WHEN ABS(COALESCE(ep.payment_amount, 0) - ep.expense_amount) > 0.01
     AND ABS(COALESCE(jl.je_credit_total, 0) - ep.expense_amount) <= 0.01
    THEN 'repair_allowed_payment_only'
    WHEN ABS(COALESCE(ep.payment_amount, 0) - ep.expense_amount) > 0.01
    THEN 'blocked_review_gl'
    ELSE 'ok'
  END AS repair_status
FROM expense_pay ep
LEFT JOIN je_liquidity jl ON jl.expense_id = ep.expense_id
WHERE ep.payment_id IS NOT NULL
  AND ABS(COALESCE(ep.payment_amount, 0) - ep.expense_amount) > 0.01
ORDER BY ep.expense_no;
