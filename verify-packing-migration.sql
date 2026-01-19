-- ============================================================================
-- VERIFICATION SCRIPT: Packing Columns Migration
-- ============================================================================
-- Purpose: Verify that packing columns were added successfully
-- Date: January 2026
--
-- Run this script in Supabase SQL Editor after executing the migration
-- ============================================================================

-- ============================================================================
-- STEP 1: Verify sale_items columns
-- ============================================================================
SELECT 
    'sale_items' AS table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'sale_items'
AND column_name LIKE 'packing%'
ORDER BY column_name;

-- Expected: 4 rows
-- - packing_details (jsonb)
-- - packing_quantity (numeric)
-- - packing_type (character varying)
-- - packing_unit (character varying)

-- ============================================================================
-- STEP 2: Verify purchase_items columns
-- ============================================================================
SELECT 
    'purchase_items' AS table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'purchase_items'
AND column_name LIKE 'packing%'
ORDER BY column_name;

-- Expected: 4 rows
-- - packing_details (jsonb)
-- - packing_quantity (numeric)
-- - packing_type (character varying)
-- - packing_unit (character varying)

-- ============================================================================
-- STEP 3: Check column comments (documentation)
-- ============================================================================
SELECT 
    'sale_items' AS table_name,
    column_name,
    col_description(pgc.oid, ordinal_position) AS column_comment
FROM information_schema.columns isc
JOIN pg_class pgc ON pgc.relname = isc.table_name
WHERE isc.table_name = 'sale_items'
AND isc.column_name LIKE 'packing%'
ORDER BY isc.column_name;

SELECT 
    'purchase_items' AS table_name,
    column_name,
    col_description(pgc.oid, ordinal_position) AS column_comment
FROM information_schema.columns isc
JOIN pg_class pgc ON pgc.relname = isc.table_name
WHERE isc.table_name = 'purchase_items'
AND isc.column_name LIKE 'packing%'
ORDER BY isc.column_name;

-- ============================================================================
-- STEP 4: Check if any data exists (after testing)
-- ============================================================================
-- This will return empty if no packing data has been saved yet
-- That's OK - it just means you haven't tested the feature yet

SELECT 
    'sale_items with packing data' AS description,
    COUNT(*) AS count
FROM sale_items
WHERE packing_details IS NOT NULL
   OR packing_type IS NOT NULL
   OR packing_quantity IS NOT NULL
   OR packing_unit IS NOT NULL;

SELECT 
    'purchase_items with packing data' AS description,
    COUNT(*) AS count
FROM purchase_items
WHERE packing_details IS NOT NULL
   OR packing_type IS NOT NULL
   OR packing_quantity IS NOT NULL
   OR packing_unit IS NOT NULL;

-- ============================================================================
-- STEP 5: Sample query to see packing data structure (if data exists)
-- ============================================================================
-- Uncomment and run after you've created a sale/purchase with packing data

/*
SELECT 
    si.id,
    si.product_name,
    si.packing_type,
    si.packing_quantity,
    si.packing_unit,
    si.packing_details,
    s.invoice_no,
    s.invoice_date
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
WHERE si.packing_details IS NOT NULL
LIMIT 5;

SELECT 
    pi.id,
    pi.product_name,
    pi.packing_type,
    pi.packing_quantity,
    pi.packing_unit,
    pi.packing_details,
    p.po_number,
    p.po_date
FROM purchase_items pi
JOIN purchases p ON p.id = pi.purchase_id
WHERE pi.packing_details IS NOT NULL
LIMIT 5;
*/

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================
-- If all steps return expected results:
-- ✅ Migration successful!
-- 
-- If columns are missing:
-- ❌ Migration not executed - Run add_packing_columns.sql
--
-- If you see errors:
-- ❌ Check error messages and troubleshoot
-- ============================================================================
