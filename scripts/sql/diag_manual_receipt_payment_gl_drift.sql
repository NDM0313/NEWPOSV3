-- Manual receipt: payments.amount vs primary JE vs net GL (incl. payment_adjustment)
-- Read-only. Run on production via:
--   ssh dincouture-vps "docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" < scripts/sql/diag_manual_receipt_payment_gl_drift.sql

\echo '=== Manual receipt payment vs primary JE drift (last 90 days) ==='

WITH pay AS (
  SELECT
    p.id,
    p.company_id,
    p.reference_number,
    p.amount AS payment_amount,
    p.contact_id,
    p.payment_date,
    p.voided_at
  FROM payments p
  WHERE LOWER(TRIM(COALESCE(p.reference_type, ''))) = 'manual_receipt'
    AND p.voided_at IS NULL
    AND p.payment_date >= (CURRENT_DATE - INTERVAL '90 days')
),
primary_je AS (
  SELECT
    je.payment_id,
    je.id AS primary_je_id,
    je.entry_no,
    ROUND(MAX(GREATEST(COALESCE(jel.debit, 0), COALESCE(jel.credit, 0)))::numeric, 2) AS primary_je_line_max
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  WHERE je.payment_id IS NOT NULL
    AND COALESCE(je.is_void, false) = false
    AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IS DISTINCT FROM 'payment_adjustment'
  GROUP BY je.payment_id, je.id, je.entry_no
),
adj_count AS (
  SELECT
    je.reference_id AS payment_id,
    COUNT(*)::int AS adjustment_je_count
  FROM journal_entries je
  WHERE LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'payment_adjustment'
    AND COALESCE(je.is_void, false) = false
  GROUP BY je.reference_id
),
net_liquidity AS (
  SELECT
    COALESCE(je.payment_id, je.reference_id) AS payment_id,
    ROUND(SUM(GREATEST(COALESCE(jel.debit, 0), COALESCE(jel.credit, 0))) / 2, 2) AS net_from_merged_jes
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  WHERE COALESCE(je.is_void, false) = false
    AND (
      je.payment_id IS NOT NULL
      OR LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'payment_adjustment'
    )
  GROUP BY COALESCE(je.payment_id, je.reference_id)
)
SELECT
  pay.reference_number,
  pay.id AS payment_id,
  pay.payment_amount,
  pj.primary_je_line_max,
  ROUND((pay.payment_amount - pj.primary_je_line_max)::numeric, 2) AS payment_minus_primary_je,
  COALESCE(ac.adjustment_je_count, 0) AS adjustment_je_count,
  nl.net_from_merged_jes,
  ROUND((pay.payment_amount - COALESCE(nl.net_from_merged_jes, pj.primary_je_line_max))::numeric, 2) AS payment_minus_net_gl,
  pj.primary_je_id,
  pj.entry_no,
  pay.payment_date
FROM pay
JOIN primary_je pj ON pj.payment_id = pay.id
LEFT JOIN adj_count ac ON ac.payment_id = pay.id
LEFT JOIN net_liquidity nl ON nl.payment_id = pay.id
WHERE ABS(pay.payment_amount - pj.primary_je_line_max) > 0.01
ORDER BY pay.payment_date DESC, pay.reference_number
LIMIT 50;

\echo '=== Detail template (replace payment UUID) ==='
\echo 'SELECT id, reference_number, amount, reference_type, contact_id, payment_account_id FROM payments WHERE id = ''<payment_uuid>'';'
