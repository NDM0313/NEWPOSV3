-- Apply global sequence alignment (current year).
-- Idempotent: only bumps last_number up to observed max when sequence is behind.
-- Covers PAYMENT/RENTAL/SALE/PURCHASE/EXPENSE/STUDIO/JOURNAL across all companies + branch rows.

BEGIN;

-- PAYMENT
UPDATE public.erp_document_sequences s
SET
  last_number = GREATEST(
    COALESCE(s.last_number, 0),
    COALESCE((
      SELECT MAX(CAST(SUBSTRING(p.reference_number FROM '([0-9]+)$') AS BIGINT))
      FROM public.payments p
      WHERE p.company_id = s.company_id
        AND p.reference_number ~ '([0-9]+)$'
        AND p.reference_number NOT ILIKE 'PAY-BACKFILL-%'
        AND LENGTH(SUBSTRING(p.reference_number FROM '([0-9]+)$')) <= 9
    ), 0)::int
  ),
  updated_at = now()
WHERE UPPER(s.document_type) = 'PAYMENT'
  AND s.year = EXTRACT(YEAR FROM now())::int;

-- RENTAL
UPDATE public.erp_document_sequences s
SET
  last_number = GREATEST(
    COALESCE(s.last_number, 0),
    COALESCE((
      SELECT MAX(CAST(SUBSTRING(r.booking_no FROM '([0-9]+)$') AS BIGINT))
      FROM public.rentals r
      WHERE r.company_id = s.company_id
        AND r.booking_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(r.booking_no FROM '([0-9]+)$')) <= 9
    ), 0)::int
  ),
  updated_at = now()
WHERE UPPER(s.document_type) = 'RENTAL'
  AND s.year = EXTRACT(YEAR FROM now())::int;

-- SALE
UPDATE public.erp_document_sequences s
SET
  last_number = GREATEST(
    COALESCE(s.last_number, 0),
    COALESCE((
      SELECT MAX(CAST(SUBSTRING(x.invoice_no FROM '([0-9]+)$') AS BIGINT))
      FROM public.sales x
      WHERE x.company_id = s.company_id
        AND x.invoice_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(x.invoice_no FROM '([0-9]+)$')) <= 9
    ), 0)::int
  ),
  updated_at = now()
WHERE UPPER(s.document_type) = 'SALE'
  AND s.year = EXTRACT(YEAR FROM now())::int;

-- PURCHASE
UPDATE public.erp_document_sequences s
SET
  last_number = GREATEST(
    COALESCE(s.last_number, 0),
    COALESCE((
      SELECT MAX(CAST(SUBSTRING(x.po_no FROM '([0-9]+)$') AS BIGINT))
      FROM public.purchases x
      WHERE x.company_id = s.company_id
        AND x.po_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(x.po_no FROM '([0-9]+)$')) <= 9
    ), 0)::int
  ),
  updated_at = now()
WHERE UPPER(s.document_type) = 'PURCHASE'
  AND s.year = EXTRACT(YEAR FROM now())::int;

-- EXPENSE
DO $$
BEGIN
  UPDATE public.erp_document_sequences s
  SET
    last_number = GREATEST(
      COALESCE(s.last_number, 0),
      COALESCE((
        SELECT MAX(CAST(SUBSTRING(x.expense_no FROM '([0-9]+)$') AS BIGINT))
        FROM public.expenses x
        WHERE x.company_id = s.company_id
          AND x.expense_no ~ '([0-9]+)$'
          AND LENGTH(SUBSTRING(x.expense_no FROM '([0-9]+)$')) <= 9
      ), 0)::int
    ),
    updated_at = now()
  WHERE UPPER(s.document_type) = 'EXPENSE'
    AND s.year = EXTRACT(YEAR FROM now())::int;
EXCEPTION WHEN undefined_table OR undefined_column THEN
  NULL;
END $$;

-- STUDIO
DO $$
BEGIN
  UPDATE public.erp_document_sequences s
  SET
    last_number = GREATEST(
      COALESCE(s.last_number, 0),
      COALESCE((
        SELECT MAX(CAST(SUBSTRING(x.production_no FROM '([0-9]+)$') AS BIGINT))
        FROM public.studio_productions x
        WHERE x.company_id = s.company_id
          AND x.production_no ~ '([0-9]+)$'
          AND LENGTH(SUBSTRING(x.production_no FROM '([0-9]+)$')) <= 9
      ), 0)::int
    ),
    updated_at = now()
  WHERE UPPER(s.document_type) = 'STUDIO'
    AND s.year = EXTRACT(YEAR FROM now())::int;
EXCEPTION WHEN undefined_table OR undefined_column THEN
  NULL;
END $$;

-- JOURNAL
UPDATE public.erp_document_sequences s
SET
  last_number = GREATEST(
    COALESCE(s.last_number, 0),
    COALESCE((
      SELECT MAX(CAST(SUBSTRING(j.entry_no FROM '([0-9]+)$') AS BIGINT))
      FROM public.journal_entries j
      WHERE j.company_id = s.company_id
        AND j.entry_no ~ '([0-9]+)$'
        AND LENGTH(SUBSTRING(j.entry_no FROM '([0-9]+)$')) <= 9
    ), 0)::int
  ),
  prefix = CASE WHEN COALESCE(NULLIF(TRIM(s.prefix), ''), 'JE') ILIKE 'JV%' THEN 'JE' ELSE COALESCE(NULLIF(TRIM(s.prefix), ''), 'JE') END,
  updated_at = now()
WHERE UPPER(s.document_type) = 'JOURNAL'
  AND s.year = EXTRACT(YEAR FROM now())::int;

-- Ensure sentinel JOURNAL rows exist for companies already in journal_entries.
INSERT INTO public.erp_document_sequences (
  company_id, branch_id, document_type, prefix, year, last_number, padding, year_reset, branch_based, updated_at
)
SELECT
  j.company_id,
  '00000000-0000-0000-0000-000000000000'::uuid AS branch_id,
  'JOURNAL' AS document_type,
  'JE' AS prefix,
  EXTRACT(YEAR FROM now())::int AS year,
  COALESCE(MAX(CAST(SUBSTRING(j.entry_no FROM '([0-9]+)$') AS BIGINT)), 0)::int AS last_number,
  4 AS padding,
  true AS year_reset,
  false AS branch_based,
  now() AS updated_at
FROM public.journal_entries j
GROUP BY j.company_id
ON CONFLICT (company_id, branch_id, document_type, year)
DO UPDATE
SET
  last_number = GREATEST(public.erp_document_sequences.last_number, EXCLUDED.last_number),
  prefix = 'JE',
  updated_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
