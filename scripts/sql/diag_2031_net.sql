\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set account_2031 '82f2a9a6-fc80-4af0-b63b-06b932c312e4'

SELECT je.reference_type, je.document_no,
  ROUND(SUM(jel.debit)::numeric,2) AS dr,
  ROUND(SUM(jel.credit)::numeric,2) AS cr
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE je.company_id = :'company_id'::uuid
  AND jel.account_id = :'account_2031'::uuid
  AND COALESCE(je.is_void, false) = false
GROUP BY je.reference_type, je.document_no
ORDER BY 1, 2;

SELECT ROUND(SUM(jel.credit - jel.debit)::numeric, 2) AS net_liability
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE je.company_id = :'company_id'::uuid
  AND jel.account_id = :'account_2031'::uuid
  AND COALESCE(je.is_void, false) = false;
