-- YAQOOB courier step-ledger repair — DIN CHINA (PO2025/0003)
-- Replaces lump PAY-0005/6/7 with ~32 incremental bank-transfer payment rows on 2031.
--
-- BACKUP (mandatory):
--   ssh dincouture-vps "docker exec supabase-db pg_dump -U postgres -d postgres \
--     --table=journal_entries --table=journal_entry_lines --table=payments --table=accounts \
--     > /root/backups/yaqoob-step-ledger-$(date +%Y%m%d).sql"
--
-- Dry-run diag:
--   cat scripts/sql/diag_yaqoob_courier_step_ledger.sql | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"
--
-- Apply:
--   cat scripts/sql/repair_yaqoob_courier_step_ledger.sql | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on

BEGIN;

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set branch_id '92f4184e-ee9b-4b6c-8e76-10ee1d166f55'
\set yaqoob_bank_id 'f08ae0ee-a156-4c6c-8607-4b02f0cc15fe'
\set clearance_total 24573440.00
\set legacy_delta 136440.00
\set bank_wali_id '13af87d4-cea5-4085-8cd5-6ea08dc12ada'

CREATE TEMP TABLE yaqoob_ctx ON COMMIT DROP AS
SELECT c.id AS contact_id, a.id AS payable_id
FROM contacts c
JOIN couriers co ON co.contact_id = c.id AND co.company_id = c.company_id
JOIN accounts a ON a.id = co.account_id
WHERE c.company_id = :'company_id'::uuid
  AND UPPER(TRIM(c.name)) = 'YAQOOB'
  AND c.type = 'courier'
  AND a.code ~ '^203[0-9]+$'
  AND a.code <> '2030'
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yaqoob_ctx) THEN
    RAISE EXCEPTION 'YAQOOB courier payable not found';
  END IF;
END $$;

-- ─── Phase 1: Void lump PAY-0005/6/7 (replaced by step transfers) ─────────────
UPDATE journal_entries je
SET is_void = true,
    void_reason = 'YAQOOB step ledger: replaced by incremental bank transfer rows',
    voided_at = NOW(),
    updated_at = NOW()
WHERE je.company_id = :'company_id'::uuid
  AND je.document_no IN ('PAY-0005', 'PAY-0006', 'PAY-0007')
  AND COALESCE(je.is_void, false) = false;

-- ─── Phase 2: Restore + reclass 32 remediation transfers → courier_payment ───
UPDATE journal_entries je
SET is_void = false,
    void_reason = NULL,
    voided_at = NULL,
    reference_type = 'courier_payment',
    reference_id = (SELECT contact_id FROM yaqoob_ctx LIMIT 1),
    description = COALESCE(je.description, '') || ' [YAQOOB step courier payment]',
    updated_at = NOW()
WHERE je.company_id = :'company_id'::uuid
  AND je.reference_type = 'transfer'
  AND je.void_reason = 'YAQOOB remediation: legacy pseudo-bank transfer retired'
  AND EXISTS (
    SELECT 1 FROM journal_entry_lines y
    WHERE y.journal_entry_id = je.id
      AND y.account_id = :'yaqoob_bank_id'::uuid
      AND y.debit > 0
  );

UPDATE journal_entry_lines jel
SET account_id = (SELECT payable_id FROM yaqoob_ctx LIMIT 1),
    description = COALESCE(jel.description, '') || ' [bank transfer → YAQOOB 2031]'
FROM journal_entries je
WHERE je.id = jel.journal_entry_id
  AND je.company_id = :'company_id'::uuid
  AND je.reference_type = 'courier_payment'
  AND je.description ILIKE '%[YAQOOB step courier payment]%'
  AND jel.account_id = :'yaqoob_bank_id'::uuid
  AND jel.debit > 0;

-- ─── Phase 3: Accrual hygiene — void standalone duplicate clearance journal ───
UPDATE journal_entries je
SET is_void = true,
    void_reason = 'po2025_0003_clearance_on_purchase_je',
    voided_at = NOW(),
    updated_at = NOW()
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND je.reference_type = 'journal'
  AND je.payment_id IS NULL
  AND (
    je.description ILIKE '%YAQOOB clearance accrual%'
    OR je.entry_no = 'JE-0311'
  )
  AND EXISTS (
    SELECT 1 FROM journal_entry_lines jel
    WHERE jel.journal_entry_id = je.id
      AND jel.account_id = (SELECT payable_id FROM yaqoob_ctx LIMIT 1)
      AND jel.credit >= :'clearance_total'::numeric - 0.01
  );

-- ─── Phase 4: Legacy pool delta payment (136,440) if not already posted ───────
DO $$
DECLARE
  v_company UUID := '30bd8592-3384-4f34-899a-f3907e336485';
  v_branch UUID := '92f4184e-ee9b-4b6c-8e76-10ee1d166f55';
  v_payable UUID;
  v_bank UUID := '13af87d4-cea5-4085-8cd5-6ea08dc12ada';
  v_clearance NUMERIC := 24573440.00;
  v_delta NUMERIC := 136440.00;
  v_paid NUMERIC;
  v_je_id UUID;
  v_entry_no TEXT;
  v_last_date DATE;
BEGIN
  SELECT payable_id INTO v_payable FROM yaqoob_ctx LIMIT 1;

  SELECT ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) INTO v_paid
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_company
    AND jel.account_id = v_payable
    AND COALESCE(je.is_void, false) = false
    AND je.reference_type = 'courier_payment'
    AND jel.debit > 0;

  IF v_paid >= v_clearance - 0.02 THEN
    RAISE NOTICE '2031 payments already cover clearance (%) — skipping delta JE', v_paid;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE company_id = v_company
      AND COALESCE(is_void, false) = false
      AND description ILIKE '%YAQOOB legacy pool delta%'
  ) THEN
    RAISE NOTICE 'Delta payment already exists — skipping';
    RETURN;
  END IF;

  SELECT MAX(je.entry_date) INTO v_last_date
  FROM journal_entries je
  WHERE je.company_id = v_company
    AND je.reference_type = 'courier_payment'
    AND je.description ILIKE '%[YAQOOB step courier payment]%'
    AND COALESCE(je.is_void, false) = false;

  v_entry_no := public.generate_journal_entry_reference_by_type(v_company, 'journal');
  INSERT INTO journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, is_posted, posted_at, is_manual,
    total_debit, total_credit
  ) VALUES (
    v_company, v_branch, v_entry_no, COALESCE(v_last_date, '2026-04-15'::date),
    'PO2025/0003 clearance — YAQOOB legacy pool delta (step ledger balance)',
    'courier_payment', (SELECT contact_id FROM yaqoob_ctx LIMIT 1),
    true, NOW(), true,
    v_delta, v_delta
  ) RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
  VALUES
    (v_je_id, v_payable, 'YAQOOB clearance balance — legacy import pool delta', v_delta, 0),
    (v_je_id, v_bank, 'YAQOOB clearance balance — legacy import pool delta', 0, v_delta);
END $$;

-- ─── Phase 5: Tie-out gates ──────────────────────────────────────────────────
DO $$
DECLARE
  v_company UUID := '30bd8592-3384-4f34-899a-f3907e336485';
  v_yaqoob_bank UUID := 'f08ae0ee-a156-4c6c-8607-4b02f0cc15fe';
  v_payable UUID;
  v_yaqoob_net NUMERIC;
  v_payable_net NUMERIC;
  v_accrual_cr NUMERIC;
  v_payment_dr NUMERIC;
  v_step_count INT;
  v_tb_imbalance NUMERIC;
BEGIN
  SELECT payable_id INTO v_payable FROM yaqoob_ctx LIMIT 1;

  SELECT ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2)
  INTO v_yaqoob_net
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_company
    AND jel.account_id = v_yaqoob_bank
    AND COALESCE(je.is_void, false) = false;

  IF ABS(v_yaqoob_net) > 0.01 THEN
    RAISE EXCEPTION 'Gate fail: YAQOOB 1204 net % (expected 0)', v_yaqoob_net;
  END IF;

  SELECT ROUND(COALESCE(SUM(jel.credit), 0), 2),
         ROUND(COALESCE(SUM(jel.debit), 0), 2)
  INTO v_accrual_cr, v_payment_dr
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_company
    AND jel.account_id = v_payable
    AND COALESCE(je.is_void, false) = false;

  SELECT ROUND(COALESCE(SUM(jel.credit - jel.debit), 0), 2)
  INTO v_payable_net
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_company
    AND jel.account_id = v_payable
    AND COALESCE(je.is_void, false) = false;

  IF ABS(v_payable_net) > 0.02 THEN
    RAISE EXCEPTION 'Gate fail: YAQOOB 2031 net % (expected 0)', v_payable_net;
  END IF;

  IF ABS(v_accrual_cr - 24573440.00) > 0.02 THEN
    RAISE EXCEPTION 'Gate fail: accrual credit % (expected 24573440)', v_accrual_cr;
  END IF;

  IF ABS(v_payment_dr - 24573440.00) > 0.02 THEN
    RAISE EXCEPTION 'Gate fail: payment debit % (expected 24573440)', v_payment_dr;
  END IF;

  SELECT COUNT(*) INTO v_step_count
  FROM journal_entries je
  WHERE je.company_id = v_company
    AND je.reference_type = 'courier_payment'
    AND COALESCE(je.is_void, false) = false
    AND (
      je.description ILIKE '%[YAQOOB step courier payment]%'
      OR je.description ILIKE '%legacy pool delta%'
    );

  IF v_step_count < 30 THEN
    RAISE EXCEPTION 'Gate fail: step payment count % (expected >= 30)', v_step_count;
  END IF;

  SELECT ROUND(ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)), 2)
  INTO v_tb_imbalance
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_company
    AND COALESCE(je.is_void, false) = false;

  IF v_tb_imbalance > 0.05 THEN
    RAISE EXCEPTION 'Gate fail: company trial imbalance %', v_tb_imbalance;
  END IF;

  RAISE NOTICE 'All gates passed. 2031 net=%, step_payments=%, accrual=%, paid=%',
    v_payable_net, v_step_count, v_accrual_cr, v_payment_dr;
END $$;

-- ─── Phase 6: Refresh cached balances ────────────────────────────────────────
UPDATE accounts a
SET balance = sub.journal_bal, updated_at = NOW()
FROM (
  SELECT jel.account_id,
    ROUND(COALESCE(SUM(jel.credit - jel.debit), 0)::numeric, 2) AS journal_bal
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = :'company_id'::uuid
    AND COALESCE(je.is_void, false) = false
  GROUP BY jel.account_id
) sub
WHERE a.id = sub.account_id
  AND a.id IN (
    :'yaqoob_bank_id'::uuid,
    (SELECT payable_id FROM yaqoob_ctx LIMIT 1)
  );

COMMIT;

SELECT 'POST-REPAIR courier_ledger rows' AS phase;
SELECT COUNT(*) AS row_count,
       ROUND(SUM(debit)::numeric, 2) AS sum_debit,
       ROUND(SUM(credit)::numeric, 2) AS sum_credit
FROM courier_ledger
WHERE company_id = :'company_id'::uuid
  AND UPPER(TRIM(courier_name)) = 'YAQOOB';
