-- DIN CHINA — purge all stock_movements with movement_type = adjustment
-- Voids linked stock_adjustment + opening_balance JEs, rebuilds inventory_balance, refreshes 1200.
--
-- BACKUP (mandatory):
--   ssh dincouture-vps "docker exec supabase-db pg_dump -U postgres -d postgres \
--     --table=stock_movements --table=inventory_balance \
--     --table=journal_entries --table=journal_entry_lines \
--     > /root/backups/din-china-adj-purge-$(date +%Y%m%d).sql"
--
-- Dry-run diag first:
--   Get-Content scripts/sql/diag_din_china_stock_adjustments.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"
--
-- Apply:
--   Get-Content scripts/sql/cleanup_din_china_stock_adjustments.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on

BEGIN;

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'

-- Optional: keep 2–3 movement UUIDs for manual cleanup later
-- Example: \set exclude_ids '''{uuid1,uuid2}'''
\set exclude_ids '{}'

-- ─── Phase 1: snapshot adjustment rows to purge ─────────────────────────────
CREATE TEMP TABLE adj_to_purge ON COMMIT DROP AS
SELECT sm.id, sm.product_id, sm.quantity, sm.reference_type
FROM stock_movements sm
WHERE sm.company_id = :'company_id'::uuid
  AND LOWER(TRIM(COALESCE(sm.movement_type, ''))) = 'adjustment'
  AND NOT (sm.id = ANY(:'exclude_ids'::uuid[]));

DO $$
DECLARE
  v_cnt INT;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM adj_to_purge;
  IF v_cnt = 0 THEN
    RAISE NOTICE 'No adjustment movements to purge (check exclude_ids or already clean)';
  ELSE
    RAISE NOTICE 'Purging % adjustment movement(s)', v_cnt;
  END IF;
END $$;

-- ─── Phase 2: void linked journal entries ───────────────────────────────────
UPDATE journal_entries je
SET is_void = true,
    void_reason = COALESCE(je.void_reason, 'din_china_stock_adjustment_purge'),
    voided_at = COALESCE(je.voided_at, NOW()),
    updated_at = NOW()
WHERE COALESCE(je.is_void, false) = false
  AND je.company_id = :'company_id'::uuid
  AND je.reference_type IN ('stock_adjustment', 'opening_balance')
  AND je.reference_id IN (SELECT id FROM adj_to_purge);

-- ─── Phase 3: delete adjustment movements ─────────────────────────────────
DELETE FROM stock_movements sm
WHERE sm.id IN (SELECT id FROM adj_to_purge);

-- ─── Phase 4: rebuild inventory_balance from remaining movements ────────────
DELETE FROM inventory_balance
WHERE company_id = :'company_id'::uuid;

INSERT INTO inventory_balance (company_id, product_id, branch_id, qty, boxes, pieces, unit, updated_at)
SELECT
  sm.company_id,
  sm.product_id,
  sm.branch_id,
  ROUND(COALESCE(SUM(sm.quantity), 0)::numeric, 4),
  ROUND(COALESCE(SUM(sm.box_change), 0)::numeric, 4),
  ROUND(COALESCE(SUM(sm.piece_change), 0)::numeric, 4),
  MAX(sm.unit),
  NOW()
FROM stock_movements sm
WHERE sm.company_id = :'company_id'::uuid
GROUP BY sm.company_id, sm.product_id, sm.branch_id;

-- ─── Phase 5: refresh cached 1200 balance from journal ──────────────────────
UPDATE accounts a
SET balance = sub.journal_bal,
    updated_at = NOW()
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
  AND a.company_id = :'company_id'::uuid
  AND a.code = '1200';

-- ─── Phase 6: verify gates ──────────────────────────────────────────────────
DO $$
DECLARE
  v_remain_adj INT;
  v_purged INT;
  v_sku0018 NUMERIC;
  v_neg_cnt INT;
  v_inv1200 NUMERIC;
  v_company UUID := '30bd8592-3384-4f34-899a-f3907e336485';
BEGIN
  SELECT COUNT(*) INTO v_purged FROM adj_to_purge;

  SELECT COUNT(*) INTO v_remain_adj
  FROM stock_movements sm
  WHERE sm.company_id = v_company
    AND LOWER(TRIM(COALESCE(sm.movement_type, ''))) = 'adjustment';

  SELECT ROUND(COALESCE(SUM(sm.quantity), 0)::numeric, 4) INTO v_sku0018
  FROM stock_movements sm
  JOIN products p ON p.id = sm.product_id
  WHERE sm.company_id = v_company
    AND p.sku = '0018';

  SELECT COUNT(*) INTO v_neg_cnt
  FROM (
    SELECT sm.product_id, sm.variation_id
    FROM stock_movements sm
    WHERE sm.company_id = v_company
    GROUP BY sm.product_id, sm.variation_id
    HAVING COALESCE(SUM(sm.quantity), 0) < -0.0001
  ) neg;

  SELECT balance INTO v_inv1200
  FROM accounts
  WHERE company_id = v_company AND code = '1200'
  LIMIT 1;

  RAISE NOTICE 'VERIFY purged=%, remain_adj=%, sku0018_stock=%, negative_stock_keys=%, inv1200_balance=%',
    v_purged, v_remain_adj, v_sku0018, v_neg_cnt, v_inv1200;
END $$;

COMMIT;

SELECT '=== POST-PURGE: adjustment count ===' AS section;
SELECT COUNT(*) AS remaining_adjustments
FROM stock_movements sm
WHERE sm.company_id = :'company_id'::uuid
  AND LOWER(TRIM(COALESCE(sm.movement_type, ''))) = 'adjustment';

SELECT '=== POST-PURGE: SKU 0018 stock ===' AS section;
SELECT p.sku, p.name, ROUND(COALESCE(SUM(sm.quantity), 0)::numeric, 4) AS stock_all
FROM stock_movements sm
JOIN products p ON p.id = sm.product_id
WHERE sm.company_id = :'company_id'::uuid
  AND p.sku = '0018'
GROUP BY p.sku, p.name, sm.product_id, sm.variation_id;

SELECT '=== POST-PURGE: negative stock (top 10) ===' AS section;
SELECT p.sku, p.name, ROUND(COALESCE(SUM(sm.quantity), 0)::numeric, 4) AS stock_all
FROM stock_movements sm
JOIN products p ON p.id = sm.product_id
WHERE sm.company_id = :'company_id'::uuid
GROUP BY p.sku, p.name, sm.product_id, sm.variation_id
HAVING COALESCE(SUM(sm.quantity), 0) < -0.0001
ORDER BY stock_all ASC
LIMIT 10;

SELECT '=== POST-PURGE: Inventory 1200 ===' AS section;
SELECT code, name, balance FROM accounts
WHERE company_id = :'company_id'::uuid AND code = '1200';
