-- ============================================================================
-- ERP STOCK SCHEMA DIAGNOSTIC
-- Run in Supabase SQL Editor to detect stock columns and purchase_status enum.
-- ============================================================================

-- STEP 1: product_variations columns (stock source for variations)
SELECT 'product_variations' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'product_variations'
ORDER BY ordinal_position;

-- STEP 2: products table columns (base product stock)
SELECT 'products' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
  AND column_name IN ('current_stock', 'stock', 'stock_quantity', 'min_stock')
ORDER BY ordinal_position;

-- STEP 3: stock_movements columns (aggregation fallback)
SELECT 'stock_movements' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'stock_movements'
ORDER BY ordinal_position;

-- STEP 4: purchase_status enum values (for Mark as Final)
SELECT unnest(enum_range(NULL::purchase_status)) AS purchase_status_value;

-- STEP 5: purchases table status column type
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'status';

-- STEP 6: Sample variation stock (if stock/stock_quantity exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_variations' AND column_name = 'stock') THEN
    RAISE NOTICE 'product_variations.stock exists. Sample: %', (SELECT COUNT(*) FROM product_variations);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_variations' AND column_name = 'stock_quantity') THEN
    RAISE NOTICE 'product_variations.stock_quantity exists.';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_variations' AND column_name = 'current_stock') THEN
    RAISE NOTICE 'product_variations.current_stock exists.';
  ELSE
    RAISE NOTICE 'No stock column in product_variations. Use stock_movements aggregation.';
  END IF;
END $$;

-- STEP 7: Trigger check
SELECT tgname AS trigger_name, tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgname = 'purchase_final_stock_movement_trigger';
