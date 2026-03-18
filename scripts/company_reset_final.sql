-- COMPANY TRANSACTION RESET – FINAL (delete business data only, preserve master/config)
-- Company: c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee
-- Run AFTER company_reset_backup.sql. Order respects FK dependencies.

DO $$
DECLARE
  cid UUID := 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
  n bigint;
BEGIN
  -- Null FK from journal_entries to payments so we can delete payments first
  UPDATE journal_entries SET payment_id = NULL WHERE company_id = cid;

  -- 1. Sale-related (children before parents)
  DELETE FROM sale_return_items WHERE sale_return_id IN (SELECT id FROM sale_returns WHERE company_id = cid);
  DELETE FROM sale_returns WHERE company_id = cid;
  DELETE FROM sale_charges WHERE sale_id IN (SELECT id FROM sales WHERE company_id = cid);
  DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE company_id = cid);
  DELETE FROM sale_shipments WHERE company_id = cid;
  DELETE FROM share_logs WHERE sale_id IN (SELECT id FROM sales WHERE company_id = cid);
  DELETE FROM print_logs WHERE sale_id IN (SELECT id FROM sales WHERE company_id = cid);
  DELETE FROM studio_production_stages WHERE production_id IN (SELECT id FROM studio_productions WHERE company_id = cid);
  DELETE FROM studio_productions WHERE company_id = cid;

  -- 2. Purchase-related
  DELETE FROM purchase_return_items WHERE purchase_return_id IN (SELECT id FROM purchase_returns WHERE company_id = cid);
  DELETE FROM purchase_returns WHERE company_id = cid;
  DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE company_id = cid);
  DELETE FROM purchases WHERE company_id = cid;

  -- 3. Rentals
  DELETE FROM rental_items WHERE rental_id IN (SELECT id FROM rentals WHERE company_id = cid);
  DELETE FROM rentals WHERE company_id = cid;

  -- 4. Payments and expenses
  DELETE FROM payments WHERE company_id = cid;
  DELETE FROM expenses WHERE company_id = cid;

  -- 5. Ledger (entries before master)
  DELETE FROM ledger_entries WHERE ledger_id IN (SELECT id FROM ledger_master WHERE company_id = cid);
  DELETE FROM ledger_master WHERE company_id = cid;

  -- 6. Journal (lines before entries)
  DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = cid);
  DELETE FROM journal_entries WHERE company_id = cid;

  -- 7. Stock, activity, courier, sales
  DELETE FROM stock_movements WHERE company_id = cid;
  DELETE FROM activity_logs WHERE company_id = cid;
  DELETE FROM courier_shipments WHERE company_id = cid;
  DELETE FROM sales WHERE company_id = cid;

  -- 8. Worker ledger (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'worker_ledger_entries') THEN
    DELETE FROM worker_ledger_entries WHERE company_id = cid;
  END IF;

  -- 9. Final pass: activity_logs (in case triggers re-inserted during deletes)
  DELETE FROM activity_logs WHERE company_id = cid;

  RAISE NOTICE 'Company transaction reset completed for %.', cid;
END $$;
