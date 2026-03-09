-- ============================================================================
-- TEST ONLY — STEP 4 & 5: Finished product inventory + Dr FG Cr Prod Exp
-- ============================================================================
-- When studio_productions.generated_product_id is set (Create Product + Generate Invoice):
-- 1) Calculate production cost and set actual_cost
-- 2) INSERT stock_movements: product_id=generated_product_id, quantity=+1, movement_type=PRODUCTION
-- 3) Journal: Dr Finished Goods Inventory, Cr Production Expense
-- Idempotent: skip if stock_movements already exist for this production (reference_type studio_production).
-- ============================================================================

-- Ensure columns exist (match studio_productions_generated_invoice_item.sql) so trigger WHEN clause is valid
ALTER TABLE studio_productions ADD COLUMN IF NOT EXISTS generated_product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE studio_productions ADD COLUMN IF NOT EXISTS generated_invoice_item_id UUID;

-- Allow PRODUCTION movement type in stock_movements (test DB)
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
  WHERE conrelid = 'stock_movements'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%movement_type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS %I', cname);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'stock_movements'::regclass AND conname = 'stock_movements_movement_type_check') THEN
    ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_movement_type_check
      CHECK (movement_type IN ('PURCHASE','SALE','RETURN','ADJUSTMENT','TRANSFER','SELL_RETURN','PURCHASE_RETURN','RENTAL_OUT','RENTAL_RETURN','PRODUCTION'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- constraint may already exist or CHECK may differ
END $$;

CREATE OR REPLACE FUNCTION studio_on_generate_invoice_inventory_and_journal_test()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost NUMERIC;
  v_fg_account_id UUID;
  v_expense_account_id UUID;
  v_je_id UUID;
  v_entry_no TEXT;
  v_exists INT;
  v_qty NUMERIC;
BEGIN
  -- Only when generated_product_id is set (and we have a product to receive)
  IF NEW.generated_product_id IS NULL THEN RETURN NEW; END IF;

  v_qty := COALESCE(NEW.quantity, 1)::NUMERIC;
  IF v_qty <= 0 THEN v_qty := 1; END IF;

  -- Idempotent: skip if we already have PRODUCTION movement for this production
  SELECT COUNT(*) INTO v_exists FROM stock_movements
  WHERE reference_type = 'studio_production' AND reference_id = NEW.id
    AND movement_type = 'PRODUCTION';
  IF v_exists > 0 THEN RETURN NEW; END IF;

  -- 1) Calculate and set actual_cost
  v_cost := calculate_production_cost(NEW.id);
  IF v_cost IS NULL THEN v_cost := 0; END IF;

  -- 2) Insert stock_movements (finished good IN)
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

  -- 3) Journal: Dr Finished Goods Inventory (1220), Cr Production Expense (5000)
  SELECT id INTO v_fg_account_id FROM accounts WHERE company_id = NEW.company_id AND code = '1220' AND is_active = true LIMIT 1;
  SELECT id INTO v_expense_account_id FROM accounts WHERE company_id = NEW.company_id AND code = '5000' AND is_active = true LIMIT 1;
  IF v_fg_account_id IS NULL OR v_expense_account_id IS NULL THEN RETURN NEW; END IF;

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_studio_generate_invoice_inventory_journal_test ON studio_productions;
CREATE TRIGGER trigger_studio_generate_invoice_inventory_journal_test
  AFTER UPDATE ON studio_productions
  FOR EACH ROW
  WHEN (
    OLD.generated_product_id IS DISTINCT FROM NEW.generated_product_id
    AND NEW.generated_product_id IS NOT NULL
  )
  EXECUTE FUNCTION studio_on_generate_invoice_inventory_and_journal_test();

COMMENT ON FUNCTION studio_on_generate_invoice_inventory_and_journal_test() IS 'TEST: On Generate Invoice (generated_product_id set): stock IN + Dr FG Cr Prod Exp. Idempotent.';
