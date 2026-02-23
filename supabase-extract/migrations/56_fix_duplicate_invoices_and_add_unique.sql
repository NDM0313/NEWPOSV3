-- ============================================
-- Fix duplicate invoice_no then add UNIQUE constraint
-- ============================================
-- For duplicates: append -id suffix to make unique. Keeps first row as-is.
-- ============================================

-- Fix sales: for each duplicate group, keep first row, suffix the rest
WITH duplicates AS (
  SELECT id, company_id, branch_id, invoice_no,
    ROW_NUMBER() OVER (PARTITION BY company_id, branch_id, invoice_no ORDER BY created_at, id) as rn
  FROM sales
  WHERE invoice_no IS NOT NULL
)
UPDATE sales s
SET invoice_no = d.invoice_no || '-' || SUBSTRING(d.id::text, 1, 8)
FROM duplicates d
WHERE s.id = d.id AND d.rn > 1;

-- Now add UNIQUE constraint (safe - no duplicates)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_company_branch_invoice_unique') THEN
    ALTER TABLE sales ADD CONSTRAINT sales_company_branch_invoice_unique
      UNIQUE (company_id, branch_id, invoice_no);
    RAISE NOTICE 'Added UNIQUE(company_id, branch_id, invoice_no) on sales';
  END IF;
END $$;
