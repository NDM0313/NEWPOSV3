-- DIN CHINA — HAMID IK TT agent remediation (not supplier; not opening balance)
-- 1) Ensure JE-0308 opening void
-- 2) Create HAMID IK party contact (customer — no AP)
-- 3) Link 1205 HAMID IK RMB via linked_contact_id only (not 1202 WALI T/T)
-- 4) Reclassify JE-0002 / payment from manual_receipt → transfer
--
-- Apply:
--   Get-Content scripts/sql/repair_hamid_tt_agent_din_china.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set branch_id '92f4184e-ee9b-4b6c-8e76-10ee1d166f55'
\set account_1205 'cbd6a16a-5521-43d5-ba33-01994d47c481'
\set account_1202 '13af87d4-cea5-4085-8cd5-6ea08dc12ada'
\set opening_je_id 'e1a9ff4b-ae8f-482c-b120-8081a2456bb8'
\set payment_id 'b3c19bf3-355a-42e7-a6ab-bcea7f058b50'

-- ─── Phase 1: void mistaken opening (idempotent) ─────────────────────────────
UPDATE journal_entries je
SET is_void = true,
    void_reason = COALESCE(je.void_reason, 'hamid_ik_rmb_not_opening_tt_agent'),
    voided_at = COALESCE(je.voided_at, NOW()),
    updated_at = NOW()
WHERE je.id = :'opening_je_id'::uuid
  AND je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false;

-- ─── Phase 2: HAMID IK TT agent contact ─────────────────────────────────────
DO $$
DECLARE
  v_contact UUID;
BEGIN
  SELECT id INTO v_contact
  FROM contacts
  WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'::uuid
    AND UPPER(TRIM(name)) = 'HAMID IK'
  LIMIT 1;

  IF v_contact IS NULL THEN
    INSERT INTO contacts (
      company_id, branch_id, type, name, is_active, is_default,
      opening_balance, credit_limit, payment_terms
    )
    VALUES (
      '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
      '92f4184e-ee9b-4b6c-8e76-10ee1d166f55'::uuid,
      'customer',
      'HAMID IK',
      true,
      false,
      0,
      0,
      0
    )
    RETURNING id INTO v_contact;
  END IF;

  DROP TABLE IF EXISTS hamid_ctx;
  CREATE TEMP TABLE hamid_ctx (contact_id UUID PRIMARY KEY);
  INSERT INTO hamid_ctx (contact_id) VALUES (v_contact);
END $$;

-- ─── Phase 3: link 1205 only (not WALI T/T) ───────────────────────────────
UPDATE accounts a
SET linked_contact_id = (SELECT contact_id FROM hamid_ctx LIMIT 1),
    updated_at = NOW()
WHERE a.id = :'account_1205'::uuid
  AND a.company_id = :'company_id'::uuid
  AND (
    a.linked_contact_id IS DISTINCT FROM (SELECT contact_id FROM hamid_ctx LIMIT 1)
  );

-- ─── Phase 4: reclassify JE-0002 payment + JE metadata ──────────────────────
UPDATE payments p
SET reference_type = 'transfer',
    payment_type = 'paid',
    contact_id = (SELECT contact_id FROM hamid_ctx LIMIT 1),
    reference_id = :'account_1205'::uuid,
    notes = 'TT agent top-up — HAMID IK RMB (22290×41.35) — WALI T/T → 1205',
    updated_at = NOW()
WHERE p.id = :'payment_id'::uuid
  AND p.company_id = :'company_id'::uuid
  AND (
    p.reference_type IS DISTINCT FROM 'transfer'
    OR p.contact_id IS DISTINCT FROM (SELECT contact_id FROM hamid_ctx LIMIT 1)
  );

UPDATE journal_entries je
SET reference_type = 'transfer',
    reference_id = :'account_1205'::uuid,
    description = 'TT agent top-up — WALI T/T (1202) → HAMID IK RMB (1205) — 22290×41.35 RMB',
    updated_at = NOW()
WHERE je.payment_id = :'payment_id'::uuid
  AND je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false;

-- ─── Phase 5: refresh cached balances ───────────────────────────────────────
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
    :'account_1202'::uuid,
    (SELECT id FROM accounts WHERE company_id = :'company_id'::uuid AND code = '3000' LIMIT 1),
    (SELECT id FROM accounts WHERE company_id = :'company_id'::uuid AND code = 'DC0108' LIMIT 1)
  );

-- ─── Phase 6: verify gates ──────────────────────────────────────────────────
SELECT 'gate_je0308_void' AS gate,
  CASE WHEN EXISTS (
    SELECT 1 FROM journal_entries WHERE id = :'opening_je_id'::uuid AND is_void = true
  ) THEN 'PASS' ELSE 'FAIL' END AS status;

SELECT 'gate_no_active_opening_1205' AS gate,
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_id = :'account_1205'::uuid
      AND je.reference_type = 'opening_balance_account'
      AND COALESCE(je.is_void, false) = false
  ) THEN 'PASS' ELSE 'FAIL' END AS status;

SELECT 'gate_1205_net' AS gate,
  ROUND(COALESCE(SUM(jel.debit - jel.credit), 0)::numeric, 2) AS net,
  CASE WHEN ABS(COALESCE(SUM(jel.debit - jel.credit), 0) - 921691) < 1 THEN 'PASS' ELSE 'FAIL' END AS status
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.account_id = :'account_1205'::uuid
  AND COALESCE(je.is_void, false) = false;

SELECT 'gate_je0002_transfer' AS gate,
  je.reference_type,
  CASE WHEN je.reference_type = 'transfer' THEN 'PASS' ELSE 'FAIL' END AS status
FROM journal_entries je
WHERE je.payment_id = :'payment_id'::uuid
  AND COALESCE(je.is_void, false) = false
LIMIT 1;

SELECT 'gate_payment_transfer' AS gate,
  p.reference_type,
  p.payment_type,
  CASE WHEN p.reference_type = 'transfer' THEN 'PASS' ELSE 'FAIL' END AS status
FROM payments p
WHERE p.id = :'payment_id'::uuid;

SELECT 'gate_1205_linked_contact' AS gate,
  a.linked_contact_id,
  c.name AS contact_name,
  CASE WHEN a.linked_contact_id = (SELECT contact_id FROM hamid_ctx LIMIT 1) THEN 'PASS' ELSE 'FAIL' END AS status
FROM accounts a
LEFT JOIN contacts c ON c.id = a.linked_contact_id
WHERE a.id = :'account_1205'::uuid;

SELECT 'gate_1202_not_linked_hamid' AS gate,
  CASE WHEN a.linked_contact_id IS NULL
    OR a.linked_contact_id IS DISTINCT FROM (SELECT contact_id FROM hamid_ctx LIMIT 1)
  THEN 'PASS' ELSE 'FAIL' END AS status
FROM accounts a
WHERE a.id = :'account_1202'::uuid;

COMMIT;
