-- ============================================================================
-- FULL DATABASE WIPE - DEVELOPMENT ENVIRONMENT ONLY
-- ============================================================================
-- WARNING: This will DELETE ALL DATA and TABLES
-- Use only in development environment
-- ============================================================================

-- Disable RLS on all tables before dropping
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE IF EXISTS ' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- Drop all RLS policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || 
                ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- Drop all custom functions
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT routine_name 
              FROM information_schema.routines 
              WHERE routine_schema = 'public' 
                AND routine_type = 'FUNCTION'
                AND routine_name NOT LIKE 'pg_%') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.routine_name) || ' CASCADE';
    END LOOP;
END $$;

-- Drop all triggers
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name, event_object_table 
              FROM information_schema.triggers 
              WHERE trigger_schema = 'public'
                AND trigger_name NOT LIKE 'pg_%') LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || 
                ' ON ' || quote_ident(r.event_object_table) || ' CASCADE';
    END LOOP;
END $$;

-- Drop all tables (in dependency order - reverse)
-- First, drop tables with foreign keys, then parent tables
DO $$
DECLARE
    r RECORD;
    tables_to_drop TEXT[];
BEGIN
    -- Get all tables
    SELECT array_agg(table_name::TEXT)
    INTO tables_to_drop
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    
    -- Drop all tables with CASCADE
    IF tables_to_drop IS NOT NULL THEN
        FOREACH r.table_name IN ARRAY tables_to_drop LOOP
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.table_name) || ' CASCADE';
        END LOOP;
    END IF;
END $$;

-- Drop all sequences
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name 
              FROM information_schema.sequences 
              WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;
END $$;

-- Drop all custom types (ENUMs, etc.)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT typname 
              FROM pg_type 
              WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                AND typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;

-- Drop all views
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT table_name 
              FROM information_schema.views 
              WHERE table_schema = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.table_name) || ' CASCADE';
    END LOOP;
END $$;

-- Verification: Check if database is blank
DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_type = 'FUNCTION'
      AND routine_name NOT LIKE 'pg_%';
    
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public';
    
    RAISE NOTICE 'Database wipe complete. Tables: %, Functions: %, Policies: %', 
        table_count, function_count, policy_count;
    
    IF table_count > 0 THEN
        RAISE WARNING 'Some tables still exist. Manual cleanup may be required.';
    END IF;
END $$;

-- Final verification query
SELECT 
    'Tables remaining' as check_type,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
UNION ALL
SELECT 
    'Functions remaining',
    COUNT(*)
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name NOT LIKE 'pg_%'
UNION ALL
SELECT 
    'Policies remaining',
    COUNT(*)
FROM pg_policies
WHERE schemaname = 'public';
