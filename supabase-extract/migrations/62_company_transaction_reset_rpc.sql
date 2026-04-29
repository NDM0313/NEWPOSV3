-- ============================================================================
-- Migration 62: Company transactional reset RPCs (preserve master data)
-- Preserve: contacts (customers/suppliers/workers), products/items, accounts, branches, users
-- Wipe: operational transactional/accounting rows for selected company
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_reset_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requested_by UUID NULL,
  requested_role TEXT NULL,
  mode TEXT NOT NULL DEFAULT 'hard_delete_txn',
  precheck_counts JSONB NOT NULL DEFAULT '{}'::JSONB,
  deleted_counts JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_reset_audit_logs_company_created
  ON company_reset_audit_logs(company_id, created_at DESC);

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
BEGIN
  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'company_id is required');
  END IF;

  SELECT COUNT(*) INTO v_contacts FROM contacts WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_products FROM products WHERE company_id = p_company_id;

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
    || jsonb_build_object('payment_allocations', (SELECT COUNT(*) FROM payment_allocations WHERE company_id = p_company_id))
    || jsonb_build_object('expenses', (SELECT COUNT(*) FROM expenses WHERE company_id = p_company_id))
    || jsonb_build_object('expense_items', (SELECT COUNT(*) FROM expense_items WHERE expense_id IN (SELECT id FROM expenses WHERE company_id = p_company_id)))
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

CREATE OR REPLACE FUNCTION execute_company_transaction_reset(
  p_company_id UUID,
  p_confirmation TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := NULL;
  v_preview JSONB := '{}'::JSONB;
  v_deleted JSONB := '{}'::JSONB;
  v_audit_id UUID;
  v_rows BIGINT := 0;
  v_prev_replication_role TEXT := NULL;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'company_id is required');
  END IF;

  IF COALESCE(NULLIF(TRIM(p_confirmation), ''), '') <> 'RESET' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Confirmation phrase must be RESET');
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Not authenticated');
  END IF;

  SELECT CASE
    WHEN u.role IS NULL THEN ''
    ELSE lower(u.role::text)
  END
  INTO v_role
  FROM users u
  WHERE (u.id = v_user_id OR u.auth_user_id = v_user_id)
    AND u.company_id = p_company_id
  LIMIT 1;

  IF v_role NOT IN ('owner', 'admin', 'super admin', 'superadmin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only owner/admin can reset company transactions');
  END IF;

  v_preview := preview_company_transaction_reset(p_company_id);

  -- Hard reset should not invoke transactional posting triggers while purging rows.
  v_prev_replication_role := current_setting('session_replication_role', true);
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO company_reset_audit_logs (
    company_id,
    requested_by,
    requested_role,
    mode,
    precheck_counts,
    deleted_counts
  )
  VALUES (
    p_company_id,
    v_user_id,
    v_role,
    'hard_delete_txn',
    v_preview,
    '{}'::JSONB
  )
  RETURNING id INTO v_audit_id;

  UPDATE journal_entries
  SET payment_id = NULL
  WHERE company_id = p_company_id;

  DELETE FROM sale_return_items
  WHERE sale_return_id IN (SELECT id FROM sale_returns WHERE company_id = p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('sale_return_items', v_rows);

  DELETE FROM sale_returns WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('sale_returns', v_rows);

  DELETE FROM sale_charges WHERE sale_id IN (SELECT id FROM sales WHERE company_id = p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('sale_charges', v_rows);

  DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE company_id = p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('sale_items', v_rows);

  DELETE FROM sale_shipments WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('sale_shipments', v_rows);

  DELETE FROM share_logs WHERE sale_id IN (SELECT id FROM sales WHERE company_id = p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('share_logs', v_rows);

  DELETE FROM print_logs WHERE sale_id IN (SELECT id FROM sales WHERE company_id = p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('print_logs', v_rows);

  DELETE FROM studio_production_stages
  WHERE production_id IN (SELECT id FROM studio_productions WHERE company_id = p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('studio_production_stages', v_rows);

  DELETE FROM studio_productions WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('studio_productions', v_rows);

  DELETE FROM purchase_return_items
  WHERE purchase_return_id IN (SELECT id FROM purchase_returns WHERE company_id = p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('purchase_return_items', v_rows);

  DELETE FROM purchase_returns WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('purchase_returns', v_rows);

  DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE company_id = p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('purchase_items', v_rows);

  DELETE FROM purchases WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('purchases', v_rows);

  DELETE FROM rental_items WHERE rental_id IN (SELECT id FROM rentals WHERE company_id = p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('rental_items', v_rows);

  DELETE FROM rentals WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('rentals', v_rows);

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payment_allocations') THEN
    DELETE FROM payment_allocations WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('payment_allocations', v_rows);
  END IF;

  DELETE FROM payments WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('payments', v_rows);

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='expense_items') THEN
    DELETE FROM expense_items WHERE expense_id IN (SELECT id FROM expenses WHERE company_id = p_company_id);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('expense_items', v_rows);
  END IF;

  DELETE FROM expenses WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('expenses', v_rows);

  DELETE FROM ledger_entries WHERE ledger_id IN (SELECT id FROM ledger_master WHERE company_id = p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('ledger_entries', v_rows);

  DELETE FROM ledger_master WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('ledger_master', v_rows);

  DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('journal_entry_lines', v_rows);

  DELETE FROM journal_entries WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('journal_entries', v_rows);

  DELETE FROM stock_movements WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('stock_movements', v_rows);

  DELETE FROM courier_shipments WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('courier_shipments', v_rows);

  DELETE FROM sales WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('sales', v_rows);

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='worker_ledger_entries') THEN
    DELETE FROM worker_ledger_entries WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('worker_ledger_entries', v_rows);
  END IF;

  DELETE FROM activity_logs WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('activity_logs', v_rows);

  UPDATE company_reset_audit_logs
  SET deleted_counts = v_deleted
  WHERE id = v_audit_id;

  PERFORM set_config(
    'session_replication_role',
    COALESCE(NULLIF(v_prev_replication_role, ''), 'origin'),
    true
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'auditId', v_audit_id,
    'preview', v_preview,
    'deleted', v_deleted
  );
EXCEPTION WHEN OTHERS THEN
  BEGIN
    PERFORM set_config(
      'session_replication_role',
      COALESCE(NULLIF(v_prev_replication_role, ''), 'origin'),
      true
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION preview_company_transaction_reset(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_company_transaction_reset(UUID, TEXT) TO authenticated;

