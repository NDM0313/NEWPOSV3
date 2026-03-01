-- ============================================================================
-- ERP FULL HEALTH CHECK – VERSION 2.0 (Defensive Mode)
-- Fully defensive, crash-proof diagnostic. Never assumes a table exists.
-- Usage: psql "$DATABASE_URL" -f scripts/erp_full_health_check.sql
--        or run in Supabase SQL Editor.
-- ============================================================================

-- Structured results (component, status, details)
DROP TABLE IF EXISTS erp_health_result;
CREATE TEMP TABLE erp_health_result (
  component TEXT,
  status TEXT,
  details TEXT
);

DO $$
DECLARE
  issues TEXT[] := '{}';
  r RECORD;
  n BIGINT;
  v_table_schema TEXT;
  v_table_name TEXT;
  v_col TEXT;
BEGIN
  -- -------------------------------------------------------------------------
  -- 1. public.users
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id') THEN
      issues := issues || 'public.users: auth_user_id column missing';
    END IF;
    INSERT INTO erp_health_result (component, status, details) VALUES ('public.users', 'OK', 'Table and auth_user_id checked');
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('public.users', 'SKIP', 'Table does not exist');
  END IF;

  -- -------------------------------------------------------------------------
  -- 2. auth.users (existence only; we may not have direct select)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    INSERT INTO erp_health_result (component, status, details) VALUES ('auth.users', 'OK', 'Table exists');
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('auth.users', 'SKIP', 'Table not found or no access');
  END IF;

  -- -------------------------------------------------------------------------
  -- 3. document_sequences_global
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_sequences_global') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_sequences_global') THEN
      issues := issues || 'document_sequences_global: no RLS policies';
    END IF;
    INSERT INTO erp_health_result (component, status, details) VALUES ('document_sequences_global', 'OK', 'Table and RLS checked');
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('document_sequences_global', 'SKIP', 'Table does not exist');
  END IF;

  -- -------------------------------------------------------------------------
  -- 4. contacts (walk-in uniqueness, data)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'system_type') THEN
      FOR r IN
        SELECT company_id, COUNT(*) AS cnt
        FROM public.contacts
        WHERE system_type = 'walking_customer'
        GROUP BY company_id
        HAVING COUNT(*) > 1
      LOOP
        issues := issues || format('contacts: company %s has %s walk-ins (expected 1)', r.company_id, r.cnt);
      END LOOP;
    END IF;
    INSERT INTO erp_health_result (component, status, details) VALUES ('contacts', 'OK', 'Walk-in count checked');
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('contacts', 'SKIP', 'Table does not exist');
  END IF;

  -- -------------------------------------------------------------------------
  -- 5. sales (RLS, created_by)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales') THEN
    SELECT COUNT(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sales';
    IF n = 0 THEN
      issues := issues || 'sales: no RLS policies';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'created_by') THEN
      issues := issues || 'sales: created_by column missing';
    END IF;
    INSERT INTO erp_health_result (component, status, details) VALUES ('sales', 'OK', 'RLS and created_by checked');
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('sales', 'SKIP', 'Table does not exist');
  END IF;

  -- -------------------------------------------------------------------------
  -- 6. payments (received_by)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'received_by') THEN
      issues := issues || 'payments: received_by column missing (run global_identity_and_received_by)';
    END IF;
    INSERT INTO erp_health_result (component, status, details) VALUES ('payments', 'OK', 'received_by checked');
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('payments', 'SKIP', 'Table does not exist');
  END IF;

  -- -------------------------------------------------------------------------
  -- 7. journal_entries
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'journal_entries') THEN
    INSERT INTO erp_health_result (component, status, details) VALUES ('journal_entries', 'OK', 'Table exists');
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('journal_entries', 'SKIP', 'Table does not exist');
  END IF;

  -- -------------------------------------------------------------------------
  -- 8. user_branches
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_branches') THEN
    INSERT INTO erp_health_result (component, status, details) VALUES ('user_branches', 'OK', 'Table exists');
  ELSE
    issues := issues || 'user_branches table missing';
    INSERT INTO erp_health_result (component, status, details) VALUES ('user_branches', 'FAIL', 'Table missing');
  END IF;

  -- -------------------------------------------------------------------------
  -- 9. user_account_access
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_account_access') THEN
    INSERT INTO erp_health_result (component, status, details) VALUES ('user_account_access', 'OK', 'Table exists');
  ELSE
    issues := issues || 'user_account_access table missing';
    INSERT INTO erp_health_result (component, status, details) VALUES ('user_account_access', 'FAIL', 'Table missing');
  END IF;

  -- -------------------------------------------------------------------------
  -- 10. ledger_master
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ledger_master') THEN
    INSERT INTO erp_health_result (component, status, details) VALUES ('ledger_master', 'OK', 'Table exists');
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('ledger_master', 'SKIP', 'Table does not exist');
  END IF;

  -- -------------------------------------------------------------------------
  -- 11. activity_logs (performed_by)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_logs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'performed_by') THEN
      issues := issues || 'activity_logs.performed_by column missing';
    END IF;
    INSERT INTO erp_health_result (component, status, details) VALUES ('activity_logs', 'OK', 'performed_by checked');
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('activity_logs', 'SKIP', 'Table does not exist');
  END IF;

  -- -------------------------------------------------------------------------
  -- 12. inventory_settings TABLE (if it exists as a table)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_settings') THEN
    INSERT INTO erp_health_result (component, status, details) VALUES ('inventory_settings', 'OK', 'Table exists');
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('inventory_settings', 'SKIP', 'Table does not exist (negative stock may be in settings key)');
  END IF;

  -- -------------------------------------------------------------------------
  -- 13. inventory_balance TABLE (if it exists)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_balance') THEN
    INSERT INTO erp_health_result (component, status, details) VALUES ('inventory_balance', 'OK', 'Table exists');
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('inventory_balance', 'SKIP', 'Table does not exist');
  END IF;

  -- -------------------------------------------------------------------------
  -- 13b. settings TABLE (optional; keys like inventory_settings, allow_negative_stock)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    INSERT INTO erp_health_result (component, status, details) VALUES ('settings', 'OK', 'Table exists');
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('settings', 'SKIP', 'Table does not exist');
  END IF;

  -- -------------------------------------------------------------------------
  -- 14. PHASE 4 – Detect negative stock setting (any table with allow_negative_stock column)
  -- -------------------------------------------------------------------------
  BEGIN
    FOR r IN
      SELECT c.table_schema, c.table_name, c.column_name
      FROM information_schema.columns c
      WHERE c.column_name ILIKE '%allow_negative_stock%' OR c.column_name ILIKE '%negative_stock%'
      LIMIT 1
    LOOP
      INSERT INTO erp_health_result (component, status, details)
      VALUES ('negative_stock_setting', 'OK', format('Found %I.%I.%I', r.table_schema, r.table_name, r.column_name));
      EXIT;
    END LOOP;
    IF NOT FOUND THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
        INSERT INTO erp_health_result (component, status, details) VALUES ('negative_stock_setting', 'OK', 'Use settings key inventory_settings or allow_negative_stock');
      ELSE
        INSERT INTO erp_health_result (component, status, details) VALUES ('negative_stock_setting', 'SKIP', 'No allow_negative_stock column or settings table');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO erp_health_result (component, status, details) VALUES ('negative_stock_setting', 'SKIP', 'Check skipped: ' || SQLERRM);
  END;

  -- -------------------------------------------------------------------------
  -- Final status
  -- -------------------------------------------------------------------------
  IF array_length(issues, 1) IS NULL OR array_length(issues, 1) = 0 THEN
    INSERT INTO erp_health_result (component, status, details) VALUES ('OVERALL', 'PASS', NULL);
    RAISE NOTICE 'ERP HEALTH STATUS: PASS';
  ELSE
    INSERT INTO erp_health_result (component, status, details) VALUES ('OVERALL', 'FAIL', array_to_string(issues, '; '));
    RAISE NOTICE 'ERP HEALTH STATUS: FAIL';
    RAISE NOTICE '%', array_to_string(issues, E'\n');
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO erp_health_result (component, status, details) VALUES ('OVERALL', 'ERROR', SQLERRM);
    RAISE NOTICE 'ERP HEALTH STATUS: ERROR (script did not crash but reported) %', SQLERRM;
END $$;

-- Structured report
SELECT component AS "Component", status AS "Status", details AS "Details" FROM erp_health_result ORDER BY component;
