-- ============================================================================
-- TEST ONLY — Fix Studio Production Cost Calculation
-- ============================================================================
-- 1) calculate_production_cost: SUM(stage.cost) + fabric from sales_items
-- 2) Trigger: run calculate_production_cost BEFORE FG inventory; block if cost=0 but stages have cost
-- 3) Backfill existing productions where actual_cost = 0
-- 4) Idempotent: no duplicate movements/entries
-- Do NOT run on production until verified.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Production cost function (replaces existing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_production_cost(p_production_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod RECORD;
  v_stage_cost NUMERIC := 0;
  v_fabric_cost NUMERIC := 0;
  v_total NUMERIC := 0;
BEGIN
  SELECT id, company_id, branch_id, sale_id, product_id, quantity
  INTO v_prod
  FROM studio_productions
  WHERE id = p_production_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Worker stage costs (studio_production_stages.cost)
  SELECT COALESCE(SUM(COALESCE(cost, 0)), 0) INTO v_stage_cost
  FROM studio_production_stages
  WHERE production_id = p_production_id;

  -- Fabric cost from related sale: sales_items (primary) or sale_items (legacy)
  IF v_prod.sale_id IS NOT NULL AND v_prod.product_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_items') THEN
      SELECT COALESCE(SUM(COALESCE(unit_price, 0) * COALESCE(quantity, 1)), 0) INTO v_fabric_cost
      FROM sales_items
      WHERE sale_id = v_prod.sale_id AND product_id = v_prod.product_id;
    END IF;
    IF v_fabric_cost = 0 AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sale_items') THEN
      SELECT COALESCE(SUM(COALESCE(unit_price, price, 0) * COALESCE(quantity, 1)), 0) INTO v_fabric_cost
      FROM sale_items
      WHERE sale_id = v_prod.sale_id AND product_id = v_prod.product_id;
    END IF;
  END IF;

  v_total := v_stage_cost + v_fabric_cost;
  IF v_total < 0 THEN v_total := 0; END IF;

  UPDATE studio_productions
  SET actual_cost = v_total, updated_at = NOW()
  WHERE id = p_production_id;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION calculate_production_cost(UUID) IS 'Production cost = SUM(studio_production_stages.cost) + fabric from sales_items/sale_items. Updates actual_cost.';

-- ---------------------------------------------------------------------------
-- 2) Trigger: run cost calc first; safety check; then FG inventory + journal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION studio_on_generate_invoice_inventory_and_journal_test()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost NUMERIC;
  v_stage_sum NUMERIC;
  v_fg_account_id UUID;
  v_expense_account_id UUID;
  v_je_id UUID;
  v_entry_no TEXT;
  v_exists INT;
  v_qty NUMERIC;
BEGIN
  IF NEW.generated_product_id IS NULL THEN RETURN NEW; END IF;

  -- BEFORE generating inventory: recalculate and set actual_cost
  v_cost := calculate_production_cost(NEW.id);
  IF v_cost IS NULL THEN v_cost := 0; END IF;

  -- Safety: block if actual_cost = 0 but stage costs exist (prevents incorrect FG/COGS)
  SELECT COALESCE(SUM(COALESCE(cost, 0)), 0) INTO v_stage_sum
  FROM studio_production_stages WHERE production_id = NEW.id;
  IF v_cost = 0 AND v_stage_sum > 0 THEN
    RAISE EXCEPTION 'Production cost is 0 but stage costs exist (%). Confirm stage costs or add fabric line to sale before Generate Invoice.', v_stage_sum;
  END IF;

  v_qty := COALESCE(NEW.quantity, 1)::NUMERIC;
  IF v_qty <= 0 THEN v_qty := 1; END IF;

  -- Idempotent: skip if we already have PRODUCTION movement for this production
  SELECT COUNT(*) INTO v_exists FROM stock_movements
  WHERE reference_type = 'studio_production' AND reference_id = NEW.id
    AND movement_type = 'PRODUCTION';
  IF v_exists > 0 THEN RETURN NEW; END IF;

  -- Stock: +1 PRODUCTION, cost = actual_cost
  INSERT INTO stock_movements (
    company_id, branch_id, product_id, quantity, unit_cost, total_cost,
    movement_type, reference_type, reference_id, notes, created_at
  ) VALUES (
    NEW.company_id, NEW.branch_id, NEW.generated_product_id,
    v_qty, CASE WHEN v_qty > 0 THEN v_cost / v_qty ELSE 0 END, v_cost,
    'PRODUCTION', 'studio_production', NEW.id,
    'Production ' || COALESCE(NEW.production_no, NEW.id::TEXT) || ' – finished goods',
    NOW()
  );

  -- Journal: Dr FG (1220), Cr Production Expense (5000) — idempotent: one JE per production
  SELECT COUNT(*) INTO v_exists FROM journal_entries
  WHERE reference_type = 'studio_production' AND reference_id = NEW.id
    AND description LIKE 'Finished goods%';
  IF v_exists > 0 THEN RETURN NEW; END IF;

  SELECT id INTO v_fg_account_id FROM accounts WHERE company_id = NEW.company_id AND code = '1220' AND is_active = true LIMIT 1;
  SELECT id INTO v_expense_account_id FROM accounts WHERE company_id = NEW.company_id AND code = '5000' AND is_active = true LIMIT 1;
  IF v_fg_account_id IS NOT NULL AND v_expense_account_id IS NOT NULL AND v_cost > 0 THEN
    v_entry_no := 'JE-STD-FG-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
    INSERT INTO journal_entries (company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual)
    VALUES (
      NEW.company_id, NEW.branch_id, v_entry_no, CURRENT_DATE,
      'Finished goods – Production ' || COALESCE(NEW.production_no, NEW.id::TEXT),
      'studio_production', NEW.id, v_cost, v_cost, true, NOW(), false
    )
    RETURNING id INTO v_je_id;
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES
      (v_je_id, v_fg_account_id, v_cost, 0, 'Finished goods – ' || COALESCE(NEW.production_no, NEW.id::TEXT)),
      (v_je_id, v_expense_account_id, 0, v_cost, 'Production expense transfer – ' || COALESCE(NEW.production_no, NEW.id::TEXT));
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure column exists so trigger WHEN clause is valid
ALTER TABLE studio_productions ADD COLUMN IF NOT EXISTS generated_product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE studio_productions ADD COLUMN IF NOT EXISTS generated_invoice_item_id UUID;

DROP TRIGGER IF EXISTS trigger_studio_generate_invoice_inventory_journal_test ON studio_productions;
CREATE TRIGGER trigger_studio_generate_invoice_inventory_journal_test
  AFTER UPDATE ON studio_productions
  FOR EACH ROW
  WHEN (
    OLD.generated_product_id IS DISTINCT FROM NEW.generated_product_id
    AND NEW.generated_product_id IS NOT NULL
  )
  EXECUTE FUNCTION studio_on_generate_invoice_inventory_and_journal_test();

-- ---------------------------------------------------------------------------
-- 3) Backfill: recalculate actual_cost where 0 or NULL (idempotent)
-- ---------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT id FROM studio_productions WHERE actual_cost IS NULL OR actual_cost = 0)
  LOOP
    PERFORM calculate_production_cost(r.id);
  END LOOP;
END $$;

COMMENT ON FUNCTION studio_on_generate_invoice_inventory_and_journal_test() IS 'On Generate Invoice: calculate_production_cost first; block if cost=0 but stages have cost; then PRODUCTION stock + Dr FG Cr Prod Exp. Idempotent.';
