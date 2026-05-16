-- Verify create_sale_document_header enum casts (read-only checks)
SELECT EXISTS (
  SELECT 1 FROM pg_proc WHERE proname = 'create_sale_document_header'
) AS function_exists;

SELECT (
  pg_get_functiondef('public.create_sale_document_header(uuid,uuid,boolean,jsonb,uuid)'::regprocedure)
  LIKE '%::public.sale_type%'
) AS has_sale_type_cast;

SELECT (
  pg_get_functiondef('public.create_sale_document_header(uuid,uuid,boolean,jsonb,uuid)'::regprocedure)
  LIKE '%::public.sale_status%'
) AS has_sale_status_cast;

SELECT (
  pg_get_functiondef('public.create_sale_document_header(uuid,uuid,boolean,jsonb,uuid)'::regprocedure)
  LIKE '%::public.payment_status%'
) AS has_payment_status_cast;
