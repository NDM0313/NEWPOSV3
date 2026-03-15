-- ============================================================================
-- REPORT SOURCE RECONCILIATION (READ-ONLY)
-- Compare what Journal, Roznamcha, Worker Ledger, Studio Costs, Customer Ledger use
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- ============================================================================

-- 1) Journal Entries: count by date (last 30 days) – source journal_entries
SELECT
  entry_date,
  COUNT(*) AS journal_count,
  COUNT(DISTINCT id) AS distinct_ids
FROM journal_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND entry_date >= (CURRENT_DATE - INTERVAL '30 days')
GROUP BY entry_date
ORDER BY entry_date DESC;

-- 2) Journal lines balance check: sum(debit) = sum(credit) per entry
SELECT
  je.id,
  je.entry_no,
  je.entry_date,
  SUM(jel.debit) AS total_debit,
  SUM(jel.credit) AS total_credit,
  (SUM(jel.debit) - SUM(jel.credit)) AS imbalance
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND je.entry_date >= (CURRENT_DATE - INTERVAL '7 days')
GROUP BY je.id, je.entry_no, je.entry_date
HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01;

-- 3) Roznamcha source: payments table (cash/bank movements)
SELECT
  payment_date,
  reference_type,
  COUNT(*) AS payment_count
FROM payments
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND payment_date >= (CURRENT_DATE - INTERVAL '7 days')
GROUP BY payment_date, reference_type
ORDER BY payment_date DESC, reference_type;

-- 4) Worker Ledger: worker_ledger_entries (jobs vs payments)
SELECT
  reference_type,
  COUNT(*) AS row_count,
  SUM(amount) AS total_amount
FROM worker_ledger_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND created_at >= (CURRENT_DATE - INTERVAL '30 days')
GROUP BY reference_type
ORDER BY reference_type;

-- 5) Studio costs: journal entries with reference_type studio / studio_production_stage
SELECT
  reference_type,
  COUNT(*) AS je_count
FROM journal_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (reference_type ILIKE '%studio%' OR reference_type ILIKE '%production%')
  AND entry_date >= (CURRENT_DATE - INTERVAL '30 days')
GROUP BY reference_type;

-- 6) Today’s journal vs today’s payments: Roznamcha “missing entries” check
SELECT
  'journal_today' AS source,
  COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND entry_date = CURRENT_DATE
UNION ALL
SELECT
  'payments_today',
  COUNT(*)
FROM payments
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND payment_date = CURRENT_DATE;

-- 7) Ledger_master / ledger_entries (if used for supplier/user ledger): row counts
SELECT
  'ledger_master' AS tbl,
  COUNT(*) AS cnt
FROM ledger_master
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
UNION ALL
SELECT
  'ledger_entries',
  COUNT(*)
FROM ledger_entries le
JOIN ledger_master lm ON lm.id = le.ledger_id
WHERE lm.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5';
