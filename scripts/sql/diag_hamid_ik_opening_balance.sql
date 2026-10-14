-- Diagnose HAMID IK RMB 921,691 — opening balance vs supplier payment (DIN CHINA)
\set company_id '30bd8592-3384-4f34-899a-f3907e336485'

SELECT '=== 1. HAMID IK contacts / accounts ===' AS section;
SELECT c.id, c.name, c.type, c.opening_balance,
       a.id AS account_id, a.code, a.name AS account_name, a.type AS account_type, a.balance
FROM contacts c
LEFT JOIN accounts a ON a.contact_id = c.id AND a.company_id = c.company_id
WHERE c.company_id = :'company_id'::uuid
  AND UPPER(c.name) LIKE '%HAMID%'
ORDER BY c.type, a.code;

SELECT '=== 2. Opening balance JEs (HAMID / 1205 / 921691) ===' AS section;
SELECT je.id, je.entry_no, je.document_no, je.entry_date, je.reference_type,
       je.reference_id, je.is_void, je.description,
       ROUND(COALESCE(je.total_debit, 0)::numeric, 2) AS total_debit
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND (
    je.description ILIKE '%HAMID%'
    OR je.description ILIKE '%1205%'
    OR ABS(COALESCE(je.total_debit, 0) - 921691) < 1
    OR ABS(COALESCE(je.total_credit, 0) - 921691) < 1
  )
  AND je.reference_type ILIKE '%opening%'
ORDER BY je.entry_date;

SELECT '=== 3. Payments / transfers HAMID 921691 ===' AS section;
SELECT p.id, je.document_no, je.entry_no, je.entry_date, p.amount, p.reference_type,
       p.payment_account_id, pa.code AS pay_acct, pa.name AS pay_acct_name,
       p.contact_id, c.name AS contact_name, je.reference_type, je.description
FROM payments p
JOIN journal_entries je ON je.payment_id = p.id
LEFT JOIN accounts pa ON pa.id = p.payment_account_id
LEFT JOIN contacts c ON c.id = p.contact_id
WHERE p.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND (
    ABS(p.amount - 921691) < 1
    OR je.description ILIKE '%HAMID%'
    OR c.name ILIKE '%HAMID%'
  )
ORDER BY je.entry_date;

SELECT '=== 4. JE lines on 921691 amount ===' AS section;
SELECT je.entry_no, je.reference_type, je.description, a.code, a.name,
       ROUND(jel.debit::numeric, 2) AS debit, ROUND(jel.credit::numeric, 2) AS credit
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND (ABS(jel.debit - 921691) < 1 OR ABS(jel.credit - 921691) < 1)
ORDER BY je.entry_date, je.entry_no, jel.debit DESC;

SELECT '=== 5. Account 1205 ===' AS section;
SELECT id, code, name, type, balance, contact_id
FROM accounts
WHERE company_id = :'company_id'::uuid
  AND (code = '1205' OR name ILIKE '%HAMID%RMB%')
ORDER BY code;
