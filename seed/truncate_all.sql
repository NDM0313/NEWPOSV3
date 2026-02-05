-- Truncate all app data (run before fresh seed). Skips tables that don't exist.

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'worker_ledger_entries', 'ledger_entries', 'ledger_master',
    'studio_production_stages', 'studio_production_logs', 'studio_productions',
    'sale_items', 'sales', 'purchase_items', 'payments', 'purchases', 'expenses',
    'document_sequences', 'workers', 'contacts', 'products', 'product_categories',
    'activity_logs', 'journal_entry_lines', 'journal_entries',
    'accounts', 'users', 'branches', 'companies'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('TRUNCATE TABLE %I CASCADE', tbl);
      RAISE NOTICE 'Truncated %', tbl;
    END IF;
  END LOOP;
END $$;
