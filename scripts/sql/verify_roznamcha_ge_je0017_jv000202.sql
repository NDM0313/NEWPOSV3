-- Post-fix verification: payments for JE-0017 / JV-000202 visible at HQ branch
SELECT p.reference_number,
       p.payment_type,
       p.amount,
       p.branch_id,
       b.name AS branch_name,
       je.entry_no,
       je.reference_type
FROM payments p
JOIN journal_entries je ON je.id::text = p.reference_id::text
LEFT JOIN branches b ON b.id = p.branch_id
WHERE je.entry_no IN ('JE-0017', 'JV-000202')
  AND je.company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'
  AND lower(COALESCE(p.reference_type, '')) IN ('manual_receipt', 'manual_payment')
  AND p.voided_at IS NULL
  AND je.reference_type IN ('general', 'journal')
ORDER BY je.entry_date DESC;
