-- Balance credit legs on repaired stock_adjustment JEs (expense line may be code 5000).
UPDATE journal_entry_lines jel
SET credit = sub.amt
FROM (
  SELECT je.id AS je_id,
         MAX(COALESCE(jel2.debit, 0)) AS amt
  FROM journal_entries je
  JOIN journal_entry_lines jel2 ON jel2.journal_entry_id = je.id
  WHERE je.reference_type = 'stock_adjustment'
    AND je.entry_no IN ('JE-0232', 'JE-0233')
    AND COALESCE(je.is_void, false) = false
  GROUP BY je.id
  HAVING MAX(COALESCE(jel2.debit, 0)) > 0
) sub
WHERE jel.journal_entry_id = sub.je_id
  AND COALESCE(jel.debit, 0) = 0
  AND COALESCE(jel.credit, 0) = 0;

SELECT je.entry_no, jel.debit, jel.credit, a.code
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
LEFT JOIN accounts a ON a.id = jel.account_id
WHERE je.entry_no IN ('JE-0232', 'JE-0233')
  AND je.reference_type = 'stock_adjustment'
ORDER BY je.entry_no, jel.debit DESC;
