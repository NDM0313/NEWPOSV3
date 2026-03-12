-- ============================================================================
-- Fix: Allow migration 59 to replace create_business_transaction.
-- Run as postgres/superuser (e.g. DATABASE_ADMIN_URL). Only the owner or
-- a superuser can change function owner.
-- ============================================================================

DO $$
BEGIN
  -- 12-param version (from migration 58)
  BEGIN
    ALTER FUNCTION create_business_transaction(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
      OWNER TO postgres;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  -- 9-param version (from migration 53/58)
  BEGIN
    ALTER FUNCTION create_business_transaction(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DATE, TEXT, TEXT)
      OWNER TO postgres;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  -- 5-param version (legacy)
  BEGIN
    ALTER FUNCTION create_business_transaction(TEXT, TEXT, TEXT, TEXT, UUID)
      OWNER TO postgres;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
