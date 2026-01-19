-- ============================================================================
-- END-TO-END VERIFICATION SCRIPT
-- ============================================================================
-- Run this AFTER all setup scripts to verify everything works
-- ============================================================================

-- ============================================================================
-- VERIFICATION 1: BASE SETUP
-- ============================================================================

SELECT 
    'PHASE 1: BASE SETUP' as phase,
    CASE 
        WHEN (SELECT COUNT(*) FROM companies WHERE id = '00000000-0000-0000-0000-000000000001'::uuid) > 0 
        THEN '✅ Company exists'
        ELSE '❌ Company missing'
    END as company_check,
    CASE 
        WHEN (SELECT COUNT(*) FROM branches WHERE id = '00000000-0000-0000-0000-000000000011'::uuid) > 0 
        THEN '✅ Branch exists'
        ELSE '❌ Branch missing'
    END as branch_check,
    CASE 
        WHEN (SELECT COUNT(*) FROM users WHERE email = 'admin@dincollection.com') > 0 
        THEN '✅ User exists'
        ELSE '❌ User missing'
    END as user_check;

-- ============================================================================
-- VERIFICATION 2: DATA INTEGRITY
-- ============================================================================

SELECT 
    'PHASE 2: DATA INTEGRITY' as phase,
    CASE 
        WHEN (SELECT COUNT(*) FROM users WHERE company_id IS NULL) = 0 
        THEN '✅ All users have company_id'
        ELSE '❌ Some users missing company_id'
    END as company_id_check,
    CASE 
        WHEN (SELECT COUNT(*) FROM branches WHERE company_id IS NULL) = 0 
        THEN '✅ All branches have company_id'
        ELSE '❌ Some branches missing company_id'
    END as branch_company_check,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'company_id'
        )
        THEN '✅ company_id column exists'
        ELSE '❌ company_id column missing'
    END as column_check;

-- ============================================================================
-- VERIFICATION 3: CORE ENTITIES
-- ============================================================================

SELECT 
    'PHASE 3: CORE ENTITIES' as phase,
    (SELECT COUNT(*) FROM contacts WHERE type = 'supplier' AND company_id = '00000000-0000-0000-0000-000000000001'::uuid) as suppliers_count,
    (SELECT COUNT(*) FROM contacts WHERE type = 'customer' AND company_id = '00000000-0000-0000-0000-000000000001'::uuid) as customers_count,
    (SELECT COUNT(*) FROM products WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid) as products_count,
    (SELECT COUNT(*) FROM product_categories WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid) as categories_count;

-- ============================================================================
-- VERIFICATION 4: TRANSACTIONS
-- ============================================================================

SELECT 
    'PHASE 4: TRANSACTIONS' as phase,
    (SELECT COUNT(*) FROM sales WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid) as sales_count,
    (SELECT COUNT(*) FROM sale_items) as sale_items_count,
    (SELECT COUNT(*) FROM payments WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid) as payments_count,
    (SELECT COUNT(*) FROM journal_entries WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid) as journal_entries_count;

-- ============================================================================
-- VERIFICATION 5: RECENT ACTIVITY
-- ============================================================================

SELECT 
    'PHASE 5: RECENT ACTIVITY' as phase,
    (SELECT COUNT(*) FROM products WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid AND created_at > NOW() - INTERVAL '1 hour') as recent_products,
    (SELECT COUNT(*) FROM sales WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid AND created_at > NOW() - INTERVAL '1 hour') as recent_sales,
    (SELECT COUNT(*) FROM contacts WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid AND created_at > NOW() - INTERVAL '1 hour') as recent_contacts;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

SELECT 
    'FINAL SUMMARY' as report,
    (SELECT COUNT(*) FROM companies) as total_companies,
    (SELECT COUNT(*) FROM branches) as total_branches,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM contacts) as total_contacts,
    (SELECT COUNT(*) FROM products) as total_products,
    (SELECT COUNT(*) FROM sales) as total_sales,
    (SELECT COUNT(*) FROM payments) as total_payments;
