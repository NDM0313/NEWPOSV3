UPDATE accounts a
SET balance = sub.journal_bal
FROM (
  SELECT jel.account_id,
    ROUND(COALESCE(SUM(jel.credit - jel.debit), 0)::numeric, 2) AS journal_bal
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE COALESCE(je.is_void, false) = false
  GROUP BY jel.account_id
) sub
WHERE a.id = sub.account_id
  AND a.id IN (
    'ce35ae9e-de68-4be0-ae84-8c99463a1011'::uuid,
    (SELECT co.account_id FROM couriers co
     JOIN contacts c ON c.id = co.contact_id
     WHERE c.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
       AND UPPER(TRIM(c.name)) = 'YAQOOB' LIMIT 1)
  );

SELECT code, name, balance FROM accounts
WHERE id IN (
  'ce35ae9e-de68-4be0-ae84-8c99463a1011'::uuid,
  (SELECT co.account_id FROM couriers co
   JOIN contacts c ON c.id = co.contact_id
   WHERE c.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
     AND UPPER(TRIM(c.name)) = 'YAQOOB' LIMIT 1)
);
