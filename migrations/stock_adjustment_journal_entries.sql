-- Phase 1 Accounting Engine: Ensure stock adjustments generate journal entries.
-- Trigger on stock_movements: when movement_type = 'adjustment', create one JE (reference_type = 'stock_adjustment', reference_id = movement id).
-- Uses inventory account (code 1200 or type inventory) and inventory adjustment / expense account (code 5100 or expense).
-- If required accounts are missing, skips JE and logs warning (adjustment and stock_movements still succeed).

CREATE OR REPLACE FUNCTION post_stock_adjustment_to_accounting()
RETURNS TRIGGER AS $$
DECLARE
  v_inventory_account_id UUID;
  v_adjustment_account_id UUID;
  v_journal_id UUID;
  v_amount DECIMAL(15,2);
  v_entry_no TEXT;
  v_notes TEXT;
BEGIN
  IF NEW.movement_type IS DISTINCT FROM 'adjustment' THEN
    RETURN NEW;
  END IF;

  -- Avoid duplicate JE for same movement
  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE reference_type = 'stock_adjustment' AND reference_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Amount: use total_cost if set, else quantity * unit_cost (can be 0)
  v_amount := COALESCE(NULLIF(NEW.total_cost, 0), NEW.quantity * COALESCE(NEW.unit_cost, 0), 0);

  -- Inventory account: code 1200 or type inventory
  SELECT id INTO v_inventory_account_id
  FROM accounts
  WHERE company_id = NEW.company_id AND is_active = true
  AND (code = '1200' OR LOWER(COALESCE(type, '')) = 'inventory')
  LIMIT 1;

  -- Adjustment/expense account: code 5100 or similar expense
  SELECT id INTO v_adjustment_account_id
  FROM accounts
  WHERE company_id = NEW.company_id AND is_active = true
  AND (
    code IN ('5100', '5110', '5120', '6000', '6100')
    OR LOWER(COALESCE(type, '')) IN ('expense', 'cost')
  )
  LIMIT 1;

  IF v_inventory_account_id IS NULL THEN
    RAISE WARNING 'post_stock_adjustment_to_accounting: No inventory account (1200) for company %. Skipping journal for movement %', NEW.company_id, NEW.id;
    RETURN NEW;
  END IF;

  IF v_adjustment_account_id IS NULL THEN
    RAISE WARNING 'post_stock_adjustment_to_accounting: No adjustment/expense account for company %. Skipping journal for movement %', NEW.company_id, NEW.id;
    RETURN NEW;
  END IF;

  v_notes := COALESCE(NEW.notes, 'Stock adjustment');
  v_entry_no := 'ADJ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::TEXT, 1, 8);

  INSERT INTO journal_entries (
    company_id,
    branch_id,
    entry_no,
    entry_date,
    description,
    reference_type,
    reference_id,
    created_by
  ) VALUES (
    NEW.company_id,
    NEW.branch_id,
    v_entry_no,
    (NEW.created_at AT TIME ZONE 'UTC')::DATE,
    'Stock adjustment: ' || v_notes,
    'stock_adjustment',
    NEW.id,
    NEW.created_by
  ) RETURNING id INTO v_journal_id;

  IF v_amount >= 0 THEN
    -- Increase in stock: Dr Inventory, Cr Adjustment (expense reduction)
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_inventory_account_id, v_amount, 0, 'Inventory increase - ' || v_notes);
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_adjustment_account_id, 0, v_amount, 'Stock adjustment - ' || v_notes);
  ELSE
    -- Decrease in stock: Cr Inventory, Dr Adjustment (expense)
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_adjustment_account_id, (-v_amount), 0, 'Stock adjustment - ' || v_notes);
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_inventory_account_id, 0, (-v_amount), 'Inventory decrease - ' || v_notes);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_post_stock_adjustment_to_accounting ON stock_movements;
CREATE TRIGGER trigger_post_stock_adjustment_to_accounting
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION post_stock_adjustment_to_accounting();
