-- ============================================================================
-- TEST DATA INSERTION - PHASE 2 & 3 VERIFICATION
-- ============================================================================
-- This script tests data insertion for core entities
-- Run this AFTER FRESH_DEMO_SETUP.sql
-- ============================================================================

-- ============================================================================
-- TEST 1: CREATE SUPPLIER
-- ============================================================================

-- Ensure contacts table exists
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('customer', 'supplier', 'both')),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    opening_balance NUMERIC(15,2) DEFAULT 0,
    current_balance NUMERIC(15,2) DEFAULT 0,
    credit_limit NUMERIC(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert Test Supplier
INSERT INTO public.contacts (
    company_id,
    type,
    name,
    email,
    phone,
    address,
    city,
    is_active
)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'supplier',
    'Test Supplier Pvt Ltd',
    'supplier@test.com',
    '+92-300-1111111',
    '456 Supplier Street',
    'Karachi',
    true
)
RETURNING id, name, type, company_id;

-- ============================================================================
-- TEST 2: CREATE CUSTOMER
-- ============================================================================

INSERT INTO public.contacts (
    company_id,
    type,
    name,
    email,
    phone,
    address,
    city,
    is_active
)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'customer',
    'Test Customer',
    'customer@test.com',
    '+92-300-2222222',
    '789 Customer Avenue',
    'Karachi',
    true
)
RETURNING id, name, type, company_id;

-- ============================================================================
-- TEST 3: CREATE PRODUCT CATEGORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.product_categories (id, company_id, name, description, is_active)
VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Bridal',
    'Bridal wear collection',
    true
)
RETURNING id, name, company_id;

-- ============================================================================
-- TEST 4: CREATE PRODUCT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.product_categories(id),
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    description TEXT,
    cost_price NUMERIC(15,2) DEFAULT 0,
    retail_price NUMERIC(15,2) NOT NULL,
    wholesale_price NUMERIC(15,2),
    rental_price_daily NUMERIC(15,2),
    current_stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    max_stock INTEGER DEFAULT 1000,
    has_variations BOOLEAN DEFAULT false,
    is_rentable BOOLEAN DEFAULT false,
    is_sellable BOOLEAN DEFAULT true,
    track_stock BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Get category ID
DO $$
DECLARE
    cat_id UUID;
    prod_id UUID;
BEGIN
    -- Get first category
    SELECT id INTO cat_id FROM public.product_categories 
    WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid 
    LIMIT 1;
    
    -- Insert product
    INSERT INTO public.products (
        company_id,
        category_id,
        name,
        sku,
        description,
        cost_price,
        retail_price,
        wholesale_price,
        current_stock,
        min_stock,
        is_sellable,
        is_active
    )
    VALUES (
        '00000000-0000-0000-0000-000000000001'::uuid,
        cat_id,
        'Test Product - Premium Lehenga',
        'PRD-TEST-001',
        'Test product for verification',
        15000.00,
        25000.00,
        22000.00,
        10,
        2,
        true,
        true
    )
    RETURNING id INTO prod_id;
    
    RAISE NOTICE '✅ Product created with ID: %', prod_id;
END $$;

-- ============================================================================
-- VERIFICATION: Check all inserted data
-- ============================================================================

SELECT 'SUPPLIER' as entity_type, COUNT(*) as count FROM public.contacts WHERE type = 'supplier' AND company_id = '00000000-0000-0000-0000-000000000001'::uuid
UNION ALL
SELECT 'CUSTOMER', COUNT(*) FROM public.contacts WHERE type = 'customer' AND company_id = '00000000-0000-0000-0000-000000000001'::uuid
UNION ALL
SELECT 'PRODUCT', COUNT(*) FROM public.products WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid
UNION ALL
SELECT 'CATEGORY', COUNT(*) FROM public.product_categories WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid;
