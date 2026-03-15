-- ============================================================================
-- Worker payment reconciliation (company-scoped, READ-ONLY)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Run in Supabase SQL Editor after repair. No writes.
-- ============================================================================

-- 1) Journal rows MISSING in worker_ledger_entries (should have a ledger row but don't)
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.description,
  je.reference_type,
  je.reference_id AS worker_id,
  jel.debit AS amount,
  w.name AS worker_name,
  'MISSING_IN_LEDGER' AS gap
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
  AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010', '2100'))
LEFT JOIN workers w ON w.id = je.reference_id AND w.company_id = je.company_id
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND jel.debit > 0
  AND NOT EXISTS (
    SELECT 1 FROM worker_ledger_entries wle
    WHERE wle.reference_type = 'accounting_payment'
      AND wle.reference_id = je.id
      AND wle.worker_id = je.reference_id
  )
ORDER BY je.entry_date DESC, je.created_at DESC;

-- 2) worker_ledger_entries (accounting_payment) with no matching journal_entries
SELECT
  wle.id AS ledger_entry_id,
  wle.worker_id,
  w.name AS worker_name,
  wle.amount,
  wle.paid_at,
  wle.payment_reference,
  wle.reference_id AS journal_entry_id,
  'MISSING_JOURNAL' AS gap
FROM worker_ledger_entries wle
LEFT JOIN workers w ON w.id = wle.worker_id
WHERE wle.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND wle.reference_type = 'accounting_payment'
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = wle.reference_id AND je.company_id = wle.company_id
  )
ORDER BY wle.paid_at DESC;

-- 3) Summary by worker and date (journal vs ledger)
WITH journal_agg AS (
  SELECT
    je.reference_id AS worker_id,
    je.entry_date::date AS dt,
    COUNT(*) AS journal_count,
    SUM(jel.debit) AS journal_amount
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
    AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010', '2100'))
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND jel.debit > 0
    AND je.reference_type = 'worker_payment'
    AND je.reference_id IS NOT NULL
  GROUP BY je.reference_id, je.entry_date::date
),
ledger_agg AS (
  SELECT
    worker_id,
    paid_at::date AS dt,
    COUNT(*) AS ledger_count,
    SUM(amount) AS ledger_amount
  FROM worker_ledger_entries
  WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
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
FROM journal_agg j
FULL OUTER JOIN ledger_agg l ON j.worker_id = l.worker_id AND j.dt = l.dt
LEFT JOIN workers w ON w.id = COALESCE(j.worker_id, l.worker_id)
WHERE COALESCE(j.journal_count, 0) <> COALESCE(l.ledger_count, 0)
   OR j.worker_id IS NULL
   OR l.worker_id IS NULL
ORDER BY date DESC, worker_name;

-- 4) Ambiguous legacy rows (Dr Worker Payable, no ledger row, reference_id null or invalid)
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.description,
  jel.debit AS amount,
  'AMBIGUOUS_MANUAL_REVIEW' AS gap
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
  AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010', '2100'))
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND jel.debit > 0
  AND (je.reference_id IS NULL OR NOT EXISTS (SELECT 1 FROM workers w WHERE w.id = je.reference_id AND w.company_id = je.company_id))
  AND NOT EXISTS (
    SELECT 1 FROM worker_ledger_entries wle
    WHERE wle.reference_type = 'accounting_payment' AND wle.reference_id = je.id
  )
ORDER BY je.entry_date DESC;
