SELECT je.entry_no, je.id, jel.account_id, a.code, a.type, jel.debit, jel.credit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
LEFT JOIN accounts a ON a.id = jel.account_id
WHERE je.entry_no IN ('JE-0232', 'JE-0233')
  AND je.reference_type = 'stock_adjustment'
  AND COALESCE(je.is_void, false) = false
ORDER BY je.entry_no, jel.debit DESC;
