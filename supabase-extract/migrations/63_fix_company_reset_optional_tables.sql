-- ============================================================================
-- Migration 63: Guard optional tables in company reset preview
-- Some environments don't have payment_allocations / expense_items tables.
-- ============================================================================

CREATE OR REPLACE FUNCTION preview_company_transaction_reset(
  p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counts JSONB := '{}'::JSONB;
  v_contacts BIGINT := 0;
  v_products BIGINT := 0;
  v_payment_allocations BIGINT := 0;
  v_expense_items BIGINT := 0;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'company_id is required');
  END IF;

  SELECT COUNT(*) INTO v_contacts FROM contacts WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_products FROM products WHERE company_id = p_company_id;

  IF to_regclass('public.payment_allocations') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM payment_allocations WHERE company_id = $1'
      INTO v_payment_allocations
      USING p_company_id;
  END IF;

  IF to_regclass('public.expense_items') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM expense_items WHERE expense_id IN (SELECT id FROM expenses WHERE company_id = $1)'
      INTO v_expense_items
      USING p_company_id;
  END IF;

  v_counts := v_counts
    || jsonb_build_object('sales', (SELECT COUNT(*) FROM sales WHERE company_id = p_company_id))
    || jsonb_build_object('sale_items', (SELECT COUNT(*) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE company_id = p_company_id)))
    || jsonb_build_object('sale_returns', (SELECT COUNT(*) FROM sale_returns WHERE company_id = p_company_id))
    || jsonb_build_object('sale_return_items', (SELECT COUNT(*) FROM sale_return_items WHERE sale_return_id IN (SELECT id FROM sale_returns WHERE company_id = p_company_id)))
    || jsonb_build_object('purchases', (SELECT COUNT(*) FROM purchases WHERE company_id = p_company_id))
    || jsonb_build_object('purchase_items', (SELECT COUNT(*) FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE company_id = p_company_id)))
    || jsonb_build_object('purchase_returns', (SELECT COUNT(*) FROM purchase_returns WHERE company_id = p_company_id))
    || jsonb_build_object('purchase_return_items', (SELECT COUNT(*) FROM purchase_return_items WHERE purchase_return_id IN (SELECT id FROM purchase_returns WHERE company_id = p_company_id)))
    || jsonb_build_object('rentals', (SELECT COUNT(*) FROM rentals WHERE company_id = p_company_id))
    || jsonb_build_object('rental_items', (SELECT COUNT(*) FROM rental_items WHERE rental_id IN (SELECT id FROM rentals WHERE company_id = p_company_id)))
    || jsonb_build_object('payments', (SELECT COUNT(*) FROM payments WHERE company_id = p_company_id))
    || jsonb_build_object('payment_allocations', v_payment_allocations)
    || jsonb_build_object('expenses', (SELECT COUNT(*) FROM expenses WHERE company_id = p_company_id))
    || jsonb_build_object('expense_items', v_expense_items)
    || jsonb_build_object('journal_entries', (SELECT COUNT(*) FROM journal_entries WHERE company_id = p_company_id))
    || jsonb_build_object('journal_entry_lines', (SELECT COUNT(*) FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = p_company_id)))
    || jsonb_build_object('ledger_master', (SELECT COUNT(*) FROM ledger_master WHERE company_id = p_company_id))
    || jsonb_build_object('ledger_entries', (SELECT COUNT(*) FROM ledger_entries WHERE ledger_id IN (SELECT id FROM ledger_master WHERE company_id = p_company_id)))
    || jsonb_build_object('stock_movements', (SELECT COUNT(*) FROM stock_movements WHERE company_id = p_company_id))
    || jsonb_build_object('activity_logs', (SELECT COUNT(*) FROM activity_logs WHERE company_id = p_company_id))
    || jsonb_build_object('courier_shipments', (SELECT COUNT(*) FROM courier_shipments WHERE company_id = p_company_id))
    || jsonb_build_object('sale_shipments', (SELECT COUNT(*) FROM sale_shipments WHERE company_id = p_company_id))
    || jsonb_build_object('share_logs', (SELECT COUNT(*) FROM share_logs WHERE sale_id IN (SELECT id FROM sales WHERE company_id = p_company_id)))
    || jsonb_build_object('print_logs', (SELECT COUNT(*) FROM print_logs WHERE sale_id IN (SELECT id FROM sales WHERE company_id = p_company_id)))
    || jsonb_build_object('studio_productions', (SELECT COUNT(*) FROM studio_productions WHERE company_id = p_company_id))
    || jsonb_build_object('studio_production_stages', (SELECT COUNT(*) FROM studio_production_stages WHERE production_id IN (SELECT id FROM studio_productions WHERE company_id = p_company_id)));

  RETURN jsonb_build_object(
    'success', TRUE,
    'mode', 'hard_delete_txn',
    'preserve', jsonb_build_object(
      'contacts', v_contacts,
      'products', v_products
    ),
    'transactional', v_counts
  );
END;
$$;

