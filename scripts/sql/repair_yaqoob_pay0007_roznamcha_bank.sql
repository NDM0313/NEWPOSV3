-- PAY-0007 roznamcha fix — credit WALI T/T → FHD MZ (company bank leg for cash book)
-- Idempotent; run after repair_yaqoob_courier_din_china.sql
--
-- Apply:
--   Get-Content scripts/sql/repair_yaqoob_pay0007_roznamcha_bank.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on

BEGIN;

\set pay7_id 'e790dd8c-89b6-477d-8ae2-4809ff93b363'
\set pay7_je_id 'ac6f60b8-6b1d-4a94-89d9-49daf7427f4f'
\set bank_wali_id '13af87d4-cea5-4085-8cd5-6ea08dc12ada'
\set bank_fhd_id '767952ce-e3ec-472f-8e8c-0f8001e4e5c7'

UPDATE journal_entry_lines jel
SET account_id = :'bank_fhd_id'::uuid,
    description = COALESCE(jel.description, '') || ' [roznamcha bank leg FHD MZ]'
FROM journal_entries je
WHERE je.id = jel.journal_entry_id
  AND je.id = :'pay7_je_id'::uuid
  AND jel.account_id = :'bank_wali_id'::uuid
  AND jel.credit > 0;

UPDATE payments
SET payment_account_id = :'bank_fhd_id'::uuid,
    payment_method = 'bank',
    updated_at = NOW()
WHERE id = :'pay7_id'::uuid
  AND payment_account_id = :'bank_wali_id'::uuid;

DO $$
DECLARE
  v_pay_acct UUID;
  v_je_acct UUID;
BEGIN
  SELECT payment_account_id INTO v_pay_acct FROM payments WHERE id = 'e790dd8c-89b6-477d-8ae2-4809ff93b363';
  IF v_pay_acct IS DISTINCT FROM '767952ce-e3ec-472f-8e8c-0f8001e4e5c7'::uuid THEN
    RAISE EXCEPTION 'Gate fail: PAY-0007 payment_account_id %', v_pay_acct;
  END IF;

  SELECT jel.account_id INTO v_je_acct
  FROM journal_entry_lines jel
  WHERE jel.journal_entry_id = 'ac6f60b8-6b1d-4a94-89d9-49daf7427f4f' AND jel.credit > 0
  LIMIT 1;

  IF v_je_acct IS DISTINCT FROM '767952ce-e3ec-472f-8e8c-0f8001e4e5c7'::uuid THEN
    RAISE EXCEPTION 'Gate fail: PAY-0007 JE credit account %', v_je_acct;
  END IF;
END $$;

COMMIT;

SELECT je.document_no, p.payment_account_id, a.code, a.name
FROM payments p
JOIN journal_entries je ON je.payment_id = p.id
LEFT JOIN accounts a ON a.id = p.payment_account_id
WHERE p.id = 'e790dd8c-89b6-477d-8ae2-4809ff93b363';
