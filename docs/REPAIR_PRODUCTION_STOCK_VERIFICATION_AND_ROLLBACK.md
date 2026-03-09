# Repair Missing Production Stock Movements — Verification & Rollback

**Test script:** `migrations/test/repair_missing_production_stock_movements.sql`  
**Production script:** `migrations/repair_missing_production_stock_movements.sql` (same logic; run after test verification)

---

## Verification query

Run **after** the repair script. Every production with a generated product must have a PRODUCTION stock movement (movement NOT NULL).

```sql
SELECT p.id, p.generated_product_id, p.actual_cost, m.id AS movement
FROM studio_productions p
LEFT JOIN stock_movements m
  ON m.reference_id = p.id AND m.reference_type = 'studio_production' AND m.movement_type = 'PRODUCTION'
WHERE p.generated_product_id IS NOT NULL;
-- After repair: every row must have movement NOT NULL.
```

```sql
-- 2) List all PRODUCTION movements (spot check)
SELECT id, company_id, branch_id, product_id, quantity, unit_cost, total_cost,
       reference_id AS production_id, notes, created_at
FROM stock_movements
WHERE movement_type = 'PRODUCTION'
ORDER BY created_at DESC;
```

```sql
-- 3) Missing productions (should be 0 after repair)
SELECT p.id, p.production_no
FROM studio_productions p
WHERE p.generated_product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM stock_movements sm
    WHERE sm.reference_type = 'studio_production' AND sm.reference_id = p.id
      AND sm.movement_type = 'PRODUCTION'
  );
-- Expected: 0 rows.
```

---

## Rollback (test or production)

Only if you must **remove** the backfilled movements (e.g. wrong run). Re-running the repair is idempotent and will not create duplicates.

```sql
DELETE FROM stock_movements
WHERE movement_type = 'PRODUCTION'
  AND reference_type = 'studio_production'
  AND notes LIKE '%(backfill)%';
```

To remove **all** PRODUCTION movements for a given production (use with care):

```sql
-- DELETE FROM stock_movements
-- WHERE reference_type = 'studio_production' AND reference_id = '<production_id>' AND movement_type = 'PRODUCTION';
```

---

## Production-safe migration

After verification on **test**:

1. Run `migrations/repair_missing_production_stock_movements.sql` on production (same INSERT...SELECT as test).
2. Run verification queries 1–3 above on production.
3. Keep rollback SQL documented for emergencies.
