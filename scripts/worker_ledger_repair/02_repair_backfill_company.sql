-- ============================================================================
-- Worker payment repair + backfill (company-scoped)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent where possible).
-- NO DELETIONS. Only UPDATE journal_entries and INSERT worker_ledger_entries.
-- ============================================================================

-- Step A: Backfill worker_ledger_entries where journal already has reference_type = 'worker_payment' and valid reference_id
INSERT INTO worker_ledger_entries (
  company_id,
  worker_id,
  amount,
  reference_type,
  reference_id,
  status,
  paid_at,
  payment_reference,
  notes
)
SELECT
  je.company_id,
  je.reference_id AS worker_id,
  jel.debit AS amount,
  'accounting_payment' AS reference_type,
  je.id AS reference_id,
  'paid' AS status,
  COALESCE(je.created_at, NOW()) AS paid_at,
  je.entry_no AS payment_reference,
  COALESCE(je.description, 'Payment via Accounting (backfill)') AS notes
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
  AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010', '2100'))
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND jel.debit > 0
  AND je.reference_type = 'worker_payment'
  AND je.reference_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM workers w WHERE w.id = je.reference_id AND w.company_id = je.company_id)
  AND NOT EXISTS (
    SELECT 1 FROM worker_ledger_entries wle
    WHERE wle.reference_type = 'accounting_payment'
      AND wle.reference_id = je.id
      AND wle.worker_id = je.reference_id
  );

-- Step B: Infer worker from description for legacy rows (manual/payment, reference_id null or invalid)
-- Only where exactly one worker name match. Then update journal and insert ledger.

-- B1: Update journal_entries with inferred worker_id where inference is unique
WITH legacy AS (
  SELECT
    je.id AS journal_entry_id,
    je.entry_no,
    je.entry_date,
    je.description,
    jel.debit AS amount,
    je.created_at,
    TRIM(COALESCE(
      NULLIF(SUBSTRING(je.description FROM 'Payment to worker ([^.\n,]+)'), ''),
      NULLIF(SUBSTRING(je.description FROM 'worker payment ([^.\n,]+)'), ''),
      NULLIF(SUBSTRING(je.description FROM 'Payment ([^.\n,]+) to worker'), ''),
      NULLIF(SUBSTRING(je.description FROM '^Payment ([A-Za-z][^.\n,]*)'), '')
    )) AS inferred_name
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
    AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010', '2100'))
  WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND jel.debit > 0
    AND (je.reference_id IS NULL OR NOT EXISTS (SELECT 1 FROM workers w WHERE w.id = je.reference_id AND w.company_id = je.company_id))
    AND je.description IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM worker_ledger_entries wle
      WHERE wle.reference_type = 'accounting_payment' AND wle.reference_id = je.id
    )
),
candidates AS (
  SELECT
    l.journal_entry_id,
    w.id AS worker_id,
    COUNT(*) OVER (PARTITION BY l.journal_entry_id) AS match_cnt
  FROM legacy l
  JOIN workers w ON w.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND (w.name ILIKE '%' || TRIM(l.inferred_name) || '%' OR TRIM(w.name) = TRIM(l.inferred_name))
  WHERE l.inferred_name IS NOT NULL AND TRIM(l.inferred_name) <> ''
),
unique_inferred AS (
  SELECT journal_entry_id, worker_id
  FROM candidates
  WHERE match_cnt = 1
)
UPDATE journal_entries je
SET reference_type = 'worker_payment', reference_id = u.worker_id
FROM unique_inferred u
WHERE je.id = u.journal_entry_id
  AND je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5';

-- B2: Insert worker_ledger_entries for rows we just updated (and any remaining with worker_payment + valid reference_id)
INSERT INTO worker_ledger_entries (
  company_id,
  worker_id,
  amount,
  reference_type,
  reference_id,
  status,
  paid_at,
  payment_reference,
  notes
)
SELECT
  je.company_id,
  je.reference_id AS worker_id,
  jel.debit AS amount,
  'accounting_payment' AS reference_type,
  je.id AS reference_id,
  'paid' AS status,
  COALESCE(je.created_at, NOW()) AS paid_at,
  je.entry_no AS payment_reference,
  COALESCE(je.description, 'Payment via Accounting (backfill)') AS notes
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
  AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010', '2100'))
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND jel.debit > 0
  AND je.reference_type = 'worker_payment'
  AND je.reference_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM workers w WHERE w.id = je.reference_id AND w.company_id = je.company_id)
  AND NOT EXISTS (
    SELECT 1 FROM worker_ledger_entries wle
    WHERE wle.reference_type = 'accounting_payment'
      AND wle.reference_id = je.id
      AND wle.worker_id = je.reference_id
  );

-- Step C: Report ambiguous rows (Dr Worker Payable but still no worker_ledger_entry)
-- Run after repair to see what needs manual review (set reference_type/reference_id then re-run B2).
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.description,
  jel.debit AS amount,
  'Manual review: set reference_type=worker_payment, reference_id=worker_id, then re-run backfill' AS action
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
  AND (a.name ILIKE '%Worker Payable%' OR a.code IN ('2010', '2100'))
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND jel.debit > 0
  AND NOT EXISTS (
    SELECT 1 FROM worker_ledger_entries wle
    WHERE wle.reference_type = 'accounting_payment' AND wle.reference_id = je.id
  )
ORDER BY je.entry_date DESC;
