-- ============================================================================
-- Set create_business_transaction owner to current_user so migration 59 can
-- replace the function (same role that runs migrations).
-- ============================================================================

DO $$
DECLARE
  r RECORD;
  q TEXT;
BEGIN
  FOR r IN
    SELECT p.oid, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_business_transaction'
  LOOP
    q := format('ALTER FUNCTION public.create_business_transaction(%s) OWNER TO current_user', r.args);
    BEGIN
      EXECUTE q;
      RAISE NOTICE '58c: Altered owner for create_business_transaction(%)', r.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '58c: Could not alter create_business_transaction(%) - %', r.args, SQLERRM;
    END;
  END LOOP;
END $$;
