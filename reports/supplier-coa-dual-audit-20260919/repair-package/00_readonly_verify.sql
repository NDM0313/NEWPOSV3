-- READ-ONLY verification for limited repair (IBRAHIM + ID LACE). Do not UPDATE/DELETE.

-- 1) IBRAHIM leftover lines still on retired 210026
SELECT jel.id AS line_id, je.id AS je_id, je.entry_no, je.entry_date, jel.debit, jel.credit, a.code, a.is_active, a.linked_contact_id
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE a.id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c'
  AND COALESCE(je.is_void, false) = false
ORDER BY je.entry_date, jel.id;

-- Expect exactly:
-- 677c74de-b677-4a6f-877f-b13e0ac66aaa Dr 19000
-- 343c2586-2d86-4c24-9e03-3af493dada9d Dr 99275

-- 2) Expected balances after IBRAHIM line remap (read-only math)
WITH leg AS (
  SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS net
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c'
    AND COALESCE(je.is_void, false) = false
),
ap AS (
  SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS net
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312'
    AND COALESCE(je.is_void, false) = false
)
SELECT
  (SELECT net FROM leg) AS legacy_net_dr_minus_cr,
  (SELECT net FROM ap) AS ap_net_before,
  (SELECT net FROM ap) + (SELECT net FROM leg) AS ap_net_after_if_remap;

-- 3) ID LACE dual inventory (no apply)
SELECT a.code, a.is_active, a.linked_contact_id,
       COUNT(jel.id) FILTER (WHERE COALESCE(je.is_void,false)=false) AS open_lines,
       COALESCE(SUM(jel.debit) FILTER (WHERE COALESCE(je.is_void,false)=false),0) AS dr,
       COALESCE(SUM(jel.credit) FILTER (WHERE COALESCE(je.is_void,false)=false),0) AS cr
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE a.id IN (
  'e11d244a-b96e-4128-8ca3-2bae5a4f813c',
  '30bbe521-5773-4985-8be1-0d336c56a6a3'
)
GROUP BY a.code, a.is_active, a.linked_contact_id
ORDER BY a.code;

-- 4) Guard table (after migration applied)
SELECT from_account_id, to_account_id, source
FROM journal_account_verified_remaps
WHERE company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'
  AND from_account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';

-- 5) Hold parties must NOT appear in this apply set
SELECT contact_code, contact_name FROM (VALUES
  ('SUP-ZHD-0007','DHL'),
  ('SUP-ZHD-0036','KIRAN MUKESH'),
  ('SUP-ZHD-0046','SHAHMIM NAZ'),
  ('SUP-ZHD-0162','DHL PK')
) AS h(contact_code, contact_name);
