-- Expose whether sales/purchases have conversion columns (for client-side query planning without 400 spam).
-- SECURITY DEFINER: reads information_schema only; no row data.

CREATE OR REPLACE FUNCTION public.app_document_conversion_schema()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'sales_converted', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'converted'
    ),
    'purchases_converted', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'converted'
    )
  );
$$;

COMMENT ON FUNCTION public.app_document_conversion_schema() IS 'JSON flags: sales_converted / purchases_converted column presence for ERP list queries.';

GRANT EXECUTE ON FUNCTION public.app_document_conversion_schema() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_document_conversion_schema() TO service_role;
-- anon: optional if unauthenticated health pages need it; keep off by default
