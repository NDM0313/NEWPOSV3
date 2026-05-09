-- Read-only audit: document uniqueness + drift helpers for ops review.
-- Does not modify schema.

-- 1) Unique indexes involving common document columns (adjust schema if needed)
SELECT
  i.relname AS index_name,
  pg_get_indexdef(i.oid) AS index_def
FROM pg_class t
JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
WHERE t.relname IN ('rentals', 'sales', 'purchases', 'expenses', 'studio_productions', 'payments')
  AND ix.indisunique
ORDER BY t.relname, i.relname;

-- 2) Expect company-scoped doc numbers (examples — verify constraint text includes company_id)
-- rentals: prefer UNIQUE (company_id, booking_no) over bare UNIQUE (booking_no)
