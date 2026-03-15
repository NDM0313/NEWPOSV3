-- ============================================================================
-- Legacy Supplier Payment Cleanup APPLY (Phase 4)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Marks duplicate standalone Purchase JEs (appends to description). No deletes.
-- Run legacy_supplier_payment_cleanup_preview.sql first and verify row count.
-- ============================================================================

UPDATE journal_entries je
SET description = COALESCE(TRIM(je.description), '') || ' [LEGACY DUPLICATE - canonical JE has payment_id]'
FROM (
  SELECT sp.id AS standalone_je_id
  FROM (
    SELECT je.id, je.entry_date, je.reference_id,
           (SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) AS total_debit
    FROM journal_entries je
    WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
      AND LOWER(COALESCE(je.reference_type, '')) = 'purchase' AND je.payment_id IS NULL
  ) sp
  JOIN (
    SELECT je.entry_date, je.reference_id,
           (SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) AS total_debit
    FROM journal_entries je
    WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5' AND je.payment_id IS NOT NULL
  ) pj ON pj.reference_id IS NOT DISTINCT FROM sp.reference_id
      AND pj.entry_date = sp.entry_date
      AND ABS(COALESCE(sp.total_debit, 0) - COALESCE(pj.total_debit, 0)) < 0.01
) dup
WHERE je.id = dup.standalone_je_id
  AND je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (je.description IS NULL OR je.description NOT LIKE '%[LEGACY DUPLICATE%');
