-- ============================================================================
-- VALIDATE MIGRATION STATE
-- Run after applying migrations. Prints PASS or FAIL.
-- Checks: FK targets, RLS policies, walk-in uniqueness, document_sequences_global,
--        created_by consistency.
-- Usage: psql "$DATABASE_URL" -f scripts/validate-migration-state.sql
--        or paste in Supabase SQL Editor and run.
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS _validate_result (result text, details text);

DO $$
DECLARE
  errs text[] := '{}';
  r record;
  n bigint;
BEGIN
  -- -------------------------------------------------------------------------
  -- 1. FK: public.users.auth_user_id -> auth.users(id) (or column exists)
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id'
  ) THEN
    errs := errs || 'users.auth_user_id column missing';
  END IF;

  -- -------------------------------------------------------------------------
  -- 2. RLS: document_sequences_global table and policies
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_sequences_global') THEN
    errs := errs || 'document_sequences_global table missing';
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_sequences_global' AND policyname = 'document_sequences_global_select'
    ) THEN
      errs := errs || 'document_sequences_global RLS policy document_sequences_global_select missing';
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- 3. Walk-in uniqueness: one per company (constraint or unique index)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contacts') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'contacts'
        AND indexname = 'unique_walkin_per_company_strict'
    ) THEN
      -- Alternative index name some migrations might use
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'contacts'
          AND indexdef LIKE '%walking_customer%'
      ) THEN
        errs := errs || 'contacts: unique walk-in per company index not found';
      END IF;
    END IF;
    -- Walk-in count per company should be <= 1 (data check)
    FOR r IN
      SELECT company_id, COUNT(*) AS cnt
      FROM public.contacts
      WHERE system_type = 'walking_customer'
      GROUP BY company_id
      HAVING COUNT(*) > 1
    LOOP
      errs := errs || format('contacts: company %s has %s walk-ins (expected 1)', r.company_id, r.cnt);
    END LOOP;
  ELSE
    errs := errs || 'contacts table missing';
  END IF;

  -- -------------------------------------------------------------------------
  -- 4. RLS: sales table has policies (global permission or role-based)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales') THEN
    SELECT COUNT(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sales';
    IF n = 0 THEN
      errs := errs || 'sales: no RLS policies';
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- 5. created_by consistency: sales has created_by or auth_user_id
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sales'
        AND (column_name = 'created_by' OR column_name = 'auth_user_id')
    ) THEN
      errs := errs || 'sales: created_by or auth_user_id column missing';
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- 6. activity_logs performed_by FK to auth.users (or column exists)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'activity_logs') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'performed_by'
    ) THEN
      errs := errs || 'activity_logs.performed_by column missing';
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- 7. payments received_by (global_identity migration)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'received_by'
    ) THEN
      errs := errs || 'payments.received_by column missing (run global_identity_and_received_by)';
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- 8. user_branches / user_account_access exist (RPC and RLS depend on them)
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_branches') THEN
    errs := errs || 'user_branches table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_account_access') THEN
    errs := errs || 'user_account_access table missing';
  END IF;

  -- -------------------------------------------------------------------------
  -- Result: write to temp table for final SELECT
  -- -------------------------------------------------------------------------
  DELETE FROM _validate_result;
  IF array_length(errs, 1) IS NULL OR array_length(errs, 1) = 0 THEN
    INSERT INTO _validate_result (result, details) VALUES ('PASS', NULL);
    RAISE NOTICE 'PASS';
  ELSE
    INSERT INTO _validate_result (result, details) VALUES ('FAIL', array_to_string(errs, '; '));
    RAISE NOTICE 'FAIL: %', array_to_string(errs, '; ');
  END IF;
END $$;

SELECT result AS "Migration state", details AS "Details" FROM _validate_result;
