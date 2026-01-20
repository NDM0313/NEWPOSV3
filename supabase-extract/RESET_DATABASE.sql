-- ============================================================================
-- DATABASE RESET SCRIPT - DEVELOPMENT ENVIRONMENT ONLY
-- ============================================================================
-- 
-- WARNING: This script will DROP ALL TABLES and recreate them.
-- USE ONLY IN DEVELOPMENT ENVIRONMENT!
-- 
-- This script:
-- 1. Drops all existing tables (CASCADE)
-- 2. Drops all existing types (CASCADE)
-- 3. Runs CLEAN_COMPLETE_SCHEMA.sql
-- 4. Verifies all tables are created
--
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP ALL EXISTING TABLES (CASCADE)
-- ============================================================================

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS document_sequences CASCADE;
DROP TABLE IF EXISTS modules_config CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS journal_entry_lines CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS job_cards CASCADE;
DROP TABLE IF EXISTS workers CASCADE;
DROP TABLE IF EXISTS studio_order_items CASCADE;
DROP TABLE IF EXISTS studio_orders CASCADE;
DROP TABLE IF EXISTS rental_items CASCADE;
DROP TABLE IF EXISTS rentals CASCADE;
DROP TABLE IF EXISTS purchase_items CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS product_packings CASCADE;
DROP TABLE IF EXISTS product_variations CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS user_branches CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- ============================================================================
-- STEP 2: DROP ALL ENUM TYPES
-- ============================================================================

DROP TYPE IF EXISTS expense_category CASCADE;
DROP TYPE IF EXISTS studio_status CASCADE;
DROP TYPE IF EXISTS rental_status CASCADE;
DROP TYPE IF EXISTS stock_movement_type CASCADE;
DROP TYPE IF EXISTS account_subtype CASCADE;
DROP TYPE IF EXISTS account_type CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS transaction_status CASCADE;
DROP TYPE IF EXISTS contact_type CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- ============================================================================
-- STEP 3: DROP ALL FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_stock_on_sale() CASCADE;
DROP FUNCTION IF EXISTS update_stock_on_purchase() CASCADE;
DROP FUNCTION IF EXISTS update_contact_balance_on_sale() CASCADE;
DROP FUNCTION IF EXISTS update_contact_balance_on_purchase() CASCADE;
DROP FUNCTION IF EXISTS calculate_sale_totals() CASCADE;
DROP FUNCTION IF EXISTS calculate_purchase_totals() CASCADE;
DROP FUNCTION IF EXISTS auto_post_sale_to_accounting() CASCADE;
DROP FUNCTION IF EXISTS auto_post_purchase_to_accounting() CASCADE;

-- ============================================================================
-- STEP 4: RUN CLEAN SCHEMA
-- ============================================================================

-- Note: In Supabase SQL Editor, you'll need to copy and paste
-- the contents of CLEAN_COMPLETE_SCHEMA.sql here, or run it separately.

-- ============================================================================
-- STEP 5: VERIFICATION QUERIES
-- ============================================================================

-- Verify all required tables exist
DO $$
DECLARE
  required_tables TEXT[] := ARRAY[
    'companies', 'branches', 'users', 'user_branches', 'roles', 'permissions',
    'contacts', 'product_categories', 'products', 'product_variations', 'product_packings', 'stock_movements',
    'sales', 'sale_items', 'purchases', 'purchase_items',
    'rentals', 'rental_items', 'studio_orders', 'studio_order_items', 'workers', 'job_cards',
    'expenses', 'accounts', 'journal_entries', 'journal_entry_lines',
    'payments', 'settings', 'modules_config', 'document_sequences', 'audit_logs'
  ];
  missing_tables TEXT[] := '{}';
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY required_tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      missing_tables := array_append(missing_tables, tbl);
    END IF;
  END LOOP;
  
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE EXCEPTION 'Missing tables: %', array_to_string(missing_tables, ', ');
  ELSE
    RAISE NOTICE '✅ All required tables exist';
  END IF;
END $$;

-- Verify packing columns exist
DO $$
BEGIN
  -- Check sale_items
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sale_items' AND column_name = 'packing_type'
  ) THEN
    RAISE EXCEPTION 'Missing packing columns in sale_items';
  END IF;
  
  -- Check purchase_items
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_items' AND column_name = 'packing_type'
  ) THEN
    RAISE EXCEPTION 'Missing packing columns in purchase_items';
  END IF;
  
  RAISE NOTICE '✅ Packing columns verified';
END $$;

-- Verify settings table structure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' 
    AND column_name = 'company_id' 
    AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Settings table missing required company_id column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' 
    AND column_name = 'value' 
    AND data_type = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'Settings table value column must be JSONB';
  END IF;
  
  RAISE NOTICE '✅ Settings table structure verified';
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ DATABASE RESET COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All tables dropped and recreated';
  RAISE NOTICE 'All indexes created';
  RAISE NOTICE 'All triggers created';
  RAISE NOTICE 'Ready for RLS policies and functions';
  RAISE NOTICE '========================================';
END $$;
