-- Selective / complete company reset: optional p_options JSONB for master-data domains.
-- Preserves: companies, branches, users, settings. Complete mode wipes contacts, products, COA, workers.

SET search_path = public;

DROP FUNCTION IF EXISTS preview_company_transaction_reset(UUID);
DROP FUNCTION IF EXISTS execute_company_transaction_reset(UUID, TEXT);

CREATE OR REPLACE FUNCTION _company_reset_resolve_options(p_options JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_mode TEXT;
  v_txn BOOLEAN;
  v_contacts BOOLEAN;
  v_products BOOLEAN;
  v_accounts BOOLEAN;
  v_workers BOOLEAN;
  v_reseed BOOLEAN;
  v_domains JSONB;
BEGIN
  IF p_options IS NULL OR p_options = '{}'::jsonb OR p_options = 'null'::jsonb THEN
    RETURN jsonb_build_object(
      'mode', 'transactional',
      'domains', jsonb_build_object(
        'transactional', TRUE,
        'contacts', FALSE,
        'products', FALSE,
        'accounts', FALSE,
        'workers', FALSE
      ),
      'reseed_accounts', FALSE
    );
  END IF;

  v_mode := lower(COALESCE(NULLIF(TRIM(p_options->>'mode'), ''), 'transactional'));

  IF v_mode = 'complete' THEN
    RETURN jsonb_build_object(
      'mode', 'complete',
      'domains', jsonb_build_object(
        'transactional', TRUE,
        'contacts', TRUE,
        'products', TRUE,
        'accounts', TRUE,
        'workers', TRUE
      ),
      'reseed_accounts', COALESCE((p_options->>'reseed_accounts')::BOOLEAN, TRUE)
    );
  END IF;

  IF v_mode = 'selective' THEN
    v_domains := COALESCE(p_options->'domains', '{}'::jsonb);
    v_txn := COALESCE((v_domains->>'transactional')::BOOLEAN, TRUE);
    v_contacts := COALESCE((v_domains->>'contacts')::BOOLEAN, FALSE);
    v_products := COALESCE((v_domains->>'products')::BOOLEAN, FALSE);
    v_accounts := COALESCE((v_domains->>'accounts')::BOOLEAN, FALSE);
    v_workers := COALESCE((v_domains->>'workers')::BOOLEAN, FALSE);
    v_reseed := COALESCE((p_options->>'reseed_accounts')::BOOLEAN, FALSE);

    IF v_contacts OR v_products OR v_accounts OR v_workers THEN
      v_txn := TRUE;
    END IF;

    RETURN jsonb_build_object(
      'mode', 'selective',
      'domains', jsonb_build_object(
        'transactional', v_txn,
        'contacts', v_contacts,
        'products', v_products,
        'accounts', v_accounts,
        'workers', v_workers
      ),
      'reseed_accounts', v_reseed OR v_accounts
    );
  END IF;

  RETURN jsonb_build_object(
    'mode', 'transactional',
    'domains', jsonb_build_object(
      'transactional', TRUE,
      'contacts', FALSE,
      'products', FALSE,
      'accounts', FALSE,
      'workers', FALSE
    ),
    'reseed_accounts', FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION preview_company_transaction_reset(
  p_company_id UUID,
  p_options JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opts JSONB;
  v_domains JSONB;
  v_counts JSONB := '{}'::JSONB;
  v_master JSONB := '{}'::JSONB;
  v_payment_allocations BIGINT := 0;
  v_expense_items BIGINT := 0;
  v_bespoke_wo BIGINT := 0;
  v_inventory_balance BIGINT := 0;
  v_variations BIGINT := 0;
  v_combos BIGINT := 0;
  v_workers BIGINT := 0;
  v_accounts BIGINT := 0;
  v_branches BIGINT := 0;
  v_users BIGINT := 0;
  v_settings BIGINT := 0;
  v_contacts BIGINT := 0;
  v_products BIGINT := 0;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'company_id is required');
  END IF;

  v_opts := _company_reset_resolve_options(p_options);
  v_domains := v_opts->'domains';

  SELECT COUNT(*) INTO v_contacts FROM contacts WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_products FROM products WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_branches FROM branches WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_users FROM users WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_accounts FROM accounts WHERE company_id = p_company_id;

  IF to_regclass('public.settings') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM settings WHERE company_id = $1' INTO v_settings USING p_company_id;
  END IF;

  IF to_regclass('public.payment_allocations') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM payment_allocations WHERE company_id = $1'
      INTO v_payment_allocations USING p_company_id;
  END IF;

  IF to_regclass('public.expense_items') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM expense_items WHERE expense_id IN (SELECT id FROM expenses WHERE company_id = $1)'
      INTO v_expense_items USING p_company_id;
  END IF;

  IF to_regclass('public.bespoke_work_orders') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_bespoke_wo FROM bespoke_work_orders WHERE company_id = p_company_id;
  END IF;

  IF to_regclass('public.inventory_balance') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_inventory_balance FROM inventory_balance WHERE company_id = p_company_id;
  END IF;

  IF to_regclass('public.product_variations') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_variations
    FROM product_variations pv
    JOIN products p ON p.id = pv.product_id
    WHERE p.company_id = p_company_id;
  END IF;

  IF to_regclass('public.product_combos') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_combos FROM product_combos WHERE company_id = p_company_id;
  END IF;

  IF to_regclass('public.workers') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_workers FROM workers WHERE company_id = p_company_id;
  END IF;

  IF COALESCE((v_domains->>'transactional')::BOOLEAN, FALSE) THEN
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
      || jsonb_build_object('inventory_balance', v_inventory_balance)
      || jsonb_build_object('bespoke_work_orders', v_bespoke_wo)
      || jsonb_build_object('activity_logs', (SELECT COUNT(*) FROM activity_logs WHERE company_id = p_company_id))
      || jsonb_build_object('courier_shipments', (SELECT COUNT(*) FROM courier_shipments WHERE company_id = p_company_id))
      || jsonb_build_object('sale_shipments', (SELECT COUNT(*) FROM sale_shipments WHERE company_id = p_company_id))
      || jsonb_build_object('share_logs', (SELECT COUNT(*) FROM share_logs WHERE sale_id IN (SELECT id FROM sales WHERE company_id = p_company_id)))
      || jsonb_build_object('print_logs', (SELECT COUNT(*) FROM print_logs WHERE sale_id IN (SELECT id FROM sales WHERE company_id = p_company_id)))
      || jsonb_build_object('studio_productions', (SELECT COUNT(*) FROM studio_productions WHERE company_id = p_company_id))
      || jsonb_build_object('studio_production_stages', (SELECT COUNT(*) FROM studio_production_stages WHERE production_id IN (SELECT id FROM studio_productions WHERE company_id = p_company_id)))
      || jsonb_build_object('worker_ledger_entries', CASE WHEN to_regclass('public.worker_ledger_entries') IS NOT NULL THEN (SELECT COUNT(*) FROM worker_ledger_entries WHERE company_id = p_company_id) ELSE 0 END);
  END IF;

  v_master := jsonb_build_object(
    'contacts', CASE WHEN COALESCE((v_domains->>'contacts')::BOOLEAN, FALSE) THEN v_contacts ELSE 0 END,
    'products', CASE WHEN COALESCE((v_domains->>'products')::BOOLEAN, FALSE) THEN v_products ELSE 0 END,
    'product_variations', CASE WHEN COALESCE((v_domains->>'products')::BOOLEAN, FALSE) THEN v_variations ELSE 0 END,
    'product_combos', CASE WHEN COALESCE((v_domains->>'products')::BOOLEAN, FALSE) THEN v_combos ELSE 0 END,
    'accounts', CASE WHEN COALESCE((v_domains->>'accounts')::BOOLEAN, FALSE) THEN v_accounts ELSE 0 END,
    'workers', CASE WHEN COALESCE((v_domains->>'workers')::BOOLEAN, FALSE) THEN v_workers ELSE 0 END
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'mode', v_opts->>'mode',
    'options', v_opts,
    'requires_reset_all',
      COALESCE((v_domains->>'contacts')::BOOLEAN, FALSE)
      OR COALESCE((v_domains->>'products')::BOOLEAN, FALSE)
      OR COALESCE((v_domains->>'accounts')::BOOLEAN, FALSE)
      OR COALESCE((v_domains->>'workers')::BOOLEAN, FALSE)
      OR (v_opts->>'mode') = 'complete',
    'preserve', jsonb_build_object(
      'branches', v_branches,
      'users', v_users,
      'settings_keys', v_settings,
      'contacts', CASE WHEN NOT COALESCE((v_domains->>'contacts')::BOOLEAN, FALSE) THEN v_contacts ELSE 0 END,
      'products', CASE WHEN NOT COALESCE((v_domains->>'products')::BOOLEAN, FALSE) THEN v_products ELSE 0 END,
      'accounts', CASE WHEN NOT COALESCE((v_domains->>'accounts')::BOOLEAN, FALSE) THEN v_accounts ELSE 0 END
    ),
    'transactional', v_counts,
    'master', v_master
  );
END;
$$;

CREATE OR REPLACE FUNCTION execute_company_transaction_reset(
  p_company_id UUID,
  p_confirmation TEXT DEFAULT NULL,
  p_options JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := NULL;
  v_opts JSONB;
  v_domains JSONB;
  v_mode TEXT;
  v_preview JSONB;
  v_deleted JSONB := '{}'::JSONB;
  v_audit_id UUID;
  v_rows BIGINT := 0;
  v_prev_replication_role TEXT := NULL;
  v_prev_row_sec TEXT;
  v_year INTEGER;
  v_need_reset_all BOOLEAN;
  v_conf TEXT;
  v_do_txn BOOLEAN;
  v_do_contacts BOOLEAN;
  v_do_products BOOLEAN;
  v_do_accounts BOOLEAN;
  v_do_workers BOOLEAN;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'company_id is required');
  END IF;

  v_opts := _company_reset_resolve_options(p_options);
  v_domains := v_opts->'domains';
  v_mode := v_opts->>'mode';
  v_do_txn := COALESCE((v_domains->>'transactional')::BOOLEAN, FALSE);
  v_do_contacts := COALESCE((v_domains->>'contacts')::BOOLEAN, FALSE);
  v_do_products := COALESCE((v_domains->>'products')::BOOLEAN, FALSE);
  v_do_accounts := COALESCE((v_domains->>'accounts')::BOOLEAN, FALSE);
  v_do_workers := COALESCE((v_domains->>'workers')::BOOLEAN, FALSE);

  v_need_reset_all := v_do_contacts OR v_do_products OR v_do_accounts OR v_do_workers OR v_mode = 'complete';
  v_conf := upper(COALESCE(NULLIF(TRIM(p_confirmation), ''), ''));

  IF v_need_reset_all THEN
    IF v_conf <> 'RESET ALL' THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Confirmation phrase must be RESET ALL when deleting master data');
    END IF;
  ELSE
    IF v_conf <> 'RESET' THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Confirmation phrase must be RESET');
    END IF;
  END IF;

  IF NOT v_do_txn AND NOT v_need_reset_all THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'No reset domains selected');
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Not authenticated');
  END IF;

  SELECT CASE WHEN u.role IS NULL THEN '' ELSE lower(u.role::text) END
  INTO v_role
  FROM users u
  WHERE (u.id = v_user_id OR u.auth_user_id = v_user_id)
    AND u.company_id = p_company_id
  LIMIT 1;

  IF v_role NOT IN ('owner', 'admin', 'super admin', 'superadmin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only owner/admin can reset company data');
  END IF;

  v_preview := preview_company_transaction_reset(p_company_id, v_opts);

  v_prev_replication_role := current_setting('session_replication_role', true);
  PERFORM set_config('session_replication_role', 'replica', true);

  IF v_do_txn THEN
    DELETE FROM journal_entry_lines
    WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = p_company_id);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('pre_journal_entry_lines', v_rows);

    DELETE FROM journal_entries WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('pre_journal_entries', v_rows);
  END IF;

  INSERT INTO company_reset_audit_logs (
    company_id, requested_by, requested_role, mode, precheck_counts, deleted_counts
  )
  VALUES (p_company_id, v_user_id, v_role, v_mode, v_preview, '{}'::JSONB)
  RETURNING id INTO v_audit_id;

  IF v_do_txn THEN
    UPDATE journal_entries SET payment_id = NULL WHERE company_id = p_company_id;

    DELETE FROM sale_return_items WHERE sale_return_id IN (SELECT id FROM sale_returns WHERE company_id = p_company_id);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('sale_return_items', v_rows);

    DELETE FROM sale_returns WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('sale_returns', v_rows);

    IF to_regclass('public.bespoke_work_orders') IS NOT NULL THEN
      DELETE FROM bespoke_work_orders WHERE company_id = p_company_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_deleted := v_deleted || jsonb_build_object('bespoke_work_orders', v_rows);
    END IF;

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

    IF to_regclass('public.payment_allocations') IS NOT NULL THEN
      DELETE FROM payment_allocations WHERE company_id = p_company_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_deleted := v_deleted || jsonb_build_object('payment_allocations', v_rows);
    END IF;

    DELETE FROM payments WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('payments', v_rows);

    IF to_regclass('public.expense_items') IS NOT NULL THEN
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

    IF to_regclass('public.inventory_balance') IS NOT NULL THEN
      DELETE FROM inventory_balance WHERE company_id = p_company_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_deleted := v_deleted || jsonb_build_object('inventory_balance', v_rows);
    END IF;

    IF NOT v_do_products AND to_regclass('public.product_branches') IS NOT NULL THEN
      DELETE FROM product_branches WHERE company_id = p_company_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_deleted := v_deleted || jsonb_build_object('product_branches', v_rows);
    END IF;

    IF NOT v_do_products THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'current_stock'
      ) THEN
        UPDATE products SET current_stock = 0 WHERE company_id = p_company_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_deleted := v_deleted || jsonb_build_object('products_current_stock_zeroed', v_rows);
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'product_variations' AND column_name = 'current_stock'
      ) THEN
        UPDATE product_variations pv
           SET current_stock = 0
          FROM products p
         WHERE pv.product_id = p.id AND p.company_id = p_company_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_deleted := v_deleted || jsonb_build_object('product_variations_current_stock_zeroed', v_rows);
      END IF;
    END IF;

    DELETE FROM courier_shipments WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('courier_shipments', v_rows);

    DELETE FROM sales WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('sales', v_rows);

    IF to_regclass('public.worker_ledger_entries') IS NOT NULL THEN
      DELETE FROM worker_ledger_entries WHERE company_id = p_company_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_deleted := v_deleted || jsonb_build_object('worker_ledger_entries', v_rows);
    END IF;

    DELETE FROM activity_logs WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('activity_logs', v_rows);

    v_prev_row_sec := current_setting('row_security', true);
    BEGIN
      PERFORM set_config('row_security', 'off', true);
      v_year := EXTRACT(YEAR FROM NOW())::INTEGER;

      IF to_regclass('public.document_sequences_global') IS NOT NULL THEN
        DELETE FROM document_sequences_global WHERE company_id = p_company_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_deleted := v_deleted || jsonb_build_object('document_sequences_global_deleted', v_rows);

        INSERT INTO public.document_sequences_global (company_id, document_type, current_number)
        SELECT p_company_id, dt, 0
        FROM unnest(ARRAY[
          'SL', 'PS', 'DRAFT', 'QT', 'SO', 'SDR', 'SQT', 'SOR', 'CUS', 'PUR', 'PDR', 'POR', 'PAY', 'RNT', 'STD',
          'EXP', 'JE', 'RCP', 'PRD', 'JOB', 'SUP', 'WRK'
        ]::text[]) AS u(dt)
        ON CONFLICT (company_id, document_type) DO UPDATE
          SET current_number = 0, updated_at = NOW();
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_deleted := v_deleted || jsonb_build_object('document_sequences_global_seeded_zero', v_rows);
      END IF;

      IF to_regclass('public.document_sequences') IS NOT NULL THEN
        DELETE FROM document_sequences WHERE company_id = p_company_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_deleted := v_deleted || jsonb_build_object('document_sequences_reset', v_rows);
      END IF;

      IF to_regclass('public.erp_document_sequences') IS NOT NULL THEN
        DELETE FROM erp_document_sequences WHERE company_id = p_company_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_deleted := v_deleted || jsonb_build_object('erp_document_sequences_deleted', v_rows);

        INSERT INTO public.erp_document_sequences (
          company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
        )
        SELECT
          p_company_id,
          public.erp_numbering_global_branch_sentinel(),
          upper(u.dt),
          public.erp_document_default_prefix(lower(u.dt)),
          v_year,
          0,
          CASE WHEN upper(u.dt) IN ('MANUAL_JOURNAL', 'FUND_TRANSFER') THEN 6 ELSE 4 END,
          NOW()
        FROM unnest(ARRAY[
          'sale', 'purchase', 'purchase_return', 'payment', 'supplier_payment', 'customer_receipt',
          'expense', 'rental', 'stock', 'stock_adjustment', 'journal', 'product', 'studio', 'job', 'pos',
          'customer', 'supplier', 'worker', 'sale_return', 'manual_journal', 'fund_transfer'
        ]::text[]) AS u(dt)
        ON CONFLICT (company_id, branch_id, document_type, year) DO UPDATE
          SET last_number = 0, updated_at = NOW();
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_deleted := v_deleted || jsonb_build_object('erp_document_sequences_seeded_zero', v_rows);
      END IF;

      PERFORM set_config('row_security', COALESCE(v_prev_row_sec, 'on'), true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('row_security', COALESCE(v_prev_row_sec, 'on'), true);
      RAISE;
    END;
  END IF;

  IF v_do_workers AND to_regclass('public.workers') IS NOT NULL THEN
    DELETE FROM workers WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('workers', v_rows);
  END IF;

  IF v_do_contacts THEN
    DELETE FROM contacts WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('contacts', v_rows);
  END IF;

  IF v_do_products THEN
    IF to_regclass('public.product_combo_items') IS NOT NULL THEN
      DELETE FROM product_combo_items
      WHERE combo_id IN (SELECT id FROM product_combos WHERE company_id = p_company_id);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_deleted := v_deleted || jsonb_build_object('product_combo_items', v_rows);
    END IF;

    IF to_regclass('public.product_combos') IS NOT NULL THEN
      DELETE FROM product_combos WHERE company_id = p_company_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_deleted := v_deleted || jsonb_build_object('product_combos', v_rows);
    END IF;

    IF to_regclass('public.product_variations') IS NOT NULL THEN
      DELETE FROM product_variations
      WHERE product_id IN (SELECT id FROM products WHERE company_id = p_company_id);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_deleted := v_deleted || jsonb_build_object('product_variations', v_rows);
    END IF;

    IF to_regclass('public.product_branches') IS NOT NULL THEN
      DELETE FROM product_branches WHERE company_id = p_company_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_deleted := v_deleted || jsonb_build_object('product_branches', v_rows);
    END IF;

    DELETE FROM products WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('products', v_rows);
  END IF;

  IF v_do_accounts THEN
    UPDATE branches
    SET
      default_cash_account_id = NULL,
      default_bank_account_id = NULL,
      default_pos_drawer_account_id = NULL
    WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('branches_account_refs_cleared', v_rows);

    DELETE FROM accounts WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('accounts', v_rows);
  END IF;

  UPDATE company_reset_audit_logs SET deleted_counts = v_deleted WHERE id = v_audit_id;

  PERFORM set_config(
    'session_replication_role',
    COALESCE(NULLIF(v_prev_replication_role, ''), 'origin'),
    true
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'auditId', v_audit_id,
    'preview', v_preview,
    'deleted', v_deleted,
    'options', v_opts,
    'reseed_accounts', COALESCE((v_opts->>'reseed_accounts')::BOOLEAN, FALSE)
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

COMMENT ON FUNCTION public.preview_company_transaction_reset(UUID, JSONB) IS
  'Preview company reset with optional domains (transactional, contacts, products, accounts, workers).';

COMMENT ON FUNCTION public.execute_company_transaction_reset(UUID, TEXT, JSONB) IS
  'Execute selective or complete company reset. Master deletes require RESET ALL confirmation.';

GRANT EXECUTE ON FUNCTION preview_company_transaction_reset(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_company_transaction_reset(UUID, TEXT, JSONB) TO authenticated;
