-- Void duplicate clearance accrual JE-0311 (liability now on purchase JE-0001 Cr 2031)
UPDATE journal_entries
SET is_void = true,
    void_reason = 'po2025_0003_clearance_on_purchase_je',
    voided_at = NOW(),
    updated_at = NOW()
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND entry_no = 'JE-0311'
  AND COALESCE(is_void, false) = false
  AND description ILIKE '%clearance%YAQOOB%';

-- Refresh cached balances from journal (non-void lines)
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

SELECT a.code, a.name, a.balance
FROM accounts a
JOIN couriers co ON co.account_id = a.id
JOIN contacts c ON c.id = co.contact_id
WHERE c.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND UPPER(TRIM(c.name)) = 'YAQOOB';
