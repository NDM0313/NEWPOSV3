-- ============================================================================
-- Drop legacy studio_orders and studio_order_items (optional / try-base tables)
-- ============================================================================
-- Current app uses sales table (is_studio, STD-* invoice_no) + studio_productions
-- for Studio. studio_orders was legacy; removing it reduces load and confusion.
-- Run in Supabase SQL Editor. App code is resilient to missing table.
-- ============================================================================

-- 1. Drop trigger that inserts into studio_orders when studio_production is created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_productions') THEN
    DROP TRIGGER IF EXISTS trigger_ensure_studio_order_on_production ON studio_productions;
  END IF;
END $$;

-- 2. Drop function that references studio_orders
DROP FUNCTION IF EXISTS ensure_studio_order_for_sale() CASCADE;

-- 3. Drop child table first (FK to studio_orders)
DROP TABLE IF EXISTS studio_order_items CASCADE;

-- 4. Drop legacy studio_orders (job_cards / studio_tasks FK will be dropped by CASCADE if they exist)
DROP TABLE IF EXISTS studio_orders CASCADE;
