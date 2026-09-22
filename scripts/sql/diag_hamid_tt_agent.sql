-- HAMID IK TT agent — read-only diagnosis (DIN CHINA)
-- Run:
--   Get-Content scripts/sql/diag_hamid_tt_agent.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set account_1205 'cbd6a16a-5521-43d5-ba33-01994d47c481'
\set payment_id 'b3c19bf3-355a-42e7-a6ab-bcea7f058b50'
\set opening_je_id 'e1a9ff4b-ae8f-482c-b120-8081a2456bb8'

SELECT '=== 1. Accounts 1202 / 1205 ===' AS section;
SELECT id, code, name, type, balance, linked_contact_id, contact_id, is_active
FROM accounts
WHERE company_id = :'company_id'::uuid
  AND code IN ('1202', '1205')
ORDER BY code;

SELECT '=== 2. HAMID contacts ===' AS section;
SELECT id, name, type, opening_balance
FROM contacts
WHERE company_id = :'company_id'::uuid
  AND UPPER(name) LIKE '%HAMID%'
ORDER BY name;

SELECT '=== 3. JE-0308 / JE-0002 / JE-0234 ===' AS section;
SELECT je.id, je.entry_no, je.entry_date, je.reference_type, je.is_void, je.void_reason,
       ROUND(COALESCE(je.total_debit, 0)::numeric, 2) AS amount, je.description
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid
  AND je.entry_no IN ('JE-0308', 'JE-0002', 'JE-0234')
ORDER BY je.entry_no;

SELECT '=== 4. Payment JE-0002 ===' AS section;
SELECT p.id, p.payment_type, p.reference_type, p.amount, p.contact_id, p.payment_account_id,
       pa.code AS pay_acct, p.notes
FROM payments p
LEFT JOIN accounts pa ON pa.id = p.payment_account_id
WHERE p.id = :'payment_id'::uuid;

SELECT '=== 5. 1205 journal net ===' AS section;
SELECT ROUND(COALESCE(SUM(jel.debit - jel.credit), 0)::numeric, 2) AS net_dr_minus_cr
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.account_id = :'account_1205'::uuid
  AND COALESCE(je.is_void, false) = false;

SELECT '=== 6. Active opening on 1205 (expect 0) ===' AS section;
SELECT COUNT(*) AS active_opening_jes
FROM journal_entries je
WHERE je.reference_id = :'account_1205'::uuid
  AND je.reference_type = 'opening_balance_account'
  AND COALESCE(je.is_void, false) = false;
