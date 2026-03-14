-- Ledger RLS: Allow INSERT/UPDATE on ledger_master so app can create User/Supplier ledgers.
-- ledger_entries already has FOR ALL in enterprise_defaults_and_rls_isolation.sql.
-- ledger_master only had SELECT → getOrCreateLedger() insert was blocked by RLS.
--
-- Run in Supabase SQL Editor. Safe to re-run (DROP IF EXISTS).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ledger_master') THEN
    -- Allow admin/manager/accountant to insert and update ledger_master (same as ledger_entries)
    DROP POLICY IF EXISTS "ledger_master_insert_enterprise" ON public.ledger_master;
    CREATE POLICY "ledger_master_insert_enterprise"
      ON public.ledger_master FOR INSERT TO authenticated
      WITH CHECK (
        company_id = get_user_company_id()
        AND get_user_role() IN ('admin', 'manager', 'accountant')
      );

    DROP POLICY IF EXISTS "ledger_master_update_enterprise" ON public.ledger_master;
    CREATE POLICY "ledger_master_update_enterprise"
      ON public.ledger_master FOR UPDATE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND get_user_role() IN ('admin', 'manager', 'accountant')
      )
      WITH CHECK (company_id = get_user_company_id());
  END IF;
END $$;
