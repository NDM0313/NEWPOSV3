-- ============================================================================
-- Accounting Stabilization Phase 1 – Diagnostics (READ-ONLY)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- No destructive cleanup. Use for verification and repair preview.
-- ============================================================================

-- 1) Duplicate payment reference_number in payments
SELECT
  reference_number,
  COUNT(*) AS use_count,
  array_agg(id ORDER BY created_at) AS payment_ids,
  array_agg(reference_type ORDER BY created_at) AS reference_types
FROM payments
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_number IS NOT NULL
  AND reference_number <> ''
GROUP BY reference_number
HAVING COUNT(*) > 1
ORDER BY use_count DESC;

-- 2) Mismatched sequence: max PAY number in payments vs erp_document_sequences
SELECT
  (SELECT MAX(CAST(SUBSTRING(reference_number FROM 5) AS INTEGER))
   FROM payments
   WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
     AND reference_number ~ '^PAY-[0-9]+$') AS max_pay_num_in_payments,
  (SELECT last_number FROM erp_document_sequences
   WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
     AND document_type = 'PAYMENT'
   LIMIT 1) AS erp_sequence_last;

-- 3) Imbalanced journal entries (debit total != credit total) – expense-related
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  SUM(jel.debit) AS total_debit,
  SUM(jel.credit) AS total_credit,
  SUM(jel.debit) - SUM(jel.credit) AS imbalance
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (je.reference_type = 'expense' OR je.reference_type = 'extra_expense' OR je.description ILIKE '%expense%')
GROUP BY je.id, je.entry_no, je.entry_date, je.reference_type, je.reference_id
HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01
ORDER BY je.entry_date DESC;
