-- Inspect schema: tables with company_id and FK relationships for company reset
-- Run on VPS: get DB container then: docker exec -i <db> psql -U postgres -d postgres -f -

\echo '=== TABLES WITH company_id (public schema) ==='
SELECT table_name
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'company_id'
ORDER BY table_name;

\echo ''
\echo '=== FOREIGN KEYS: child -> parent (relevant to transactions) ==='
SELECT
  c.table_name AS child_table,
  kcu.column_name AS fk_column,
  c2.table_name AS parent_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
JOIN information_schema.tables c ON c.table_name = tc.table_name AND c.table_schema = tc.table_schema
JOIN information_schema.tables c2 ON c2.table_name = ccu.table_name AND c2.table_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND c.table_name IN (
    'sales', 'sale_items', 'sale_returns', 'sale_return_items', 'sale_charges', 'sale_shipments',
    'purchases', 'purchase_items', 'purchase_returns', 'purchase_return_items',
    'payments', 'payment_allocations', 'expenses',
    'journal_entries', 'journal_entry_lines', 'ledger_entries', 'ledger_master',
    'account_transactions', 'stock_movements', 'stock_adjustments', 'inventory_movements', 'inventory_adjustments', 'inventory_counts',
    'rentals', 'rental_items', 'studio_orders', 'studio_productions', 'studio_production_stages',
    'shipments', 'shipment_items', 'sale_shipments', 'courier_shipments',
    'deposits', 'deposit_transactions', 'activity_logs', 'share_logs', 'print_logs'
  )
ORDER BY parent_table, child_table;

\echo ''
\echo '=== TABLE EXISTS CHECK (common transactional tables) ==='
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'sales', 'sale_items', 'sale_returns', 'sale_return_items', 'sale_charges', 'sale_shipments',
    'purchases', 'purchase_items', 'purchase_returns', 'purchase_return_items',
    'payments', 'payment_allocations', 'expenses',
    'journal_entries', 'journal_entry_lines', 'ledger_entries', 'ledger_master',
    'account_transactions', 'stock_movements', 'stock_adjustments', 'inventory_movements', 'inventory_adjustments', 'inventory_counts',
    'rentals', 'rental_items', 'studio_orders', 'studio_productions', 'studio_production_stages',
    'shipments', 'shipment_items', 'courier_shipments',
    'deposits', 'deposit_transactions', 'activity_logs', 'share_logs', 'print_logs'
  )
ORDER BY table_name;
