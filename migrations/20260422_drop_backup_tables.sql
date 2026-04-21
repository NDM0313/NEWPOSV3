-- =============================================================================
-- DROP BACKUP TABLES
-- These are point-in-time backup snapshots no longer needed for operations.
-- All 28 backup_cr_* and backup_pf145_* tables are dropped safely.
-- =============================================================================

DROP TABLE IF EXISTS backup_cr_activity_logs;
DROP TABLE IF EXISTS backup_cr_courier_shipments;
DROP TABLE IF EXISTS backup_cr_expenses;
DROP TABLE IF EXISTS backup_cr_journal_entries;
DROP TABLE IF EXISTS backup_cr_journal_entry_lines;
DROP TABLE IF EXISTS backup_cr_ledger_entries;
DROP TABLE IF EXISTS backup_cr_ledger_master;
DROP TABLE IF EXISTS backup_cr_payments;
DROP TABLE IF EXISTS backup_cr_print_logs;
DROP TABLE IF EXISTS backup_cr_purchase_items;
DROP TABLE IF EXISTS backup_cr_purchase_return_items;
DROP TABLE IF EXISTS backup_cr_purchase_returns;
DROP TABLE IF EXISTS backup_cr_purchases;
DROP TABLE IF EXISTS backup_cr_rental_items;
DROP TABLE IF EXISTS backup_cr_rentals;
DROP TABLE IF EXISTS backup_cr_sale_charges;
DROP TABLE IF EXISTS backup_cr_sale_items;
DROP TABLE IF EXISTS backup_cr_sale_return_items;
DROP TABLE IF EXISTS backup_cr_sale_returns;
DROP TABLE IF EXISTS backup_cr_sale_shipments;
DROP TABLE IF EXISTS backup_cr_sales;
DROP TABLE IF EXISTS backup_cr_share_logs;
DROP TABLE IF EXISTS backup_cr_stock_movements;
DROP TABLE IF EXISTS backup_cr_studio_production_stages;
DROP TABLE IF EXISTS backup_cr_studio_productions;
DROP TABLE IF EXISTS backup_cr_worker_ledger_entries;
DROP TABLE IF EXISTS backup_pf145_journal_entries;
DROP TABLE IF EXISTS backup_pf145_journal_entry_lines;

-- Also drop the old studio/worker versions that are superseded by v2/v3
-- (keep studio_production_orders_v3, studio_production_stages_v3 as these are current)
-- studio_productions and studio_production_stages (v1) are legacy:
-- Uncomment below only if confirmed v1 tables are unused:
-- DROP TABLE IF EXISTS studio_productions;
-- DROP TABLE IF EXISTS studio_production_stages;
