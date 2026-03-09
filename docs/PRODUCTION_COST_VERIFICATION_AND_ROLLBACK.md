# Production Cost Fix — Verification Queries & Rollback

**Migration:** `migrations/test/fix_production_cost_calculation.sql` (TEST only)

---

## Verification Queries

Run against your **test** database after applying the migration.

### 1. Production cost populated (no zeros where stages have cost)

```sql
-- Should return 0 rows: no production with stage costs but actual_cost = 0
SELECT p.id, p.production_no, p.actual_cost,
       (SELECT COALESCE(SUM(s.cost), 0) FROM studio_production_stages s WHERE s.production_id = p.id) AS stage_total
FROM studio_productions p
WHERE (p.actual_cost IS NULL OR p.actual_cost = 0)
  AND EXISTS (SELECT 1 FROM studio_production_stages s WHERE s.production_id = p.id AND COALESCE(s.cost, 0) > 0);
```

### 2. actual_cost = stage sum + fabric (spot check)

```sql
SELECT p.id, p.production_no, p.actual_cost,
       (SELECT COALESCE(SUM(s.cost), 0) FROM studio_production_stages s WHERE s.production_id = p.id) AS stage_sum,
       (SELECT COALESCE(SUM(si.unit_price * COALESCE(si.quantity, 1)), 0)
        FROM sales_items si WHERE si.sale_id = p.sale_id AND si.product_id = p.product_id) AS fabric_cost
FROM studio_productions p
WHERE p.sale_id IS NOT NULL
LIMIT 10;
```

### 3. Generate Invoice → one PRODUCTION movement, cost = actual_cost

```sql
SELECT sm.id, sm.reference_id AS production_id, sm.quantity, sm.unit_cost, sm.total_cost, sm.movement_type,
       p.actual_cost AS production_actual_cost
FROM stock_movements sm
JOIN studio_productions p ON p.id = sm.reference_id AND sm.reference_type = 'studio_production'
WHERE sm.movement_type = 'PRODUCTION'
ORDER BY sm.created_at DESC
LIMIT 10;
```

### 4. Sale Final → SALE movements (existing trigger)

```sql
SELECT reference_id AS sale_id, COUNT(*) AS movement_count, SUM(quantity) AS total_qty
FROM stock_movements
WHERE reference_type = 'sale' AND movement_type = 'SALE'
GROUP BY reference_id
ORDER BY reference_id DESC
LIMIT 10;
```

### 5. Idempotency: single PRODUCTION per production, single FG journal per production

```sql
SELECT reference_id, COUNT(*) AS cnt
FROM stock_movements
WHERE reference_type = 'studio_production' AND movement_type = 'PRODUCTION'
GROUP BY reference_id
HAVING COUNT(*) > 1;
-- Expect 0 rows

SELECT reference_id, COUNT(*) AS cnt
FROM journal_entries
WHERE reference_type = 'studio_production' AND description LIKE 'Finished goods%'
GROUP BY reference_id
HAVING COUNT(*) > 1;
-- Expect 0 rows
```

---

## Rollback Instructions (test DB only)

If you need to undo the **trigger and function** (backfill cannot be safely reverted without business logic):

```sql
-- 1) Drop trigger
DROP TRIGGER IF EXISTS trigger_studio_generate_invoice_inventory_journal_test ON studio_productions;

-- 2) Restore previous trigger/function from studio_finished_goods_inventory_and_journal.sql
--    (re-run that migration to get the old trigger without the safety check and without
--     the extra idempotency on journal).

-- 3) Optional: zero out actual_cost again (only if you must restore pre-fix state)
-- UPDATE studio_productions SET actual_cost = 0 WHERE ...;
```

To restore the **previous** `calculate_production_cost` and trigger logic, re-run:

- `migrations/test/calculate_production_cost.sql`
- `migrations/test/studio_finished_goods_inventory_and_journal.sql`

after dropping the trigger above. That will overwrite the function and recreate the trigger without the “block if cost=0 and stage costs exist” check.

---

## Summary

| Check | Expected |
|-------|----------|
| No production with stage costs has actual_cost = 0 | 0 rows from query 1 |
| actual_cost = stage_sum + fabric_cost | Match in query 2 |
| PRODUCTION stock total_cost = production actual_cost | Match in query 3 |
| Sale final creates SALE movements | Query 4 |
| One PRODUCTION movement per production | Query 5 first block empty |
| One FG journal per production | Query 5 second block empty |

---

## Final migration script (for production after verification)

After verification passes on **test**:

1. Copy `migrations/test/fix_production_cost_calculation.sql` to a production migration (e.g. `migrations/fix_production_cost_calculation.sql`).
2. Optionally rename in that file:
   - `studio_on_generate_invoice_inventory_and_journal_test` → `studio_on_generate_invoice_inventory_and_journal`
   - `trigger_studio_generate_invoice_inventory_journal_test` → `trigger_studio_generate_invoice_inventory_journal`
   so production uses the same names without `_test`.
3. Run the migration against production during a maintenance window; then run verification queries 1–5 above.
