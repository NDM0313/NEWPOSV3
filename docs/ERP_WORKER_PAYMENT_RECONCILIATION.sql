-- ============================================================================
-- Worker payment reconciliation: Journal vs worker_ledger_entries
-- ============================================================================
-- Run in Supabase SQL Editor. Replace YOUR_COMPANY_ID or use as template.
-- NO DELETIONS – read-only reporting.
-- ============================================================================

-- 1) Worker payments in journal but MISSING in worker_ledger_entries
--    (Journal has Dr Worker Payable with reference_type=worker_payment and reference_id=worker id;
--     no row in worker_ledger_entries for that journal id + worker)
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.description,
  je.reference_type,
  je.reference_id AS worker_id,
  jel.debit AS amount,
  w.name AS worker_name
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
  AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010', '2100'))
LEFT JOIN workers w ON w.id = je.reference_id
WHERE je.company_id = 'YOUR_COMPANY_ID'  -- replace with your company UUID
  AND jel.debit > 0
  AND je.reference_type = 'worker_payment'
  AND je.reference_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM worker_ledger_entries wle
    WHERE wle.reference_type = 'accounting_payment'
      AND wle.reference_id = je.id
      AND wle.worker_id = je.reference_id
  )
ORDER BY je.entry_date DESC, je.created_at DESC;

-- 2) worker_ledger_entries rows with reference_type=accounting_payment that have
--    no matching journal_entries row (reference_id = journal id)
SELECT
  wle.id AS ledger_entry_id,
  wle.worker_id,
  wle.amount,
  wle.paid_at,
  wle.payment_reference,
  wle.reference_id AS journal_or_ref_id,
  w.name AS worker_name
FROM worker_ledger_entries wle
LEFT JOIN workers w ON w.id = wle.worker_id
WHERE wle.company_id = 'YOUR_COMPANY_ID'
  AND wle.reference_type = 'accounting_payment'
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = wle.reference_id
  )
ORDER BY wle.paid_at DESC;

-- 3) Summary by worker and date (journal vs ledger counts)
WITH journal_counts AS (
  SELECT
    je.reference_id AS worker_id,
    je.entry_date::date AS dt,
    COUNT(*) AS journal_count,
    SUM(jel.debit) AS journal_amount
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
    AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010', '2100'))
  WHERE je.company_id = 'YOUR_COMPANY_ID'
    AND jel.debit > 0
    AND je.reference_type = 'worker_payment'
    AND je.reference_id IS NOT NULL
  GROUP BY je.reference_id, je.entry_date::date
),
ledger_counts AS (
  SELECT
    worker_id,
    (paid_at::date) AS dt,
    COUNT(*) AS ledger_count,
    SUM(amount) AS ledger_amount
  FROM worker_ledger_entries
  WHERE company_id = 'YOUR_COMPANY_ID'
    AND reference_type = 'accounting_payment'
  GROUP BY worker_id, paid_at::date
)
SELECT
  COALESCE(j.worker_id, l.worker_id) AS worker_id,
  w.name AS worker_name,
  COALESCE(j.dt, l.dt) AS date,
  COALESCE(j.journal_count, 0) AS journal_count,
  COALESCE(l.ledger_count, 0) AS ledger_count,
  COALESCE(j.journal_amount, 0) AS journal_amount,
  COALESCE(l.ledger_amount, 0) AS ledger_amount,
  CASE
    WHEN COALESCE(j.journal_count, 0) <> COALESCE(l.ledger_count, 0) THEN 'MISMATCH'
    ELSE 'OK'
  END AS status
FROM journal_counts j
FULL OUTER JOIN ledger_counts l ON j.worker_id = l.worker_id AND j.dt = l.dt
LEFT JOIN workers w ON w.id = COALESCE(j.worker_id, l.worker_id)
WHERE COALESCE(j.journal_count, 0) <> COALESCE(l.ledger_count, 0)
   OR j.worker_id IS NULL
   OR l.worker_id IS NULL
ORDER BY date DESC, worker_name;

-- Replace YOUR_COMPANY_ID with your actual company UUID in all three queries.
