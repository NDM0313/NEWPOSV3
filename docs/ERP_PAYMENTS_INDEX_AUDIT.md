# ERP Payments Index Audit

**Date:** 2026-03-13  
**Phase:** Final stabilization — ensure payments table has required indexes without creating duplicates.

---

## Required indexes

| Index | Columns | Purpose |
|-------|---------|--------|
| company_id | payments(company_id) | List/filter by company |
| company_id + payment_date | payments(company_id, payment_date) | Date-range reports and lists |
| company_id + created_at | payments(company_id, created_at) | Recent activity, audit |
| reference_type + reference_id | payments(reference_type, reference_id) | Lookup by sale/purchase/expense/rental |

---

## Verification (run on your DB)

Before or after applying the migration, confirm what exists:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'payments'
ORDER BY indexname;
```

If you see `ERROR: 42P07: relation "idx_payments_..." already exists` when running the migration, that index already exists — the migration uses `CREATE INDEX IF NOT EXISTS` so it will not fail; the statement is skipped.

---

## Migration created

- **migrations/erp_payments_indexes_safe.sql**

All statements use `CREATE INDEX IF NOT EXISTS`. Safe to run multiple times (idempotent). No tables or data are modified except adding indexes.

---

## Rollback

To drop these indexes only (if needed):

```sql
DROP INDEX IF EXISTS idx_payments_reference;
DROP INDEX IF EXISTS idx_payments_company_created_at;
DROP INDEX IF EXISTS idx_payments_company_payment_date;
DROP INDEX IF EXISTS idx_payments_company_id;
```

Do not drop if other migrations or code depend on them.
