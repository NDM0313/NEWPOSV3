-- COMPANY TRANSACTION RESET – VERIFICATION
-- Company: c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee
-- Run AFTER company_reset_final.sql. All transactional counts should be 0.

SELECT * FROM (
  SELECT 'sale_return_items' AS tbl, COUNT(*)::bigint AS cnt FROM sale_return_items WHERE sale_return_id IN (SELECT id FROM sale_returns WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid)
  UNION ALL SELECT 'sale_returns', COUNT(*) FROM sale_returns WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'sale_charges', COUNT(*) FROM sale_charges WHERE sale_id IN (SELECT id FROM sales WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid)
  UNION ALL SELECT 'sale_items', COUNT(*) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid)
  UNION ALL SELECT 'sale_shipments', COUNT(*) FROM sale_shipments WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'share_logs', COUNT(*) FROM share_logs WHERE sale_id IN (SELECT id FROM sales WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid)
  UNION ALL SELECT 'print_logs', COUNT(*) FROM print_logs WHERE sale_id IN (SELECT id FROM sales WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid)
  UNION ALL SELECT 'studio_production_stages', COUNT(*) FROM studio_production_stages WHERE production_id IN (SELECT id FROM studio_productions WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid)
  UNION ALL SELECT 'studio_productions', COUNT(*) FROM studio_productions WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'purchase_return_items', COUNT(*) FROM purchase_return_items WHERE purchase_return_id IN (SELECT id FROM purchase_returns WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid)
  UNION ALL SELECT 'purchase_returns', COUNT(*) FROM purchase_returns WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'purchase_items', COUNT(*) FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid)
  UNION ALL SELECT 'purchases', COUNT(*) FROM purchases WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'rental_items', COUNT(*) FROM rental_items WHERE rental_id IN (SELECT id FROM rentals WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid)
  UNION ALL SELECT 'rentals', COUNT(*) FROM rentals WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'payments', COUNT(*) FROM payments WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'expenses', COUNT(*) FROM expenses WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'ledger_entries', COUNT(*) FROM ledger_entries WHERE ledger_id IN (SELECT id FROM ledger_master WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid)
  UNION ALL SELECT 'ledger_master', COUNT(*) FROM ledger_master WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'journal_entry_lines', COUNT(*) FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid)
  UNION ALL SELECT 'journal_entries', COUNT(*) FROM journal_entries WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'stock_movements', COUNT(*) FROM stock_movements WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'activity_logs', COUNT(*) FROM activity_logs WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'courier_shipments', COUNT(*) FROM courier_shipments WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
  UNION ALL SELECT 'sales', COUNT(*) FROM sales WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
) t ORDER BY tbl;

-- Preserved: company, accounts, branches, users, products, contacts
SELECT 'companies' AS preserved, COUNT(*) AS cnt FROM companies WHERE id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
UNION ALL SELECT 'accounts', COUNT(*) FROM accounts WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
UNION ALL SELECT 'branches', COUNT(*) FROM branches WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
UNION ALL SELECT 'products', COUNT(*) FROM products WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid
UNION ALL SELECT 'contacts', COUNT(*) FROM contacts WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee'::uuid;
