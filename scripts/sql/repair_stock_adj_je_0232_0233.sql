-- Repair zero-amount stock_adjustment journal lines using product/variation cost_price.
-- Safe: updates movement costs + existing line amounts only (no void/repost).

DO $$
DECLARE
  r RECORD;
  v_qty numeric;
  v_unit numeric;
  v_amt numeric;
  v_inv uuid;
  v_adj uuid;
  v_signed numeric;
BEGIN
  FOR r IN
    SELECT je.id AS je_id,
           je.company_id,
           je.reference_id AS movement_id,
           sm.quantity,
           sm.product_id,
           sm.variation_id
    FROM journal_entries je
    JOIN stock_movements sm ON sm.id = je.reference_id
    WHERE je.reference_type = 'stock_adjustment'
      AND COALESCE(je.is_void, false) = false
      AND je.entry_no IN ('JE-0232', 'JE-0233')
      AND NOT EXISTS (
        SELECT 1 FROM journal_entry_lines jel
        WHERE jel.journal_entry_id = je.id
          AND (COALESCE(jel.debit, 0) > 0 OR COALESCE(jel.credit, 0) > 0)
      )
  LOOP
    v_qty := ABS(COALESCE(r.quantity, 0));
    v_unit := 0;

    IF r.variation_id IS NOT NULL THEN
      SELECT COALESCE(pv.cost_price, pv.purchase_price, 0)
        INTO v_unit
      FROM product_variations pv
      WHERE pv.id = r.variation_id;
    END IF;

    IF COALESCE(v_unit, 0) = 0 AND r.product_id IS NOT NULL THEN
      SELECT COALESCE(p.cost_price, 0)
        INTO v_unit
      FROM products p
      WHERE p.id = r.product_id;
    END IF;

    v_amt := round((v_qty * COALESCE(v_unit, 0))::numeric, 2);
    IF v_amt <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE stock_movements
    SET unit_cost = v_unit,
        total_cost = v_amt
    WHERE id = r.movement_id;

    SELECT a.id INTO v_inv
    FROM accounts a
    WHERE a.company_id = r.company_id
      AND COALESCE(a.is_active, true)
      AND (trim(COALESCE(a.code, '')) = '1200' OR lower(COALESCE(a.type, '')) = 'inventory')
    LIMIT 1;

    SELECT a.id INTO v_adj
    FROM accounts a
    WHERE a.company_id = r.company_id
      AND COALESCE(a.is_active, true)
      AND (
        trim(COALESCE(a.code, '')) IN ('5000', '5100', '5110', '5120', '6000', '6100')
        OR lower(COALESCE(a.type, '')) IN ('expense', 'cost')
      )
    LIMIT 1;

    IF v_inv IS NULL OR v_adj IS NULL THEN
      RAISE WARNING 'Repair skip JE % — missing accounts', r.je_id;
      CONTINUE;
    END IF;

    v_signed := COALESCE((SELECT quantity FROM stock_movements WHERE id = r.movement_id), 0);

    UPDATE journal_entry_lines jel
    SET debit = CASE
          WHEN (v_signed >= 0 AND jel.account_id = v_inv) OR (v_signed < 0 AND jel.account_id = v_adj) THEN v_amt
          ELSE 0
        END,
        credit = CASE
          WHEN (v_signed >= 0 AND jel.account_id = v_adj) OR (v_signed < 0 AND jel.account_id = v_inv) THEN v_amt
          ELSE 0
        END
    WHERE jel.journal_entry_id = r.je_id
      AND jel.account_id IN (v_inv, v_adj);

    RAISE NOTICE 'Repaired stock_adjustment JE % movement % amount %', r.je_id, r.movement_id, v_amt;
  END LOOP;
END $$;

SELECT je.entry_no,
       je.reference_type,
       jel.debit,
       jel.credit,
       sm.quantity,
       sm.unit_cost,
       sm.total_cost
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
LEFT JOIN stock_movements sm ON sm.id = je.reference_id
WHERE je.entry_no IN ('JE-0232', 'JE-0233')
  AND je.reference_type = 'stock_adjustment'
  AND COALESCE(je.is_void, false) = false;
