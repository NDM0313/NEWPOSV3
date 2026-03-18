-- COMPANY TRANSACTION RESET – BACKUP (copy affected rows to backup tables)
-- Company: c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee
-- Run BEFORE company_reset_final.sql. Backup tables: backup_cr_<date>_<table>.

DO $$
DECLARE
  cid UUID := 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
BEGIN
  -- sale_return_items
  CREATE TABLE IF NOT EXISTS backup_cr_sale_return_items (LIKE sale_return_items INCLUDING ALL);
  INSERT INTO backup_cr_sale_return_items SELECT * FROM sale_return_items WHERE sale_return_id IN (SELECT id FROM sale_returns WHERE company_id = cid);
  -- sale_returns
  CREATE TABLE IF NOT EXISTS backup_cr_sale_returns (LIKE sale_returns INCLUDING ALL);
  INSERT INTO backup_cr_sale_returns SELECT * FROM sale_returns WHERE company_id = cid;
  -- sale_charges
  CREATE TABLE IF NOT EXISTS backup_cr_sale_charges (LIKE sale_charges INCLUDING ALL);
  INSERT INTO backup_cr_sale_charges SELECT * FROM sale_charges WHERE sale_id IN (SELECT id FROM sales WHERE company_id = cid);
  -- sale_items
  CREATE TABLE IF NOT EXISTS backup_cr_sale_items (LIKE sale_items INCLUDING ALL);
  INSERT INTO backup_cr_sale_items SELECT * FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE company_id = cid);
  -- sale_shipments
  CREATE TABLE IF NOT EXISTS backup_cr_sale_shipments (LIKE sale_shipments INCLUDING ALL);
  INSERT INTO backup_cr_sale_shipments SELECT * FROM sale_shipments WHERE company_id = cid;
  -- share_logs
  CREATE TABLE IF NOT EXISTS backup_cr_share_logs (LIKE share_logs INCLUDING ALL);
  INSERT INTO backup_cr_share_logs SELECT * FROM share_logs WHERE sale_id IN (SELECT id FROM sales WHERE company_id = cid);
  -- print_logs
  CREATE TABLE IF NOT EXISTS backup_cr_print_logs (LIKE print_logs INCLUDING ALL);
  INSERT INTO backup_cr_print_logs SELECT * FROM print_logs WHERE sale_id IN (SELECT id FROM sales WHERE company_id = cid);
  -- studio_production_stages
  CREATE TABLE IF NOT EXISTS backup_cr_studio_production_stages (LIKE studio_production_stages INCLUDING ALL);
  INSERT INTO backup_cr_studio_production_stages SELECT * FROM studio_production_stages WHERE production_id IN (SELECT id FROM studio_productions WHERE company_id = cid);
  -- studio_productions
  CREATE TABLE IF NOT EXISTS backup_cr_studio_productions (LIKE studio_productions INCLUDING ALL);
  INSERT INTO backup_cr_studio_productions SELECT * FROM studio_productions WHERE company_id = cid;
  -- purchase_return_items
  CREATE TABLE IF NOT EXISTS backup_cr_purchase_return_items (LIKE purchase_return_items INCLUDING ALL);
  INSERT INTO backup_cr_purchase_return_items SELECT * FROM purchase_return_items WHERE purchase_return_id IN (SELECT id FROM purchase_returns WHERE company_id = cid);
  -- purchase_returns
  CREATE TABLE IF NOT EXISTS backup_cr_purchase_returns (LIKE purchase_returns INCLUDING ALL);
  INSERT INTO backup_cr_purchase_returns SELECT * FROM purchase_returns WHERE company_id = cid;
  -- purchase_items
  CREATE TABLE IF NOT EXISTS backup_cr_purchase_items (LIKE purchase_items INCLUDING ALL);
  INSERT INTO backup_cr_purchase_items SELECT * FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE company_id = cid);
  -- purchases
  CREATE TABLE IF NOT EXISTS backup_cr_purchases (LIKE purchases INCLUDING ALL);
  INSERT INTO backup_cr_purchases SELECT * FROM purchases WHERE company_id = cid;
  -- rental_items
  CREATE TABLE IF NOT EXISTS backup_cr_rental_items (LIKE rental_items INCLUDING ALL);
  INSERT INTO backup_cr_rental_items SELECT * FROM rental_items WHERE rental_id IN (SELECT id FROM rentals WHERE company_id = cid);
  -- rentals
  CREATE TABLE IF NOT EXISTS backup_cr_rentals (LIKE rentals INCLUDING ALL);
  INSERT INTO backup_cr_rentals SELECT * FROM rentals WHERE company_id = cid;
  -- payments
  CREATE TABLE IF NOT EXISTS backup_cr_payments (LIKE payments INCLUDING ALL);
  INSERT INTO backup_cr_payments SELECT * FROM payments WHERE company_id = cid;
  -- expenses
  CREATE TABLE IF NOT EXISTS backup_cr_expenses (LIKE expenses INCLUDING ALL);
  INSERT INTO backup_cr_expenses SELECT * FROM expenses WHERE company_id = cid;
  -- ledger_entries
  CREATE TABLE IF NOT EXISTS backup_cr_ledger_entries (LIKE ledger_entries INCLUDING ALL);
  INSERT INTO backup_cr_ledger_entries SELECT * FROM ledger_entries WHERE ledger_id IN (SELECT id FROM ledger_master WHERE company_id = cid);
  -- ledger_master
  CREATE TABLE IF NOT EXISTS backup_cr_ledger_master (LIKE ledger_master INCLUDING ALL);
  INSERT INTO backup_cr_ledger_master SELECT * FROM ledger_master WHERE company_id = cid;
  -- journal_entry_lines
  CREATE TABLE IF NOT EXISTS backup_cr_journal_entry_lines (LIKE journal_entry_lines INCLUDING ALL);
  INSERT INTO backup_cr_journal_entry_lines SELECT * FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = cid);
  -- journal_entries (after nulling payment_id to avoid FK when we later delete payments)
  CREATE TABLE IF NOT EXISTS backup_cr_journal_entries (LIKE journal_entries INCLUDING ALL);
  INSERT INTO backup_cr_journal_entries SELECT * FROM journal_entries WHERE company_id = cid;
  -- stock_movements
  CREATE TABLE IF NOT EXISTS backup_cr_stock_movements (LIKE stock_movements INCLUDING ALL);
  INSERT INTO backup_cr_stock_movements SELECT * FROM stock_movements WHERE company_id = cid;
  -- activity_logs
  CREATE TABLE IF NOT EXISTS backup_cr_activity_logs (LIKE activity_logs INCLUDING ALL);
  INSERT INTO backup_cr_activity_logs SELECT * FROM activity_logs WHERE company_id = cid;
  -- courier_shipments
  CREATE TABLE IF NOT EXISTS backup_cr_courier_shipments (LIKE courier_shipments INCLUDING ALL);
  INSERT INTO backup_cr_courier_shipments SELECT * FROM courier_shipments WHERE company_id = cid;
  -- sales
  CREATE TABLE IF NOT EXISTS backup_cr_sales (LIKE sales INCLUDING ALL);
  INSERT INTO backup_cr_sales SELECT * FROM sales WHERE company_id = cid;
  -- worker_ledger_entries (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'worker_ledger_entries') THEN
    CREATE TABLE IF NOT EXISTS backup_cr_worker_ledger_entries (LIKE worker_ledger_entries INCLUDING ALL);
    INSERT INTO backup_cr_worker_ledger_entries SELECT * FROM worker_ledger_entries WHERE company_id = cid;
  END IF;
  RAISE NOTICE 'Backup completed. Tables: backup_cr_*';
END $$;
