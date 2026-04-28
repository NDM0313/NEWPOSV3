-- Preview global sequence drift (current year) for PAYMENT/RENTAL/SALE/PURCHASE/EXPENSE/STUDIO/JOURNAL.
-- Safe read-only query for self-hosted Supabase Postgres.

WITH seq AS (
  SELECT
    company_id,
    branch_id,
    UPPER(document_type) AS document_type,
    year,
    COALESCE(last_number, 0) AS last_number
  FROM public.erp_document_sequences
  WHERE year = EXTRACT(YEAR FROM now())::int
    AND UPPER(document_type) IN ('PAYMENT', 'RENTAL', 'SALE', 'PURCHASE', 'EXPENSE', 'STUDIO', 'JOURNAL')
),
obs AS (
  SELECT company_id, 'PAYMENT'::text AS document_type,
         COALESCE(MAX(CAST(SUBSTRING(reference_number FROM '([0-9]+)$') AS BIGINT)), 0) AS observed_max
  FROM public.payments
  WHERE reference_number ~ '([0-9]+)$'
    AND reference_number NOT ILIKE 'PAY-BACKFILL-%'
    AND LENGTH(SUBSTRING(reference_number FROM '([0-9]+)$')) <= 9
  GROUP BY company_id
  UNION ALL
  SELECT company_id, 'RENTAL',
         COALESCE(MAX(CAST(SUBSTRING(booking_no FROM '([0-9]+)$') AS BIGINT)), 0)
  FROM public.rentals
  WHERE booking_no ~ '([0-9]+)$'
    AND LENGTH(SUBSTRING(booking_no FROM '([0-9]+)$')) <= 9
  GROUP BY company_id
  UNION ALL
  SELECT company_id, 'SALE',
         COALESCE(MAX(CAST(SUBSTRING(invoice_no FROM '([0-9]+)$') AS BIGINT)), 0)
  FROM public.sales
  WHERE invoice_no ~ '([0-9]+)$'
    AND LENGTH(SUBSTRING(invoice_no FROM '([0-9]+)$')) <= 9
  GROUP BY company_id
  UNION ALL
  SELECT company_id, 'PURCHASE',
         COALESCE(MAX(CAST(SUBSTRING(po_no FROM '([0-9]+)$') AS BIGINT)), 0)
  FROM public.purchases
  WHERE po_no ~ '([0-9]+)$'
    AND LENGTH(SUBSTRING(po_no FROM '([0-9]+)$')) <= 9
  GROUP BY company_id
  UNION ALL
  SELECT company_id, 'EXPENSE',
         COALESCE(MAX(CAST(SUBSTRING(expense_no FROM '([0-9]+)$') AS BIGINT)), 0)
  FROM public.expenses
  WHERE expense_no ~ '([0-9]+)$'
    AND LENGTH(SUBSTRING(expense_no FROM '([0-9]+)$')) <= 9
  GROUP BY company_id
  UNION ALL
  SELECT company_id, 'JOURNAL',
         COALESCE(MAX(CAST(SUBSTRING(entry_no FROM '([0-9]+)$') AS BIGINT)), 0)
  FROM public.journal_entries
  WHERE entry_no ~ '([0-9]+)$'
    AND LENGTH(SUBSTRING(entry_no FROM '([0-9]+)$')) <= 9
  GROUP BY company_id
  UNION ALL
  SELECT company_id, 'STUDIO',
         COALESCE(MAX(CAST(SUBSTRING(production_no FROM '([0-9]+)$') AS BIGINT)), 0)
  FROM public.studio_productions
  WHERE production_no ~ '([0-9]+)$'
    AND LENGTH(SUBSTRING(production_no FROM '([0-9]+)$')) <= 9
  GROUP BY company_id
)
SELECT
  s.company_id,
  s.branch_id,
  s.document_type,
  s.last_number,
  COALESCE(o.observed_max, 0)::int AS observed_max,
  (s.last_number < COALESCE(o.observed_max, 0)::int) AS out_of_sync
FROM seq s
LEFT JOIN obs o
  ON o.company_id = s.company_id
 AND o.document_type = s.document_type
ORDER BY out_of_sync DESC, s.company_id, s.document_type, s.branch_id;
