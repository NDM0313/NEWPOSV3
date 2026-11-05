-- PO2025/0003 — move clearance Cr from supplier AP to courier payable 2031 (landed cost split)
-- Idempotent; run after repair_yaqoob_courier_din_china.sql + clearance line split
--
-- Apply:
--   Get-Content scripts/sql/repair_po2025_0003_supplier_ap_clearance_split.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on

BEGIN;

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set purchase_id 'a065035c-dca2-4079-837a-9c2aeca9332d'
\set supplier_ap_id 'ce35ae9e-de68-4be0-ae84-8c99463a1011'
\set clearance_total 24573440.00
\set goods_ap_target 43404978.40

-- ─── Resolve YAQOOB courier contact + 2031 payable ───────────────────────────
CREATE TEMP TABLE yaqoob_courier_ctx ON COMMIT DROP AS
SELECT c.id AS contact_id, co.account_id AS payable_id, c.name
FROM contacts c
JOIN couriers co ON co.contact_id = c.id AND co.company_id = c.company_id
WHERE c.company_id = :'company_id'::uuid
  AND UPPER(TRIM(c.name)) = 'YAQOOB'
  AND c.type = 'courier'
LIMIT 1;

DO $$
DECLARE
  v_payable UUID;
BEGIN
  SELECT payable_id INTO v_payable FROM yaqoob_courier_ctx LIMIT 1;
  IF v_payable IS NULL THEN
    RAISE EXCEPTION 'YAQOOB courier payable (2031) not found — run repair_yaqoob_courier_din_china.sql first';
  END IF;
END $$;

-- ─── Gate: purchase exists ───────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM purchases WHERE id = 'a065035c-dca2-4079-837a-9c2aeca9332d'::uuid) THEN
    RAISE EXCEPTION 'Purchase PO2025/0003 not found';
  END IF;
END $$;

-- ─── Phase 1: purchase metadata ──────────────────────────────────────────────
UPDATE purchases
SET freight_settlement = 'courier',
    clearance_courier_id = (SELECT contact_id FROM yaqoob_courier_ctx LIMIT 1),
    updated_at = NOW()
WHERE id = :'purchase_id'::uuid
  AND company_id = :'company_id'::uuid
  AND (
    freight_settlement IS DISTINCT FROM 'courier'
    OR clearance_courier_id IS DISTINCT FROM (SELECT contact_id FROM yaqoob_courier_ctx LIMIT 1)
  );

-- ─── Phase 2: canonical purchase JE — split AP credit to courier 2031 ────────
DO $$
DECLARE
  v_purchase UUID := 'a065035c-dca2-4079-837a-9c2aeca9332d';
  v_supplier_ap UUID := 'ce35ae9e-de68-4be0-ae84-8c99463a1011';
  v_courier_payable UUID;
  v_clearance NUMERIC := 24573440.00;
  v_goods_ap NUMERIC := 43404978.40;
  v_je_id UUID;
  v_ap_credit NUMERIC;
  v_inv_debit NUMERIC;
  v_courier_cr_exists NUMERIC;
BEGIN
  SELECT payable_id INTO v_courier_payable FROM yaqoob_courier_ctx LIMIT 1;

  SELECT je.id INTO v_je_id
  FROM journal_entries je
  WHERE je.reference_type = 'purchase'
    AND je.reference_id = v_purchase
    AND je.payment_id IS NULL
    AND COALESCE(je.is_void, false) = false
  ORDER BY je.created_at ASC
  LIMIT 1;

  IF v_je_id IS NULL THEN
    RAISE EXCEPTION 'Canonical purchase JE not found for PO2025/0003';
  END IF;

  SELECT COALESCE(SUM(jel.credit), 0) INTO v_courier_cr_exists
  FROM journal_entry_lines jel
  WHERE jel.journal_entry_id = v_je_id
    AND jel.account_id = v_courier_payable
    AND jel.credit > 0;

  IF v_courier_cr_exists >= v_clearance - 0.01 THEN
    RAISE NOTICE 'Purchase JE already has courier clearance credit — skipping line split';
    RETURN;
  END IF;

  SELECT COALESCE(SUM(jel.credit), 0) INTO v_ap_credit
  FROM journal_entry_lines jel
  WHERE jel.journal_entry_id = v_je_id
    AND jel.account_id = v_supplier_ap
    AND jel.credit > 0;

  SELECT COALESCE(SUM(jel.debit), 0) INTO v_inv_debit
  FROM journal_entry_lines jel
  JOIN accounts a ON a.id = jel.account_id
  WHERE jel.journal_entry_id = v_je_id
    AND jel.debit > 0
    AND a.code = '1200';

  IF v_ap_credit < v_clearance + v_goods_ap - 1 THEN
    RAISE EXCEPTION 'Supplier AP credit % on purchase JE lower than expected % + %',
      v_ap_credit, v_goods_ap, v_clearance;
  END IF;

  -- Single consolidated AP credit line (legacy JE-0001 pattern)
  IF EXISTS (
    SELECT 1 FROM journal_entry_lines
    WHERE journal_entry_id = v_je_id
      AND account_id = v_supplier_ap
      AND credit >= v_clearance + v_goods_ap - 1
  ) THEN
    UPDATE journal_entry_lines
    SET credit = v_goods_ap,
        description = COALESCE(description, '') || ' [goods AP only — clearance to courier]'
    WHERE journal_entry_id = v_je_id
      AND account_id = v_supplier_ap
      AND credit >= v_clearance + v_goods_ap - 1;

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    VALUES (
      v_je_id,
      v_courier_payable,
      'PO2025/0003 clearance — YAQOOB (landed cost split)',
      0,
      v_clearance
    );
  ELSE
  -- Multi-line: reduce AP freight credits, add courier credit
    UPDATE journal_entry_lines
    SET credit = GREATEST(0, credit - v_clearance),
        description = COALESCE(description, '') || ' [clearance moved to courier]'
    WHERE journal_entry_id = v_je_id
      AND account_id = v_supplier_ap
      AND credit > 0
      AND description ILIKE '%freight%';

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
    SELECT v_je_id, v_courier_payable, 'PO2025/0003 clearance — YAQOOB (landed cost split)', 0, v_clearance
    WHERE NOT EXISTS (
      SELECT 1 FROM journal_entry_lines
      WHERE journal_entry_id = v_je_id AND account_id = v_courier_payable AND credit >= v_clearance - 0.01
    );
  END IF;

  UPDATE journal_entries je
  SET total_debit = sub.d,
      total_credit = sub.c,
      updated_at = NOW(),
      description = COALESCE(je.description, '') || ' [clearance AP split]'
  FROM (
    SELECT journal_entry_id,
           ROUND(COALESCE(SUM(debit), 0)::numeric, 2) AS d,
           ROUND(COALESCE(SUM(credit), 0)::numeric, 2) AS c
    FROM journal_entry_lines
    WHERE journal_entry_id = v_je_id
    GROUP BY journal_entry_id
  ) sub
  WHERE je.id = v_je_id;

  IF v_inv_debit < v_goods_ap + v_clearance - 1 THEN
    RAISE WARNING 'Inventory debit % may not match landed cost %', v_inv_debit, v_goods_ap + v_clearance;
  END IF;
END $$;

-- ─── Phase 3: void duplicate clearance accrual (Dr 5100 / Cr 2031) ───────────
UPDATE journal_entries je
SET is_void = true,
    void_reason = 'po2025_0003_clearance_on_purchase_je',
    voided_at = NOW(),
    updated_at = NOW()
WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'::uuid
  AND COALESCE(je.is_void, false) = false
  AND je.reference_type = 'journal'
  AND (
    je.description ILIKE '%YAQOOB clearance accrual%'
    OR je.description ILIKE '%clearance%YAQOOB%'
    OR je.entry_no = 'JE-0311'
  );
  AND EXISTS (
    SELECT 1 FROM journal_entry_lines jel
    JOIN accounts a ON a.id = jel.account_id
    WHERE jel.journal_entry_id = je.id
      AND a.code ~ '^203[0-9]+$'
      AND jel.credit >= 24573440.00 - 0.01
  );

-- ─── Phase 4: recalc supplier due (goods only) ───────────────────────────────
SELECT public.recalc_purchase_payment_totals(:'purchase_id'::uuid);

-- ─── Verify gates ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_due NUMERIC;
  v_ap_bal NUMERIC;
  v_courier_bal NUMERIC;
  v_expected_due NUMERIC := 2061978.40;
  v_purchase UUID := 'a065035c-dca2-4079-837a-9c2aeca9332d';
  v_supplier_ap UUID := 'ce35ae9e-de68-4be0-ae84-8c99463a1011';
BEGIN
  SELECT due_amount INTO v_due FROM purchases WHERE id = v_purchase;

  SELECT balance INTO v_ap_bal FROM accounts WHERE id = v_supplier_ap;

  SELECT a.balance INTO v_courier_bal
  FROM accounts a
  WHERE a.id = (SELECT payable_id FROM yaqoob_courier_ctx LIMIT 1);

  IF ABS(v_due - v_expected_due) > 1 THEN
    RAISE WARNING 'due_amount % expected ~%', v_due, v_expected_due;
  END IF;

  IF ABS(v_ap_bal + v_expected_due) > 100 THEN
    RAISE WARNING 'Supplier AP balance % expected ~-%', v_ap_bal, v_expected_due;
  END IF;

  IF ABS(v_courier_bal) > 1 THEN
    RAISE WARNING 'YAQOOB courier payable balance % expected 0', v_courier_bal;
  END IF;

  RAISE NOTICE 'VERIFY due_amount=%, supplier_AP=%, courier_2031=%', v_due, v_ap_bal, v_courier_bal;
END $$;

-- Refresh cached account balances from journal (supplier AP + YAQOOB 2031)
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

COMMIT;

SELECT '=== POST-REPAIR: Purchase PO2025/0003 ===' AS section;
SELECT po_no, subtotal, shipping_cost, total, paid_amount, due_amount, payment_status,
       freight_settlement, clearance_courier_id
FROM purchases
WHERE id = :'purchase_id'::uuid;

SELECT '=== POST-REPAIR: Supplier AP ===' AS section;
SELECT code, name, balance FROM accounts WHERE id = :'supplier_ap_id'::uuid;

SELECT '=== POST-REPAIR: YAQOOB 2031 ===' AS section;
SELECT a.code, a.name, a.balance
FROM accounts a
JOIN couriers co ON co.account_id = a.id
JOIN contacts c ON c.id = co.contact_id
WHERE c.company_id = :'company_id'::uuid
  AND UPPER(TRIM(c.name)) = 'YAQOOB'
  AND c.type = 'courier';
