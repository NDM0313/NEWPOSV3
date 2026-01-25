-- Recalculate all account balances from journal entries
UPDATE accounts a
SET balance = COALESCE((
  SELECT 
    SUM(jel.debit) - SUM(jel.credit)
  FROM journal_entry_lines jel
  WHERE jel.account_id = a.id
), 0);

-- Verify balances updated
SELECT 
  a.code,
  a.name,
  a.balance,
  (SELECT SUM(jel.debit - jel.credit) FROM journal_entry_lines jel WHERE jel.account_id = a.id) as calculated
FROM accounts a
WHERE a.code IN ('1000', '1010', '2000')
ORDER BY a.code, a.id
LIMIT 10;
