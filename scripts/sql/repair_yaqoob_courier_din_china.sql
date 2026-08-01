-- YAQOOB courier / clearance full reclass — DIN CHINA (PO2025/0003)
--
-- Legacy import treated clearance agent YAQOOB as bank 1204. This script:
--   1) Creates YAQOOB courier contact + 2031 payable + couriers master
--   2) Voids 32 internal transfers that funded pseudo-bank YAQOOB
--   3) Posts clearance accrual Dr 5100 / Cr 2031 = 24,573,440
--   4) Reclasses PAY-0005/6/7 as courier_payment (Dr 2031 / Cr real bank)
--   5) Fixes purchase paid/due + purchase_charges freight row
--   6) Retires inactive YAQOOB 1204 (balance must be 0)
--
-- BACKUP (mandatory before apply):
--   ssh dincouture-vps "docker exec supabase-db pg_dump -U postgres -d postgres \
--     --table=accounts --table=contacts --table=couriers \
--     --table=journal_entries --table=journal_entry_lines \
--     --table=payments --table=purchases --table=purchase_charges \
--     > /root/backups/yaqoob-repair-$(date +%Y%m%d).sql"
--
-- Dry-run diag first:
--   Get-Content scripts/sql/diag_yaqoob_courier_remediation.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"
--
-- Apply:
--   Get-Content scripts/sql/repair_yaqoob_courier_din_china.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on

BEGIN;

-- ─── Constants ───────────────────────────────────────────────────────────────
\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set branch_id '92f4184e-ee9b-4b6c-8e76-10ee1d166f55'
\set yaqoob_bank_id 'f08ae0ee-a156-4c6c-8607-4b02f0cc15fe'
\set ap_account_id 'ce35ae9e-de68-4be0-ae84-8c99463a1011'
\set shipping_expense_id '2ac7d4fe-e427-4462-8f0b-f9a6821bd46a'
\set purchase_id 'a065035c-dca2-4079-837a-9c2aeca9332d'
\set supplier_contact_id '36fe85d7-95cf-49ad-8922-cabe5f3596cc'
\set bank_fhd_id '767952ce-e3ec-472f-8e8c-0f8001e4e5c7'
\set bank_ndm_id 'a903c6d2-6ba8-4e40-849e-39e6b7394901'
\set bank_wali_id '13af87d4-cea5-4085-8cd5-6ea08dc12ada'
\set clearance_total 24573440.00
\set supplier_paid_correct 41343000.00

-- PAY ids
\set pay5_id 'a158e247-73bb-4ece-9eb7-9de3dd8d960a'
\set pay6_id 'c98ea2ca-9e12-4be0-b76c-f68d784d836d'
\set pay7_id 'e790dd8c-89b6-477d-8ae2-4809ff93b363'
\set pay5_je_id 'ae5b11f1-c02c-42a3-818f-0880082216ac'
\set pay6_je_id 'b797a65c-72f1-4f2e-bcb1-6459b2d8d825'
\set pay7_je_id 'ac6f60b8-6b1d-4a94-89d9-49daf7427f4f'

-- ─── Snapshot bank credits from YAQOOB transfers (tie-out baseline) ──────────
CREATE TEMP TABLE yaqoob_bank_baseline ON COMMIT DROP AS
SELECT a.id AS account_id, a.code, ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS bank_cr
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND je.reference_type = 'transfer'
  AND jel.credit > 0
  AND EXISTS (
    SELECT 1 FROM journal_entry_lines y
    WHERE y.journal_entry_id = je.id
      AND y.account_id = :'yaqoob_bank_id'::uuid
      AND y.debit > 0
  )
GROUP BY a.id, a.code;

-- ─── Phase 1: YAQOOB courier identity ────────────────────────────────────────
DO $$
DECLARE
  v_company UUID := '30bd8592-3384-4f34-899a-f3907e336485';
  v_contact_id UUID;
  v_payable_id UUID;
  v_courier_row UUID;
BEGIN
  SELECT id INTO v_contact_id
  FROM contacts
  WHERE company_id = v_company AND UPPER(TRIM(name)) = 'YAQOOB' AND type = 'courier'
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    INSERT INTO contacts (company_id, type, name, is_active, is_default, opening_balance, credit_limit, payment_terms)
    VALUES (v_company, 'courier', 'YAQOOB', true, false, 0, 0, 0)
    RETURNING id INTO v_contact_id;
  END IF;

  v_payable_id := public.get_or_create_courier_payable_account(v_company, v_contact_id, 'YAQOOB');
  IF v_payable_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create YAQOOB courier payable account';
  END IF;

  SELECT id INTO v_courier_row FROM couriers WHERE company_id = v_company AND contact_id = v_contact_id LIMIT 1;
  IF v_courier_row IS NULL THEN
    INSERT INTO couriers (company_id, name, contact_id, account_id, default_rate, is_active)
    VALUES (v_company, 'YAQOOB', v_contact_id, v_payable_id, 0, true);
  ELSE
    UPDATE couriers
    SET account_id = COALESCE(account_id, v_payable_id), is_active = true, name = 'YAQOOB'
    WHERE id = v_courier_row;
  END IF;
END $$;

-- Resolve 2031 id for later updates
CREATE TEMP TABLE yaqoob_ctx ON COMMIT DROP AS
SELECT c.id AS contact_id, a.id AS payable_id
FROM contacts c
JOIN accounts a ON a.contact_id = c.id AND a.company_id = c.company_id
WHERE c.company_id = :'company_id'::uuid
  AND UPPER(TRIM(c.name)) = 'YAQOOB'
  AND c.type = 'courier'
  AND a.code ~ '^203[0-9]+$'
  AND a.code <> '2030'
LIMIT 1;

-- ─── Phase 2: Void YAQOOB funding transfers (pool eliminated) ───────────────
UPDATE journal_entries je
SET is_void = true,
    void_reason = 'YAQOOB remediation: legacy pseudo-bank transfer retired',
    voided_at = NOW(),
    updated_at = NOW()
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND je.reference_type = 'transfer'
  AND EXISTS (
    SELECT 1 FROM journal_entry_lines y
    WHERE y.journal_entry_id = je.id
      AND y.account_id = :'yaqoob_bank_id'::uuid
      AND y.debit > 0
  );

-- ─── Phase 3: Clearance accrual Dr 5100 / Cr 2031 ───────────────────────────
DO $$
DECLARE
  v_company UUID := '30bd8592-3384-4f34-899a-f3907e336485';
  v_branch UUID := '92f4184e-ee9b-4b6c-8e76-10ee1d166f55';
  v_purchase UUID := 'a065035c-dca2-4079-837a-9c2aeca9332d';
  v_expense UUID := '2ac7d4fe-e427-4462-8f0b-f9a6821bd46a';
  v_payable UUID;
  v_je_id UUID;
  v_entry_no TEXT;
  v_amount NUMERIC := 24573440.00;
BEGIN
  SELECT payable_id INTO v_payable FROM yaqoob_ctx LIMIT 1;
  IF v_payable IS NULL THEN RAISE EXCEPTION 'YAQOOB payable account missing after create'; END IF;

  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE company_id = v_company
      AND reference_type = 'journal'
      AND description ILIKE '%YAQOOB clearance accrual%'
      AND COALESCE(is_void, false) = false
  ) THEN
    RAISE NOTICE 'Clearance accrual already posted — skipping';
    RETURN;
  END IF;

  v_entry_no := public.generate_journal_entry_reference_by_type(v_company, 'journal');
  INSERT INTO journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, is_posted, posted_at, is_manual,
    total_debit, total_credit
  ) VALUES (
    v_company, v_branch, v_entry_no, '2025-10-28'::date,
    'PO2025/0003 clearance — YAQOOB accrual (legacy remediation)',
    'journal', NULL, true, NOW(), true,
    v_amount, v_amount
  ) RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
  VALUES
    (v_je_id, v_expense, 'PO2025/0003 clearance freight/customs — YAQOOB', v_amount, 0),
    (v_je_id, v_payable, 'PO2025/0003 clearance freight/customs — YAQOOB', 0, v_amount);
END $$;

-- ─── Phase 4: Reclass PAY-0005/6/7 → courier_payment ────────────────────────
-- GL: Dr AP → Dr 2031; Cr YAQOOB → Cr real bank (mapped from legacy notes)
UPDATE journal_entry_lines jel
SET account_id = (SELECT payable_id FROM yaqoob_ctx LIMIT 1),
    description = COALESCE(jel.description, '') || ' [YAQOOB courier reclass]'
FROM journal_entries je
WHERE je.id = jel.journal_entry_id
  AND je.id IN (
    'ae5b11f1-c02c-42a3-818f-0880082216ac',
    'b797a65c-72f1-4f2e-bcb1-6459b2d8d825',
    'ac6f60b8-6b1d-4a94-89d9-49daf7427f4f'
  )
  AND jel.account_id = :'ap_account_id'::uuid
  AND jel.debit > 0;

UPDATE journal_entry_lines jel
SET account_id = CASE je.document_no
      WHEN 'PAY-0005' THEN :'bank_fhd_id'::uuid
      WHEN 'PAY-0006' THEN :'bank_ndm_id'::uuid
      WHEN 'PAY-0007' THEN :'bank_wali_id'::uuid
      ELSE jel.account_id
    END,
    description = COALESCE(jel.description, '') || ' [YAQOOB courier reclass]'
FROM journal_entries je
WHERE je.id = jel.journal_entry_id
  AND je.id IN (
    'ae5b11f1-c02c-42a3-818f-0880082216ac',
    'b797a65c-72f1-4f2e-bcb1-6459b2d8d825',
    'ac6f60b8-6b1d-4a94-89d9-49daf7427f4f'
  )
  AND jel.account_id = :'yaqoob_bank_id'::uuid
  AND jel.credit > 0;

UPDATE journal_entries je
SET reference_type = 'courier_payment',
    reference_id = (SELECT contact_id FROM yaqoob_ctx LIMIT 1),
    description = COALESCE(je.description, '') || ' [courier clearance reclass]',
    updated_at = NOW()
WHERE je.id IN (
  'ae5b11f1-c02c-42a3-818f-0880082216ac',
  'b797a65c-72f1-4f2e-bcb1-6459b2d8d825',
  'ac6f60b8-6b1d-4a94-89d9-49daf7427f4f'
);

UPDATE payments p
SET reference_type = 'courier_payment',
    contact_id = (SELECT contact_id FROM yaqoob_ctx LIMIT 1),
    reference_id = (SELECT contact_id FROM yaqoob_ctx LIMIT 1),
    payment_account_id = CASE p.id::text
      WHEN 'a158e247-73bb-4ece-9eb7-9de3dd8d960a' THEN :'bank_fhd_id'::uuid
      WHEN 'c98ea2ca-9e12-4be0-b76c-f68d784d836d' THEN :'bank_ndm_id'::uuid
      WHEN 'e790dd8c-89b6-477d-8ae2-4809ff93b363' THEN :'bank_wali_id'::uuid
      ELSE p.payment_account_id
    END,
    payment_method = 'bank',
    payment_type = 'paid',
    notes = COALESCE(p.notes, '') || ' [reclass: clearance/courier YAQOOB]',
    updated_at = NOW()
WHERE p.id IN (
  'a158e247-73bb-4ece-9eb7-9de3dd8d960a',
  'c98ea2ca-9e12-4be0-b76c-f68d784d836d',
  'e790dd8c-89b6-477d-8ae2-4809ff93b363'
);

-- ─── Phase 5: Purchase metadata ──────────────────────────────────────────────
UPDATE purchases
SET paid_amount = :supplier_paid_correct,
    due_amount = ROUND(total - :supplier_paid_correct, 2),
    shipping_cost = :clearance_total,
    updated_at = NOW()
WHERE id = :'purchase_id'::uuid
  AND company_id = :'company_id'::uuid;

INSERT INTO purchase_charges (purchase_id, charge_type, ledger_account_id, amount)
SELECT :'purchase_id'::uuid, 'freight', :'shipping_expense_id'::uuid, :clearance_total
WHERE NOT EXISTS (
  SELECT 1 FROM purchase_charges
  WHERE purchase_id = :'purchase_id'::uuid
    AND charge_type = 'freight'
    AND amount = :clearance_total
);

-- ─── Phase 6: Retire YAQOOB 1204 ─────────────────────────────────────────────
UPDATE accounts
SET is_active = false,
    name = 'YAQOOB (retired legacy import)',
    updated_at = NOW()
WHERE id = :'yaqoob_bank_id'::uuid
  AND company_id = :'company_id'::uuid;

-- ─── Phase 7: Tie-out gates (abort if fail) ──────────────────────────────────
DO $$
DECLARE
  v_company UUID := '30bd8592-3384-4f34-899a-f3907e336485';
  v_yaqoob UUID := 'f08ae0ee-a156-4c6c-8607-4b02f0cc15fe';
  v_payable UUID;
  v_yaqoob_net NUMERIC;
  v_payable_net NUMERIC;
  v_paid NUMERIC;
  v_due NUMERIC;
  v_baseline_total NUMERIC;
  v_after_total NUMERIC;
  v_legacy_delta NUMERIC := 136440.00;
BEGIN
  SELECT payable_id INTO v_payable FROM yaqoob_ctx LIMIT 1;

  SELECT ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2)
  INTO v_yaqoob_net
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_company
    AND jel.account_id = v_yaqoob
    AND COALESCE(je.is_void, false) = false;

  IF ABS(v_yaqoob_net) > 0.01 THEN
    RAISE EXCEPTION 'Gate fail: YAQOOB 1204 net balance % (expected 0)', v_yaqoob_net;
  END IF;

  SELECT ROUND(COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0), 2)
  INTO v_payable_net
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_company
    AND jel.account_id = v_payable
    AND COALESCE(je.is_void, false) = false;

  IF ABS(v_payable_net) > 0.01 THEN
    RAISE EXCEPTION 'Gate fail: YAQOOB 2031 payable net % (expected 0)', v_payable_net;
  END IF;

  SELECT paid_amount, due_amount INTO v_paid, v_due
  FROM purchases WHERE id = 'a065035c-dca2-4079-837a-9c2aeca9332d';

  IF v_paid <> 41343000.00 THEN
    RAISE EXCEPTION 'Gate fail: purchase paid_amount % (expected 41343000)', v_paid;
  END IF;

  IF ABS(v_due - 26635418.40) > 0.02 THEN
    RAISE EXCEPTION 'Gate fail: purchase due_amount % (expected ~26635418.40)', v_due;
  END IF;

  SELECT COALESCE(SUM(bank_cr), 0) INTO v_baseline_total FROM yaqoob_bank_baseline;

  SELECT ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2)
  INTO v_after_total
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_company
    AND COALESCE(je.is_void, false) = false
    AND je.document_no IN ('PAY-0005', 'PAY-0006', 'PAY-0007')
    AND jel.credit > 0
    AND jel.account_id IN (
      '767952ce-e3ec-472f-8e8c-0f8001e4e5c7',
      'a903c6d2-6ba8-4e40-849e-39e6b7394901',
      '13af87d4-cea5-4085-8cd5-6ea08dc12ada',
      '8120ff5b-9d36-4c97-8d3e-ee3a9328a29b'
    );

  -- Legacy pool was short by 136,440 vs clearance payments; bank outflow increases by that delta.
  IF ABS((v_after_total - v_baseline_total) - v_legacy_delta) > 0.02 THEN
    RAISE EXCEPTION 'Gate fail: bank credit delta % (expected legacy delta %)', (v_after_total - v_baseline_total), v_legacy_delta;
  END IF;

  RAISE NOTICE 'All tie-out gates passed. YAQOOB 1204=%, 2031=%, purchase paid=%, bank delta=%',
    v_yaqoob_net, v_payable_net, v_paid, (v_after_total - v_baseline_total);
END $$;

COMMIT;

-- Post-commit verification (read-only)
SELECT 'POST' AS phase, code, name, balance, is_active
FROM accounts
WHERE id IN ('f08ae0ee-a156-4c6c-8607-4b02f0cc15fe')
   OR (company_id = '30bd8592-3384-4f34-899a-f3907e336485' AND code ~ '^2031$');

SELECT po_no, total, paid_amount, due_amount, shipping_cost
FROM purchases WHERE id = 'a065035c-dca2-4079-837a-9c2aeca9332d';

SELECT je.document_no, p.reference_type, a.code AS pay_acct
FROM payments p
JOIN journal_entries je ON je.payment_id = p.id
LEFT JOIN accounts a ON a.id = p.payment_account_id
WHERE je.document_no IN ('PAY-0005', 'PAY-0006', 'PAY-0007')
ORDER BY je.document_no;
