-- DIN CHINA JE-0006 roznamcha + edit routing repair (read-only GL lines; metadata + synthetic payment only)
-- Run: Get-Content scripts/sql/repair_je_0006_din_china_roznamcha.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on

BEGIN;

-- Compare before state
SELECT 'BEFORE' AS phase, je.entry_no, je.reference_type, je.payment_id,
       p.payment_type, p.payment_account_id, a.name AS payment_account, a.code
FROM journal_entries je
LEFT JOIN payments p ON p.id = je.payment_id
LEFT JOIN accounts a ON a.id = p.payment_account_id
WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND je.entry_no = 'JE-0006';

-- 1) Align JE header with web manual journal contract
UPDATE journal_entries
SET reference_type = 'journal',
    updated_at = NOW()
WHERE id = 'd71b70df-f67f-49e1-afda-baacb1cf8ff5'
  AND company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND entry_no = 'JE-0006';

-- 2) Point synthetic payment at credit bank leg (FHD MZ) — Cash Out
UPDATE payments p
SET payment_account_id = bank_leg.account_id,
    payment_type = 'paid',
    payment_method = 'bank',
    reference_type = 'manual_payment',
    updated_at = NOW()
FROM (
  SELECT jel.account_id
  FROM journal_entry_lines jel
  JOIN accounts a ON a.id = jel.account_id
  WHERE jel.journal_entry_id = 'd71b70df-f67f-49e1-afda-baacb1cf8ff5'
    AND jel.credit > 0
    AND LOWER(COALESCE(a.type, '')) IN ('bank', 'card')
  ORDER BY jel.credit DESC
  LIMIT 1
) AS bank_leg
WHERE p.id = '2b425f8b-373d-4df3-93b9-14b80bcc0bc8'
  AND p.company_id = '30bd8592-3384-4f34-899a-f3907e336485';

COMMIT;

-- Verify after state + compare JE-0007
SELECT 'AFTER' AS phase, je.entry_no, je.reference_type, je.payment_id,
       p.payment_type, p.amount, a.name AS payment_account, a.code
FROM journal_entries je
LEFT JOIN payments p ON p.id = je.payment_id
LEFT JOIN accounts a ON a.id = p.payment_account_id
WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND je.entry_no IN ('JE-0006', 'JE-0007')
ORDER BY je.entry_no;
