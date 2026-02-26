-- Fix: column "sale_id" does not exist on studio_productions
-- 1. Add sale_id to studio_productions if table exists
-- 2. Replace get_sale_studio_charges_batch to check column exists before using it

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_productions') THEN
    ALTER TABLE studio_productions ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id) ON DELETE RESTRICT;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION get_sale_studio_charges_batch(p_sale_ids UUID[])
RETURNS TABLE(sale_id UUID, studio_cost NUMERIC(15,2))
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  IF p_sale_ids IS NULL OR array_length(p_sale_ids, 1) IS NULL OR array_length(p_sale_ids, 1) = 0 THEN
    RETURN;
  END IF;
  -- From studio_production_stages + studio_productions (only when sale_id column exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_stages')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_productions' AND column_name = 'sale_id') THEN
    RETURN QUERY
    SELECT p.sale_id::UUID AS sale_id, COALESCE(SUM(s.cost), 0)::NUMERIC(15,2) AS studio_cost
    FROM studio_production_stages s
    INNER JOIN studio_productions p ON p.id = s.production_id
    WHERE p.sale_id = ANY(p_sale_ids)
    GROUP BY p.sale_id;
    RETURN;
  END IF;
  -- From studio_orders + studio_tasks
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_orders') THEN
    RETURN QUERY
    SELECT o.sale_id AS sale_id, COALESCE(SUM(t.cost), 0)::NUMERIC(15,2) AS studio_cost
    FROM studio_orders o
    LEFT JOIN studio_tasks t ON t.studio_order_id = o.id
    WHERE o.sale_id = ANY(p_sale_ids)
    GROUP BY o.sale_id;
  END IF;
END;
$$;
