-- ============================================================================
-- PAYMENT REFERENCE & SEQUENCE AUDIT (READ-ONLY)
-- Why PAY0069 or same reference appears multiple times; canonical sequence
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- ============================================================================

-- 1) Duplicate payment reference_number (same company): same ref used on multiple payment rows
SELECT
  reference_number,
  COUNT(*) AS use_count,
  array_agg(id ORDER BY created_at) AS payment_ids,
  array_agg(reference_type ORDER BY created_at) AS reference_types,
  array_agg(amount ORDER BY created_at) AS amounts
FROM payments
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_number IS NOT NULL
  AND reference_number <> ''
GROUP BY reference_number
HAVING COUNT(*) > 1
ORDER BY use_count DESC;

-- 2) PAY prefix references: distribution
SELECT
  LEFT(reference_number, 7) AS ref_prefix,
  COUNT(*) AS cnt
FROM payments
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_number LIKE 'PAY%'
GROUP BY LEFT(reference_number, 7)
ORDER BY cnt DESC;

-- 3) erp_document_sequences: PAYMENT type (canonical for web payment refs)
SELECT
  document_type,
  prefix,
  year,
  last_number,
  updated_at
FROM erp_document_sequences
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND document_type = 'PAYMENT';

-- 4) document_sequences_global: PAY type (alternative/legacy)
SELECT
  document_type,
  current_number,
  updated_at
FROM document_sequences_global
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND document_type = 'PAY';

-- 5) document_sequences (legacy): payment type
SELECT
  document_type,
  prefix,
  current_number,
  updated_at
FROM document_sequences
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (document_type ILIKE '%payment%' OR document_type = 'PAY');

-- 6) worker_ledger_entries: payment_reference overlap (PAYxxxx appearing on worker ledger)
SELECT
  payment_reference,
  COUNT(*) AS row_count,
  array_agg(reference_type) AS ref_types,
  array_agg(amount) AS amounts
FROM worker_ledger_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND payment_reference IS NOT NULL
  AND payment_reference LIKE 'PAY%'
GROUP BY payment_reference
HAVING COUNT(*) > 1
ORDER BY row_count DESC;

-- 7) Max payment reference number in payments vs sequence last_number (gap check)
SELECT
  (SELECT MAX(CAST(SUBSTRING(reference_number FROM 5) AS INTEGER))
   FROM payments
   WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
     AND reference_number ~ '^PAY-[0-9]+$') AS max_pay_num_in_payments,
  (SELECT last_number FROM erp_document_sequences
   WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
     AND document_type = 'PAYMENT'
   LIMIT 1) AS erp_sequence_last;
