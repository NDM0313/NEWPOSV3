-- Void opening_balance_inventory JEs whose stock_movement was purged (DIN CHINA).
-- Idempotent: only voids active JEs with missing movement rows.
--
-- Apply:
--   Get-Content scripts/sql/repair_din_china_orphan_opening_jes.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'

CREATE TEMP TABLE orphan_inv_jes ON COMMIT DROP AS
SELECT je.id, je.entry_no, je.reference_id, COALESCE(je.total_debit, 0) AS amount
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
  AND je.reference_type IN ('opening_balance_inventory', 'opening_balance', 'stock_adjustment')
  AND NOT EXISTS (
    SELECT 1 FROM stock_movements sm
    WHERE sm.id = je.reference_id
      AND sm.company_id = je.company_id
  );

DO $$
DECLARE v_cnt INT; v_amt NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_cnt, v_amt FROM orphan_inv_jes;
  RAISE NOTICE 'Orphan inventory/opening JEs to void: % (total debit ~%)', v_cnt, ROUND(v_amt, 2);
END $$;

UPDATE journal_entries je
SET is_void = true,
    void_reason = COALESCE(je.void_reason, 'din_china_orphan_opening_movement_purge'),
    voided_at = COALESCE(je.voided_at, NOW()),
    updated_at = NOW()
FROM orphan_inv_jes o
WHERE je.id = o.id;

-- Refresh cached balances (debit - credit convention used by accounts.balance)
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
  AND (
    a.code = '1200'
    OR a.id = 'ce35ae9e-de68-4be0-ae84-8c99463a1011'::uuid
    OR a.id IN (
      SELECT co.account_id FROM couriers co
      JOIN contacts c ON c.id = co.contact_id
      WHERE c.company_id = :'company_id'::uuid
        AND UPPER(TRIM(c.name)) = 'YAQOOB'
    )
  );

SELECT '=== post-repair balances ===' AS section;
SELECT a.code, a.name, a.balance
FROM accounts a
WHERE a.company_id = :'company_id'::uuid
  AND (
    a.code = '1200'
    OR a.id = 'ce35ae9e-de68-4be0-ae84-8c99463a1011'::uuid
    OR a.id IN (
      SELECT co.account_id FROM couriers co
      JOIN contacts c ON c.id = co.contact_id
      WHERE c.company_id = :'company_id'::uuid
        AND UPPER(TRIM(c.name)) = 'YAQOOB'
    )
  )
ORDER BY a.code;

SELECT recalc_purchase_payment_totals('a065035c-dca2-4079-837a-9c2aeca9332d'::uuid);

SELECT po_no, due_amount, paid_amount, freight_settlement
FROM purchases
WHERE id = 'a065035c-dca2-4079-837a-9c2aeca9332d'::uuid;

COMMIT;
