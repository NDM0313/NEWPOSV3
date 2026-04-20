-- Fix: Studio sales with NULL invoice_no — copy from order_no
-- Studio sales store their number in order_no (STD-XXXX) but customer ledger needs invoice_no
UPDATE sales
SET invoice_no = order_no
WHERE is_studio = true
  AND invoice_no IS NULL
  AND order_no IS NOT NULL;
