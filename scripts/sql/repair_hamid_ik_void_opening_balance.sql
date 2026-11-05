-- DIN CHINA — void mistaken opening balance on HAMID IK RMB (1205) Rs 921,691
-- Actual TT agent flow: JE-0234 (FHD MZ → WALI T/T) + JE-0002 (WALI → 1205) on 2025-12-02
-- JE-0308 wrongly posted opening_balance_account on 2025-10-02.
--
-- Apply:
--   Get-Content scripts/sql/repair_hamid_ik_void_opening_balance.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set opening_je_id 'e1a9ff4b-ae8f-482c-b120-8081a2456bb8'
\set account_1205 'cbd6a16a-5521-43d5-ba33-01994d47c481'
\set expected_amount 921691.00

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE id = 'e1a9ff4b-ae8f-482c-b120-8081a2456bb8'::uuid
      AND reference_type = 'opening_balance_account'
      AND COALESCE(is_void, false) = false
  ) THEN
    RAISE NOTICE 'JE-0308 already void or missing — idempotent skip';
  END IF;
END $$;

UPDATE journal_entries je
SET is_void = true,
    void_reason = COALESCE(je.void_reason, 'hamid_ik_rmb_not_opening_supplier_payment'),
    voided_at = COALESCE(je.voided_at, NOW()),
    updated_at = NOW()
WHERE je.id = :'opening_je_id'::uuid
  AND je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false;

-- Refresh cached balances for affected accounts
UPDATE accounts a
SET balance = sub.bal,
    updated_at = NOW()
FROM (
  SELECT jel.account_id,
    ROUND(COALESCE(SUM(jel.debit - jel.credit), 0)::numeric, 2) AS bal
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = :'company_id'::uuid
    AND COALESCE(je.is_void, false) = false
  GROUP BY jel.account_id
) sub
WHERE a.id = sub.account_id
  AND a.company_id = :'company_id'::uuid
  AND a.id IN (
    :'account_1205'::uuid,
    (SELECT id FROM accounts WHERE company_id = :'company_id'::uuid AND code = '3000' LIMIT 1),
    (SELECT id FROM accounts WHERE company_id = :'company_id'::uuid AND code = '1202' LIMIT 1),
    (SELECT id FROM accounts WHERE company_id = :'company_id'::uuid AND code = 'DC0108' LIMIT 1)
  );

SELECT '=== post-repair ===' AS section;
SELECT je.entry_no, je.is_void, je.void_reason
FROM journal_entries je WHERE je.id = :'opening_je_id'::uuid;

SELECT a.code, a.name, a.balance
FROM accounts a
WHERE a.company_id = :'company_id'::uuid
  AND a.code IN ('1205', '3000', '1202', 'DC0108')
ORDER BY a.code;

SELECT '1205 journal net' AS check,
  ROUND(COALESCE(SUM(jel.debit - jel.credit), 0)::numeric, 2) AS net_dr_minus_cr
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.account_id = :'account_1205'::uuid
  AND COALESCE(je.is_void, false) = false;

SELECT '3000 opening 921691 lines (expect 0)' AS check, COUNT(*) AS cnt
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND a.code = '3000'
  AND COALESCE(je.is_void, false) = false
  AND je.reference_type = 'opening_balance_account'
  AND ABS(jel.debit - :'expected_amount'::numeric) < 1;

COMMIT;
