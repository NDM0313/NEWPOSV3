-- Sync document_sequences_global counters with max observed document numbers.
-- Fixes cases where sales were imported or numbered outside get_next_document_number_global
-- (e.g. SL counter at 3 while max invoice_no is SL-0016 → next should be SL-0017).

-- SL (final sale invoices)
INSERT INTO public.document_sequences_global (company_id, document_type, current_number, updated_at)
SELECT s.company_id, 'SL', 0, NOW()
FROM (
  SELECT DISTINCT company_id FROM public.sales WHERE invoice_no ~ '^SL-[0-9]+$'
) s
ON CONFLICT (company_id, document_type) DO NOTHING;

UPDATE public.document_sequences_global dsg
SET current_number = GREATEST(
      dsg.current_number,
      COALESCE(sub.max_suffix, 0)
    ),
    updated_at = NOW()
FROM (
  SELECT
    company_id,
    MAX(
      NULLIF(REGEXP_REPLACE(invoice_no, '^SL-', ''), '')::INTEGER
    ) AS max_suffix
  FROM public.sales
  WHERE invoice_no ~ '^SL-[0-9]+$'
  GROUP BY company_id
) sub
WHERE dsg.company_id = sub.company_id
  AND dsg.document_type = 'SL';

-- PS (POS invoices)
INSERT INTO public.document_sequences_global (company_id, document_type, current_number, updated_at)
SELECT s.company_id, 'PS', 0, NOW()
FROM (
  SELECT DISTINCT company_id FROM public.sales WHERE invoice_no ~ '^PS-[0-9]+$'
) s
ON CONFLICT (company_id, document_type) DO NOTHING;

UPDATE public.document_sequences_global dsg
SET current_number = GREATEST(
      dsg.current_number,
      COALESCE(sub.max_suffix, 0)
    ),
    updated_at = NOW()
FROM (
  SELECT
    company_id,
    MAX(
      NULLIF(REGEXP_REPLACE(invoice_no, '^PS-', ''), '')::INTEGER
    ) AS max_suffix
  FROM public.sales
  WHERE invoice_no ~ '^PS-[0-9]+$'
  GROUP BY company_id
) sub
WHERE dsg.company_id = sub.company_id
  AND dsg.document_type = 'PS';

-- STD (studio order numbers on sales.order_no)
INSERT INTO public.document_sequences_global (company_id, document_type, current_number, updated_at)
SELECT s.company_id, 'STD', 0, NOW()
FROM (
  SELECT DISTINCT company_id FROM public.sales WHERE order_no ~ '^STD-[0-9]+$'
) s
ON CONFLICT (company_id, document_type) DO NOTHING;

UPDATE public.document_sequences_global dsg
SET current_number = GREATEST(
      dsg.current_number,
      COALESCE(sub.max_suffix, 0)
    ),
    updated_at = NOW()
FROM (
  SELECT
    company_id,
    MAX(
      NULLIF(REGEXP_REPLACE(order_no, '^STD-', ''), '')::INTEGER
    ) AS max_suffix
  FROM public.sales
  WHERE order_no ~ '^STD-[0-9]+$'
  GROUP BY company_id
) sub
WHERE dsg.company_id = sub.company_id
  AND dsg.document_type = 'STD';

COMMENT ON TABLE public.document_sequences_global IS
  'Global document numbering per company. Resynced from sales max invoice_no by migration 20260614150000.';
