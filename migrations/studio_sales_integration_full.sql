-- ============================================================================
-- STUDIO-TO-SALES COST INTEGRATION – FULL SCHEMA & SYNC
-- ============================================================================
-- 1. studio_orders (sale_id, status, total_worker_cost, started_at, completed_at)
-- 2. studio_tasks (studio_order_id, task_type, worker_id, cost, created_by, completed_by, updated_by)
-- 3. worker_payments (studio_task_id, amount, paid_by, paid_at)
-- 4. Sync: task changes → recalc studio_orders.total_worker_cost → sales.studio_charges & due_amount
-- 5. record_customer_payment: use (total + studio_charges) for due_amount
-- 6. Sale status auto: Final Completed when production complete AND balance_due = 0
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SALES: ensure studio_charges and due_amount exist
-- ----------------------------------------------------------------------------
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS studio_charges NUMERIC(15,2) DEFAULT 0;
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS due_amount NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN sales.studio_charges IS 'Sum of studio worker costs. Final bill = total + studio_charges. Balance due = total + studio_charges - paid_amount (customer only).';
COMMENT ON COLUMN sales.due_amount IS 'Customer balance due = total + studio_charges - paid_amount. Not affected by worker payments.';

-- Backfill due_amount from total - paid_amount where due_amount is 0 and studio_charges is 0
UPDATE sales
SET due_amount = GREATEST(0, COALESCE(total, 0) - COALESCE(paid_amount, 0))
WHERE (due_amount IS NULL OR due_amount = 0) AND COALESCE(studio_charges, 0) = 0;

-- Ensure studio_productions.sale_id exists (run first so functions/triggers/backfill can use it)
ALTER TABLE studio_productions ADD COLUMN IF NOT EXISTS sale_id UUID;

-- ----------------------------------------------------------------------------
-- 2. STUDIO_ORDERS (one per sale when studio production exists)
-- Legacy migration may have created studio_orders without sale_id; add columns.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS studio_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_worker_cost NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sale_id)
);

-- Add sale_id (and related columns) when table already exists from legacy (studio_orders_tables_if_not_exists)
ALTER TABLE studio_orders ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id) ON DELETE CASCADE;
ALTER TABLE studio_orders ADD COLUMN IF NOT EXISTS total_worker_cost NUMERIC(15,2) DEFAULT 0;
ALTER TABLE studio_orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE studio_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_orders_sale_id ON studio_orders(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_studio_orders_sale ON studio_orders(sale_id);
CREATE INDEX IF NOT EXISTS idx_studio_orders_status ON studio_orders(status);
COMMENT ON TABLE studio_orders IS 'One per studio sale. total_worker_cost = SUM(studio_tasks.cost). Synced to sales.studio_charges.';

-- ----------------------------------------------------------------------------
-- 3. STUDIO_TASKS (dyeing, stitching, handwork, embroidery, accessories, extra_expense)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE studio_task_type AS ENUM (
    'dyeing', 'stitching', 'handwork', 'embroidery',
    'accessories', 'extra_expense', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS studio_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_order_id UUID NOT NULL REFERENCES studio_orders(id) ON DELETE CASCADE,
  task_type VARCHAR(50) NOT NULL,
  worker_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_tasks_order ON studio_tasks(studio_order_id);
CREATE INDEX IF NOT EXISTS idx_studio_tasks_worker ON studio_tasks(worker_id);
CREATE INDEX IF NOT EXISTS idx_studio_tasks_status ON studio_tasks(status);
COMMENT ON TABLE studio_tasks IS 'Per-order tasks. Cost flows to studio_orders.total_worker_cost and sales.studio_charges.';

-- ----------------------------------------------------------------------------
-- 4. WORKER_PAYMENTS (accounting: worker payments separate from customer receipts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS worker_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_task_id UUID NOT NULL REFERENCES studio_tasks(id) ON DELETE RESTRICT,
  amount NUMERIC(15,2) NOT NULL,
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_payments_task ON worker_payments(studio_task_id);
CREATE INDEX IF NOT EXISTS idx_worker_payments_paid_at ON worker_payments(paid_at DESC);
COMMENT ON TABLE worker_payments IS 'Payments to workers. Separate from customer receipts. Does not affect sale balance_due.';

-- ----------------------------------------------------------------------------
-- 5. Accountability on studio_production_stages (if table exists)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_stages') THEN
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Sync: get total studio cost for a sale (from studio_tasks)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_sale_studio_cost_from_tasks(p_sale_id UUID)
RETURNS NUMERIC(15,2) AS $$
  SELECT COALESCE(SUM(t.cost), 0)::NUMERIC(15,2)
  FROM studio_tasks t
  INNER JOIN studio_orders o ON o.id = t.studio_order_id
  WHERE o.sale_id = p_sale_id;
$$ LANGUAGE sql STABLE;

-- Single source: prefer studio_tasks (studio_orders), else studio_production_stages (dynamic SQL so no parse-time dependency on sale_id)
CREATE OR REPLACE FUNCTION get_sale_studio_charges(p_sale_id UUID)
RETURNS NUMERIC(15,2) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_from_tasks NUMERIC(15,2);
  v_from_stages NUMERIC(15,2);
BEGIN
  v_from_tasks := get_sale_studio_cost_from_tasks(p_sale_id);
  IF v_from_tasks > 0 THEN RETURN v_from_tasks; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_productions' AND column_name = 'sale_id') THEN
    RETURN 0;
  END IF;
  EXECUTE 'SELECT COALESCE(SUM(s.cost), 0)::NUMERIC(15,2) FROM studio_production_stages s INNER JOIN studio_productions p ON p.id = s.production_id WHERE p.sale_id = $1'
    INTO v_from_stages USING p_sale_id;
  RETURN COALESCE(v_from_stages, 0);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Sync sales.studio_charges and sales.due_amount (customer balance only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_sale_studio_charges_for_sale(p_sale_id UUID)
RETURNS void AS $$
DECLARE
  v_studio_charges NUMERIC(15,2);
  v_total NUMERIC(15,2);
  v_paid NUMERIC(15,2);
  v_due NUMERIC(15,2);
BEGIN
  IF p_sale_id IS NULL THEN RETURN; END IF;

  v_studio_charges := get_sale_studio_charges(p_sale_id);

  SELECT total, paid_amount INTO v_total, v_paid
  FROM sales WHERE id = p_sale_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_total := COALESCE(v_total, 0);
  v_paid := COALESCE(v_paid, 0);
  v_due := GREATEST(0, (v_total + v_studio_charges) - v_paid);

  UPDATE sales
  SET studio_charges = v_studio_charges,
      due_amount = v_due,
      updated_at = NOW()
  WHERE id = p_sale_id;

  -- Auto status: final when production complete AND customer balance 0
  UPDATE sales
  SET status = CASE
    WHEN v_due <= 0 AND EXISTS (
      SELECT 1 FROM studio_orders o
      WHERE o.sale_id = sales.id AND o.status = 'delivered'
    ) THEN 'final'::sale_status
    ELSE sales.status
  END,
  updated_at = NOW()
  WHERE id = p_sale_id;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 8. Recalc studio_orders.total_worker_cost from its tasks
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_studio_order_total_cost(p_studio_order_id UUID)
RETURNS void AS $$
DECLARE
  v_sale_id UUID;
  v_total NUMERIC(15,2);
BEGIN
  IF p_studio_order_id IS NULL THEN RETURN; END IF;

  SELECT o.sale_id INTO v_sale_id
  FROM studio_orders o WHERE o.id = p_studio_order_id;
  IF v_sale_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(cost), 0) INTO v_total
  FROM studio_tasks WHERE studio_order_id = p_studio_order_id;

  UPDATE studio_orders
  SET total_worker_cost = v_total,
      updated_at = NOW()
  WHERE id = p_studio_order_id;

  PERFORM sync_sale_studio_charges_for_sale(v_sale_id);
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 9. Trigger: studio_tasks change → sync studio_order and sale
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_sync_studio_tasks()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.studio_order_id;
  ELSE
    v_order_id := NEW.studio_order_id;
  END IF;
  PERFORM sync_studio_order_total_cost(v_order_id);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_after_studio_task_sync ON studio_tasks;
CREATE TRIGGER trigger_after_studio_task_sync
  AFTER INSERT OR UPDATE OR DELETE ON studio_tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_sync_studio_tasks();

-- ----------------------------------------------------------------------------
-- 10. Trigger: studio_production_stages (existing path) → sync sale
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_sync_sale_studio_charges()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id UUID;
  v_production_id UUID;
BEGIN
  v_production_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.production_id ELSE NEW.production_id END;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_productions' AND column_name = 'sale_id') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  EXECUTE 'SELECT sale_id FROM studio_productions WHERE id = $1' INTO v_sale_id USING v_production_id;
  IF v_sale_id IS NOT NULL THEN
    PERFORM sync_sale_studio_charges_for_sale(v_sale_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_stages') THEN
    DROP TRIGGER IF EXISTS trigger_after_studio_stage_sync_sale ON studio_production_stages;
    CREATE TRIGGER trigger_after_studio_stage_sync_sale
      AFTER INSERT OR UPDATE OR DELETE ON studio_production_stages
      FOR EACH ROW EXECUTE FUNCTION trigger_sync_sale_studio_charges();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 11. record_customer_payment: use (total + studio_charges) for due_amount
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_customer_payment(
  p_company_id UUID,
  p_customer_id UUID,
  p_reference_id UUID,
  p_amount NUMERIC(15,2),
  p_account_id UUID,
  p_payment_method TEXT,
  p_payment_date DATE,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_branch_id UUID;
  v_ar_account_id UUID;
  v_payment_id UUID;
  v_journal_entry_id UUID;
  v_ref_no VARCHAR(100);
  v_method payment_method_enum;
  v_grand_total NUMERIC(15,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than 0');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_account_id AND company_id = p_company_id AND is_active = true) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive payment account');
  END IF;

  SELECT id, company_id, branch_id, customer_id, total, paid_amount, due_amount, studio_charges, invoice_no, status
    INTO v_sale
  FROM sales
  WHERE id = p_reference_id;

  IF v_sale.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sale not found');
  END IF;

  IF v_sale.company_id != p_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Sale does not belong to company');
  END IF;

  IF v_sale.status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot receive payment for cancelled sale');
  END IF;

  IF p_customer_id IS NOT NULL AND v_sale.customer_id IS NOT NULL AND v_sale.customer_id != p_customer_id THEN
    RETURN json_build_object('success', false, 'error', 'Sale does not belong to this customer');
  END IF;

  v_branch_id := v_sale.branch_id;
  v_grand_total := COALESCE(v_sale.total, 0) + COALESCE(v_sale.studio_charges, 0);

  v_method := CASE LOWER(TRIM(COALESCE(p_payment_method, 'cash')))
    WHEN 'bank' THEN 'bank'::payment_method_enum
    WHEN 'card' THEN 'card'::payment_method_enum
    WHEN 'wallet' THEN 'other'::payment_method_enum
    WHEN 'mobile_wallet' THEN 'other'::payment_method_enum
    ELSE 'cash'::payment_method_enum
  END;

  SELECT id INTO v_ar_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND (code = '1100' OR LOWER(name) LIKE '%receivable%')
  LIMIT 1;

  IF v_ar_account_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Accounts Receivable account not found. Configure chart of accounts.');
  END IF;

  BEGIN
    v_ref_no := get_next_document_number(p_company_id, v_branch_id, 'payment');
  EXCEPTION
    WHEN OTHERS THEN
      v_ref_no := 'PMT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END;

  INSERT INTO payments (
    company_id, branch_id, payment_type, reference_type, reference_id,
    amount, payment_method, payment_date, payment_account_id,
    reference_number, notes, created_by
  )
  VALUES (
    p_company_id, v_branch_id, 'received'::payment_type, 'sale', p_reference_id,
    p_amount, v_method, p_payment_date, p_account_id,
    v_ref_no, p_notes, p_created_by
  )
  RETURNING id INTO v_payment_id;

  INSERT INTO journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by
  )
  VALUES (
    p_company_id, v_branch_id,
    'JE-' || TO_CHAR(p_payment_date, 'YYYYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id)::TEXT, 4, '0'),
    p_payment_date,
    'Payment received: ' || COALESCE(v_sale.invoice_no, p_reference_id::TEXT),
    'payment',
    v_payment_id,
    p_created_by
  )
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, p_account_id, p_amount, 0, 'Payment received');

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_ar_account_id, 0, p_amount, 'Accounts Receivable decrease');

  -- Balance due = grand total (sale + studio cost) - customer payments only
  UPDATE sales
  SET
    paid_amount = COALESCE(paid_amount, 0) + p_amount,
    due_amount = GREATEST(0, v_grand_total - (COALESCE(paid_amount, 0) + p_amount)),
    payment_status = (CASE
      WHEN (COALESCE(paid_amount, 0) + p_amount) >= v_grand_total THEN 'paid'
      WHEN (COALESCE(paid_amount, 0) + p_amount) > 0 THEN 'partial'
      ELSE 'unpaid'
    END)::payment_status,
    updated_at = NOW()
  WHERE id = p_reference_id;

  RETURN json_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'journal_entry_id', v_journal_entry_id,
    'reference_number', v_ref_no
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION record_customer_payment(UUID, UUID, UUID, NUMERIC, UUID, TEXT, DATE, TEXT, UUID) IS
  'Atomic: payment, journal (Dr Cash/Bank, Cr A/R), update sale. Grand total = total + studio_charges. Worker payments do not affect due_amount.';

-- ----------------------------------------------------------------------------
-- 12. RPC: get_sale_studio_summary (for Sales Detail page)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_sale_studio_summary(p_sale_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_tasks RECORD;
  v_breakdown JSONB := '[]'::JSONB;
  v_tasks_done INT := 0;
  v_tasks_total INT := 0;
  v_started_at TIMESTAMPTZ;
  v_completed_at TIMESTAMPTZ;
  v_days INT;
  v_row RECORD;
  v_worker_name TEXT;
BEGIN
  IF p_sale_id IS NULL THEN
    RETURN json_build_object(
      'has_studio', false,
      'production_status', 'none',
      'total_studio_cost', 0,
      'tasks_completed', 0,
      'tasks_total', 0,
      'production_duration_days', NULL,
      'completed_at', NULL,
      'breakdown', '[]'::JSONB,
      'tasks_with_workers', '[]'::JSONB
    );
  END IF;

  SELECT o.id, o.sale_id, o.status, o.started_at, o.completed_at, o.total_worker_cost
  INTO v_order
  FROM studio_orders o
  WHERE o.sale_id = p_sale_id
  LIMIT 1;

  IF v_order.id IS NULL THEN
    -- Fallback: from studio_productions + studio_production_stages
    SELECT
      COALESCE(SUM(s.cost), 0)::NUMERIC(15,2) AS total_cost,
      MIN(p.start_date)::TIMESTAMPTZ AS started_at,
      MAX(s.completed_at) AS completed_at,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE s.status = 'completed') AS done
    INTO v_tasks
    FROM studio_production_stages s
    INNER JOIN studio_productions p ON p.id = s.production_id
    WHERE p.sale_id = p_sale_id;

    IF v_tasks.total IS NULL OR v_tasks.total = 0 THEN
      RETURN json_build_object(
        'has_studio', false,
        'production_status', 'none',
        'total_studio_cost', 0,
        'tasks_completed', 0,
        'tasks_total', 0,
        'production_duration_days', NULL,
        'completed_at', NULL,
        'breakdown', '[]'::JSONB,
        'tasks_with_workers', '[]'::JSONB
      );
    END IF;

    v_days := NULL;
    IF v_tasks.started_at IS NOT NULL AND v_tasks.completed_at IS NOT NULL THEN
      v_days := EXTRACT(DAY FROM (v_tasks.completed_at::timestamp - v_tasks.started_at::timestamp))::INT;
    END IF;

    RETURN json_build_object(
      'has_studio', true,
      'production_status', CASE WHEN v_tasks.done = v_tasks.total THEN 'completed' ELSE 'in_progress' END,
      'total_studio_cost', COALESCE(v_tasks.total_cost, 0),
      'tasks_completed', COALESCE(v_tasks.done, 0),
      'tasks_total', COALESCE(v_tasks.total, 0),
      'production_duration_days', v_days,
      'completed_at', v_tasks.completed_at,
      'breakdown', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'task_type', s.stage_type,
          'cost', s.cost,
          'worker_id', s.assigned_worker_id
        )), '[]'::JSONB)
        FROM studio_production_stages s
        INNER JOIN studio_productions p ON p.id = s.production_id
        WHERE p.sale_id = p_sale_id
      ),
      'tasks_with_workers', '[]'::JSONB
    );
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_tasks_total, v_tasks_done
  FROM studio_tasks
  WHERE studio_order_id = v_order.id;

  v_started_at := v_order.started_at;
  v_completed_at := v_order.completed_at;
  v_days := NULL;
  IF v_started_at IS NOT NULL AND v_completed_at IS NOT NULL THEN
    v_days := EXTRACT(DAY FROM (v_completed_at::timestamp - v_started_at::timestamp))::INT;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'task_type', t.task_type,
      'cost', t.cost,
      'worker_id', t.worker_id,
      'created_by', t.created_by,
      'completed_by', t.completed_by
    )
  ), '[]'::JSONB) INTO v_breakdown
  FROM studio_tasks t
  WHERE t.studio_order_id = v_order.id;

  RETURN json_build_object(
    'has_studio', true,
    'production_status', COALESCE(v_order.status, 'pending'),
    'total_studio_cost', COALESCE(v_order.total_worker_cost, 0),
    'tasks_completed', COALESCE(v_tasks_done, 0),
    'tasks_total', COALESCE(v_tasks_total, 0),
    'production_duration_days', v_days,
    'completed_at', v_completed_at,
    'breakdown', COALESCE(v_breakdown, '[]'::JSONB),
    'tasks_with_workers', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'task_type', t.task_type,
          'cost', t.cost,
          'worker_id', t.worker_id,
          'worker_name', c.name,
          'created_by', t.created_by,
          'completed_by', t.completed_by
        )
      ), '[]'::JSONB)
      FROM studio_tasks t
      LEFT JOIN contacts c ON c.id = t.worker_id
      WHERE t.studio_order_id = v_order.id
    )
  );
END;
$$;

COMMENT ON FUNCTION get_sale_studio_summary(UUID) IS 'Returns studio cost summary for Sales Detail: status, total cost, tasks count, duration, breakdown with worker names.';

-- ----------------------------------------------------------------------------
-- 12a. RPC: get_sale_studio_charges_batch (for Sales list – enrich due balance with studio cost)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_sale_studio_charges_batch(p_sale_ids UUID[])
RETURNS TABLE(sale_id UUID, studio_cost NUMERIC(15,2))
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  IF p_sale_ids IS NULL OR array_length(p_sale_ids, 1) IS NULL OR array_length(p_sale_ids, 1) = 0 THEN
    RETURN;
  END IF;
  -- From studio_production_stages + studio_productions (only when sale_id column exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_stages')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_productions' AND column_name = 'sale_id') THEN
    RETURN QUERY
    SELECT p.sale_id::UUID AS sale_id, COALESCE(SUM(s.cost), 0)::NUMERIC(15,2) AS studio_cost
    FROM studio_production_stages s
    INNER JOIN studio_productions p ON p.id = s.production_id
    WHERE p.sale_id = ANY(p_sale_ids)
    GROUP BY p.sale_id;
    RETURN;
  END IF;
  -- From studio_orders + studio_tasks if no stages table or no sale_id on productions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_orders') THEN
    RETURN QUERY
    SELECT o.sale_id AS sale_id, COALESCE(SUM(t.cost), 0)::NUMERIC(15,2) AS studio_cost
    FROM studio_orders o
    LEFT JOIN studio_tasks t ON t.studio_order_id = o.id
    WHERE o.sale_id = ANY(p_sale_ids)
    GROUP BY o.sale_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_sale_studio_charges_batch(UUID[]) IS 'Returns studio cost per sale_id for batch (sales list). Use to enrich sales so due balance = (total + studio_cost) - paid.';

-- ----------------------------------------------------------------------------
-- 12b. When a studio_production is linked to a sale, ensure studio_order exists
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ensure_studio_order_for_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM studio_orders o WHERE o.sale_id = NEW.sale_id) THEN
    INSERT INTO studio_orders (sale_id, status, company_id, branch_id, order_no, order_date, customer_id, customer_name)
    SELECT NEW.sale_id, 'pending'::studio_status, s.company_id, s.branch_id,
           COALESCE('STD-' || LEFT(NEW.sale_id::text, 8), 'STD'),
           COALESCE(s.invoice_date::date, CURRENT_DATE),
           s.customer_id, COALESCE(c.name, '')
    FROM sales s
    LEFT JOIN contacts c ON c.id = s.customer_id
    WHERE s.id = NEW.sale_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_productions') THEN
    DROP TRIGGER IF EXISTS trigger_ensure_studio_order_on_production ON studio_productions;
    CREATE TRIGGER trigger_ensure_studio_order_on_production
      AFTER INSERT ON studio_productions
      FOR EACH ROW EXECUTE FUNCTION ensure_studio_order_for_sale();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 13. Backfill: create studio_orders for sales that have studio_productions (only when sale_id column exists)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_productions' AND column_name = 'sale_id') THEN
    INSERT INTO studio_orders (sale_id, status, total_worker_cost, started_at, completed_at, company_id, branch_id, order_no, order_date, customer_id, customer_name)
    SELECT DISTINCT p.sale_id, 'in_progress'::studio_status, 0::numeric, NULL::timestamptz, NULL::timestamptz,
           s.company_id, s.branch_id, COALESCE('STD-' || LEFT(p.sale_id::text, 8), 'STD'),
           COALESCE(s.invoice_date::date, CURRENT_DATE), s.customer_id, COALESCE(c.name, '')
    FROM studio_productions p
    JOIN sales s ON s.id = p.sale_id
    LEFT JOIN contacts c ON c.id = s.customer_id
    WHERE p.sale_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM studio_orders o WHERE o.sale_id = p.sale_id);
  END IF;
END $$;

-- Update total_worker_cost from studio_production_stages where we have productions
DO $$
DECLARE
  r RECORD;
  v_sum NUMERIC(15,2);
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_stages')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_productions' AND column_name = 'sale_id') THEN
    FOR r IN SELECT o.id AS order_id, o.sale_id
             FROM studio_orders o
             WHERE EXISTS (SELECT 1 FROM studio_productions p WHERE p.sale_id = o.sale_id)
    LOOP
      SELECT COALESCE(SUM(s.cost), 0) INTO v_sum
      FROM studio_production_stages s
      INNER JOIN studio_productions p ON p.id = s.production_id
      WHERE p.sale_id = r.sale_id;
      UPDATE studio_orders SET total_worker_cost = v_sum, updated_at = NOW() WHERE id = r.order_id;
    END LOOP;
    FOR r IN SELECT sale_id FROM studio_orders
    LOOP
      PERFORM sync_sale_studio_charges_for_sale(r.sale_id);
    END LOOP;
  END IF;
END $$;
