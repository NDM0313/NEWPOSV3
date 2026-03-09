-- ============================================================================
-- TEST ONLY — STEP 7: Sale final COGS accounting
-- ============================================================================
-- When sale status becomes FINAL: in addition to existing (stock OUT + revenue journal),
-- create journal: Dr Cost of Goods Sold (5100), Cr Finished Goods Inventory (1220).
-- Amount = total cost of goods sold (studio production actual_cost for studio lines, else 0 or product cost).
-- Idempotent: skip if COGS journal already exists for this sale.
-- ============================================================================

CREATE OR REPLACE FUNCTION sale_final_cogs_journal_test()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cogs_account_id UUID;
  v_fg_account_id UUID;
  v_total_cogs NUMERIC := 0;
  v_je_id UUID;
  v_entry_no TEXT;
  v_already INT;
BEGIN
  IF (NEW.status IS DISTINCT FROM 'final') OR (OLD.status = 'final') THEN RETURN NEW; END IF;

  -- Idempotent: already have a COGS journal for this sale?
  SELECT COUNT(*) INTO v_already FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.reference_type = 'sale' AND je.reference_id = NEW.id AND a.code = '5100';
  IF v_already > 0 THEN RETURN NEW; END IF;

  -- Sum COGS: studio productions linked to this sale (actual_cost per production)
  SELECT COALESCE(SUM(actual_cost), 0) INTO v_total_cogs
  FROM studio_productions
  WHERE sale_id = NEW.id AND generated_invoice_item_id IS NOT NULL AND actual_cost > 0;
  IF v_total_cogs <= 0 THEN RETURN NEW; END IF;

  SELECT id INTO v_cogs_account_id FROM accounts WHERE company_id = NEW.company_id AND code = '5100' AND is_active = true LIMIT 1;
  SELECT id INTO v_fg_account_id FROM accounts WHERE company_id = NEW.company_id AND code = '1220' AND is_active = true LIMIT 1;
  IF v_cogs_account_id IS NULL OR v_fg_account_id IS NULL THEN RETURN NEW; END IF;

  v_entry_no := 'JE-COGS-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
  INSERT INTO journal_entries (company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual)
  VALUES (
    NEW.company_id, NEW.branch_id, v_entry_no, CURRENT_DATE,
    'COGS – Invoice ' || COALESCE(NEW.invoice_no, NEW.id::TEXT),
    'sale', NEW.id, v_total_cogs, v_total_cogs, true, NOW(), false
  )
  RETURNING id INTO v_je_id;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_je_id, v_cogs_account_id, v_total_cogs, 0, 'Cost of goods sold – ' || COALESCE(NEW.invoice_no, NEW.id::TEXT)),
    (v_je_id, v_fg_account_id, 0, v_total_cogs, 'Finished goods – ' || COALESCE(NEW.invoice_no, NEW.id::TEXT));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sale_final_cogs_journal_test ON sales;
CREATE TRIGGER trigger_sale_final_cogs_journal_test
  AFTER UPDATE ON sales
  FOR EACH ROW
  WHEN (NEW.status = 'final' AND (OLD.status IS NULL OR OLD.status != 'final'))
  EXECUTE FUNCTION sale_final_cogs_journal_test();

COMMENT ON FUNCTION sale_final_cogs_journal_test() IS 'TEST: On sale final, post Dr COGS Cr FG. Idempotent.';
