-- DIN CHINA — HAMID IK RMB 1205 supplier settlement (zero wallet balance)
--
-- Business flow:
--   1) HAMID IK paid supplier (MR DIN MOHAMMAD) RMB 22290×41.35 = Rs 921,691 from agent wallet
--   2) Company reimbursed HAMID via JE-0234 (FHD→WALI) + JE-0002 (WALI→1205)
--   3) Net 1205 HAMID IK RMB must be 0 (not 921,691 Dr)
--
-- This script posts the missing supplier payment leg:
--   Dr AP (MR DIN MOHAMMAD) / Cr 1205 HAMID IK RMB — PO2025/0003
--
-- Idempotent: skips if a purchase payment from 1205 for 921691 already exists.
--
-- Apply:
--   Get-Content scripts/sql/repair_hamid_1205_supplier_settlement_din_china.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set branch_id '92f4184e-ee9b-4b6c-8e76-10ee1d166f55'
\set account_1205 'cbd6a16a-5521-43d5-ba33-01994d47c481'
\set purchase_id 'a065035c-dca2-4079-837a-9c2aeca9332d'
\set supplier_contact_id '36fe85d7-95cf-49ad-8922-cabe5f3596cc'
\set ap_account_id 'ce35ae9e-de68-4be0-ae84-8c99463a1011'
\set amount '921691.00'

-- ─── Phase 1: post supplier payment from HAMID IK RMB wallet ───────────────
DO $$
DECLARE
  v_company UUID := '30bd8592-3384-4f34-899a-f3907e336485';
  v_branch UUID := '92f4184e-ee9b-4b6c-8e76-10ee1d166f55';
  v_wallet UUID := 'cbd6a16a-5521-43d5-ba33-01994d47c481';
  v_purchase UUID := 'a065035c-dca2-4079-837a-9c2aeca9332d';
  v_supplier UUID := '36fe85d7-95cf-49ad-8922-cabe5f3596cc';
  v_existing UUID;
  v_result JSON;
BEGIN
  SELECT p.id INTO v_existing
  FROM payments p
  WHERE p.company_id = v_company
    AND p.reference_type = 'purchase'
    AND p.reference_id = v_purchase
    AND p.payment_account_id = v_wallet
    AND ABS(p.amount - 921691) < 1
    AND p.voided_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE NOTICE 'HAMID 1205 supplier payment already exists: %', v_existing;
    RETURN;
  END IF;

  v_result := public.record_payment_with_accounting(
    v_company,
    v_branch,
    'paid'::payment_type,
    'purchase',
    v_purchase,
    921691.00,
    'other'::payment_method_enum,
    DATE '2025-12-02',
    v_wallet,
    NULL,
    'Supplier payment via HAMID IK RMB wallet — PO2025/0003 (RMB 22290×41.35)',
    NULL,
    NULL
  );

  RAISE NOTICE 'record_payment_with_accounting result: %', v_result;
END $$;

-- ─── Phase 2: recalc purchase totals ────────────────────────────────────────
SELECT public.recalc_purchase_payment_totals(:'purchase_id'::uuid);

-- ─── Phase 3: refresh cached balances ─────────────────────────────────────
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
    :'ap_account_id'::uuid
  );

-- ─── Phase 4: verify gates ────────────────────────────────────────────────
SELECT 'gate_1205_zero' AS gate,
  ROUND(a.balance::numeric, 2) AS balance_1205,
  CASE WHEN ABS(a.balance) < 1 THEN 'PASS' ELSE 'FAIL' END AS status
FROM accounts a
WHERE a.id = :'account_1205'::uuid;

SELECT 'gate_1205_net_journal' AS gate,
  ROUND(COALESCE(SUM(jel.debit - jel.credit), 0)::numeric, 2) AS net,
  CASE WHEN ABS(COALESCE(SUM(jel.debit - jel.credit), 0)) < 1 THEN 'PASS' ELSE 'FAIL' END AS status
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.account_id = :'account_1205'::uuid
  AND COALESCE(je.is_void, false) = false;

SELECT 'gate_po_due' AS gate,
  p.paid_amount,
  p.due_amount,
  CASE WHEN ABS(p.due_amount - 1140287.40) < 2 THEN 'PASS' ELSE 'FAIL' END AS status
FROM purchases p
WHERE p.id = :'purchase_id'::uuid;

SELECT 'gate_ap_balance' AS gate,
  ROUND(a.balance::numeric, 2) AS ap_balance,
  CASE WHEN ABS(a.balance + 1140287.40) < 2 THEN 'PASS' ELSE 'FAIL' END AS status
FROM accounts a
WHERE a.id = :'ap_account_id'::uuid;

SELECT 'gate_supplier_payment_exists' AS gate,
  COUNT(*) AS payment_count,
  CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END AS status
FROM payments p
WHERE p.company_id = :'company_id'::uuid
  AND p.reference_type = 'purchase'
  AND p.reference_id = :'purchase_id'::uuid
  AND p.payment_account_id = :'account_1205'::uuid
  AND ABS(p.amount - 921691) < 1
  AND p.voided_at IS NULL;

COMMIT;
