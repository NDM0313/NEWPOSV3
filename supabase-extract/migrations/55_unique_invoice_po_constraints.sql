-- ============================================
-- UNIQUE constraints for invoice_no and po_no
-- ============================================
-- Prevents duplicate invoice/PO numbers per company+branch.
-- Run only when no duplicates exist. If migration fails, fix duplicates first.
-- ============================================

-- Sales: unique invoice per company+branch
-- (Skip if constraint already exists or duplicates present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_company_branch_invoice_unique'
  ) THEN
    -- Check for duplicates first
    IF NOT EXISTS (
      SELECT 1 FROM (
        SELECT company_id, branch_id, invoice_no, COUNT(*) as cnt
        FROM sales
        WHERE invoice_no IS NOT NULL AND invoice_no != ''
        GROUP BY company_id, branch_id, invoice_no
        HAVING COUNT(*) > 1
      ) dup
    ) THEN
      ALTER TABLE sales ADD CONSTRAINT sales_company_branch_invoice_unique
        UNIQUE (company_id, branch_id, invoice_no);
      RAISE NOTICE 'Added UNIQUE(company_id, branch_id, invoice_no) on sales';
    ELSE
      RAISE WARNING 'Cannot add UNIQUE: duplicate invoice_no found in sales. Fix duplicates first.';
    END IF;
  END IF;
END $$;

-- Purchases: unique po_no per company+branch
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_company_branch_po_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM (
        SELECT company_id, branch_id, po_no, COUNT(*) as cnt
        FROM purchases
        WHERE po_no IS NOT NULL AND po_no != ''
        GROUP BY company_id, branch_id, po_no
        HAVING COUNT(*) > 1
      ) dup
    ) THEN
      ALTER TABLE purchases ADD CONSTRAINT purchases_company_branch_po_unique
        UNIQUE (company_id, branch_id, po_no);
      RAISE NOTICE 'Added UNIQUE(company_id, branch_id, po_no) on purchases';
    ELSE
      RAISE WARNING 'Cannot add UNIQUE: duplicate po_no found in purchases. Fix duplicates first.';
    END IF;
  END IF;
END $$;
