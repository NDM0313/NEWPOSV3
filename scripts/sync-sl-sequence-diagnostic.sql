-- SELECT-only diagnostic: compare SL sequence counter vs max sales.invoice_no
-- Run before/after migrations/20260614150000_sync_sl_global_sequence_from_sales.sql

SELECT
  c.id AS company_id,
  c.name AS company_name,
  dsg.current_number AS sequence_current_number,
  sub.max_sl_suffix,
  sub.max_sl_invoice,
  CASE
    WHEN dsg.current_number IS NULL THEN 'missing SL row in document_sequences_global'
    WHEN sub.max_sl_suffix IS NULL THEN 'no SL invoices in sales'
    WHEN dsg.current_number < sub.max_sl_suffix THEN 'OUT OF SYNC — next RPC may reuse a low number'
    WHEN dsg.current_number = sub.max_sl_suffix THEN 'OK — next get_next_document_number_global(SL) → SL-' || LPAD((sub.max_sl_suffix + 1)::TEXT, 4, '0')
    ELSE 'sequence ahead of max invoice (gaps OK)'
  END AS status
FROM public.companies c
LEFT JOIN public.document_sequences_global dsg
  ON dsg.company_id = c.id AND dsg.document_type = 'SL'
LEFT JOIN (
  SELECT
    company_id,
    MAX(
      (REGEXP_REPLACE(invoice_no, '^SL-', ''))::INTEGER
    ) AS max_sl_suffix,
    MAX(invoice_no) AS max_sl_invoice
  FROM public.sales
  WHERE invoice_no ~ '^SL-[0-9]+$'
  GROUP BY company_id
) sub ON sub.company_id = c.id
ORDER BY c.name;

-- Non-standard invoice formats (e.g. HQ-SL-0001) — excluded from SL sequence sync
SELECT company_id, invoice_no, invoice_date, created_at
FROM public.sales
WHERE invoice_no IS NOT NULL
  AND invoice_no !~ '^SL-[0-9]+$'
  AND invoice_no ~* 'SL'
ORDER BY created_at DESC
LIMIT 20;

-- Recent canonical SL invoices (verify latest number)
SELECT company_id, invoice_no, invoice_date, created_at, created_by, salesman_id, branch_id
FROM public.sales
WHERE invoice_no ~ '^SL-[0-9]+$'
ORDER BY (REGEXP_REPLACE(invoice_no, '^SL-', ''))::INTEGER DESC
LIMIT 20;
