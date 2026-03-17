-- ============================================================================
-- RPC: Ensure ERP accounts (5000, 2010, etc.) for current user's company
-- ============================================================================
-- Call from the app (Studio Costs tab). Safe to call multiple times.
-- Uses ensure_erp_accounts if it exists; otherwise inserts directly.
-- Wrapped in DO so migration succeeds when current user is not function owner.
-- ============================================================================

DO $$
BEGIN
  EXECUTE $exec$
CREATE OR REPLACE FUNCTION ensure_erp_accounts_for_current_company()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_company_id UUID;
BEGIN
  v_company_id := get_user_company_id();
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Company not found for current user.');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ensure_erp_accounts') THEN
    PERFORM ensure_erp_accounts(v_company_id);
  ELSE
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '2000', 'Accounts Receivable', 'Accounts Receivable', true)
    ON CONFLICT (company_id, code) DO NOTHING;
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '4000', 'Sales Revenue', 'Sales Revenue', true)
    ON CONFLICT (company_id, code) DO NOTHING;
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '5000', 'Cost of Production', 'Cost of Production', true)
    ON CONFLICT (company_id, code) DO NOTHING;
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '2010', 'Worker Payable', 'Worker Payable', true)
    ON CONFLICT (company_id, code) DO NOTHING;
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '3000', 'Owner Capital', 'equity', true)
    ON CONFLICT (company_id, code) DO NOTHING;
    INSERT INTO accounts (company_id, code, name, type, is_active)
    VALUES (v_company_id, '3002', 'Retained Earnings', 'equity', true)
    ON CONFLICT (company_id, code) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true, 'company_id', v_company_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$body$;
$exec$;
  EXECUTE 'COMMENT ON FUNCTION ensure_erp_accounts_for_current_company() IS ''Ensures accounts 2000, 4000, 5000, 2010 for current user company. Call from Studio Costs tab.''';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'accounting_ensure_erp_accounts_rpc: Could not replace ensure_erp_accounts_for_current_company: %', SQLERRM;
END $$;

DO $$
BEGIN
  EXECUTE $exec$
CREATE OR REPLACE FUNCTION ensure_erp_accounts_all_companies()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  r RECORD;
  cnt INT := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ensure_erp_accounts') THEN
    FOR r IN SELECT DISTINCT company_id FROM accounts WHERE company_id IS NOT NULL
    LOOP
      PERFORM ensure_erp_accounts(r.company_id);
      cnt := cnt + 1;
    END LOOP;
    FOR r IN SELECT id AS company_id FROM companies
    LOOP
      PERFORM ensure_erp_accounts(r.company_id);
      cnt := cnt + 1;
    END LOOP;
  ELSE
    FOR r IN SELECT id AS company_id FROM companies
    LOOP
      INSERT INTO accounts (company_id, code, name, type, is_active)
      VALUES (r.company_id, '2000', 'Accounts Receivable', 'Accounts Receivable', true)
      ON CONFLICT (company_id, code) DO NOTHING;
      INSERT INTO accounts (company_id, code, name, type, is_active)
      VALUES (r.company_id, '4000', 'Sales Revenue', 'Sales Revenue', true)
      ON CONFLICT (company_id, code) DO NOTHING;
      INSERT INTO accounts (company_id, code, name, type, is_active)
      VALUES (r.company_id, '5000', 'Cost of Production', 'Cost of Production', true)
      ON CONFLICT (company_id, code) DO NOTHING;
      INSERT INTO accounts (company_id, code, name, type, is_active)
      VALUES (r.company_id, '2010', 'Worker Payable', 'Worker Payable', true)
      ON CONFLICT (company_id, code) DO NOTHING;
      INSERT INTO accounts (company_id, code, name, type, is_active)
      VALUES (r.company_id, '3000', 'Owner Capital', 'equity', true)
      ON CONFLICT (company_id, code) DO NOTHING;
      INSERT INTO accounts (company_id, code, name, type, is_active)
      VALUES (r.company_id, '3002', 'Retained Earnings', 'equity', true)
      ON CONFLICT (company_id, code) DO NOTHING;
      cnt := cnt + 1;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('ok', true, 'companies_processed', cnt);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$body$;
$exec$;
  EXECUTE 'COMMENT ON FUNCTION ensure_erp_accounts_all_companies() IS ''Ensures accounts 2000, 4000, 5000, 2010 for every company. Idempotent. Call from script or admin.''';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'accounting_ensure_erp_accounts_rpc: Could not replace ensure_erp_accounts_all_companies: %', SQLERRM;
END $$;
