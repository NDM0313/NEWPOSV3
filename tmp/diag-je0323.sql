-- JE-0323 read-only diagnosis
SELECT je.id, je.entry_no, je.reference_type, je.is_void, je.voided_at, je.payment_id,
       jel.debit, jel.credit, a.code, a.name
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.entry_no = 'JE-0323'
ORDER BY a.code;

SELECT je.id, je.entry_no, je.reference_type, je.is_void, je.payment_id,
       jel.debit, jel.credit, a.code, a.name
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.reference_type = 'correction_reversal'
  AND je.payment_id IN (SELECT payment_id FROM journal_entries WHERE entry_no = 'JE-0323' AND payment_id IS NOT NULL)
ORDER BY je.entry_no, a.code;

SELECT je.id, je.entry_no, je.reference_type, je.is_void, je.payment_id,
       jel.debit, jel.credit, a.code, a.name
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.is_void = true
  AND je.payment_id IN (SELECT payment_id FROM journal_entries WHERE entry_no = 'JE-0323' AND payment_id IS NOT NULL)
ORDER BY je.entry_no, a.code;
