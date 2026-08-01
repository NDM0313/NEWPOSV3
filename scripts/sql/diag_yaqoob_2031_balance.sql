SELECT
  ROUND(COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0), 2) AS net_credit_balance,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS net_debit_balance
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE a.code = '2031'
  AND je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND COALESCE(je.is_void, false) = false;

SELECT a.balance AS cached_balance FROM accounts a
JOIN couriers co ON co.account_id = a.id
JOIN contacts c ON c.id = co.contact_id
WHERE UPPER(TRIM(c.name)) = 'YAQOOB' AND c.company_id = '30bd8592-3384-4f34-899a-f3907e336485';
