-- ============================================================================
-- PART 4: Default courier seed (TCS, Leopard, DHL, Call Courier, Pakistan Post)
-- Run once per environment. Inserts for each company that does not already have
-- a courier with the same name. Safe to run multiple times.
-- ============================================================================

-- Temporarily allow insert for seed (RLS may block cross-company in some setups)
DO $$
DECLARE
  r RECORD;
  v_name TEXT;
  v_rate NUMERIC;
  v_url TEXT;
BEGIN
  FOR r IN SELECT id FROM companies
  LOOP
    -- TCS
    INSERT INTO couriers (company_id, name, default_rate, tracking_url, is_active)
    SELECT r.id, 'TCS', 250, 'https://www.tcsexpress.com/track?trackingNo={tracking_id}', true
    WHERE NOT EXISTS (SELECT 1 FROM couriers WHERE company_id = r.id AND name = 'TCS');
    -- Leopard
    INSERT INTO couriers (company_id, name, default_rate, tracking_url, is_active)
    SELECT r.id, 'Leopard', 0, NULL, true
    WHERE NOT EXISTS (SELECT 1 FROM couriers WHERE company_id = r.id AND name = 'Leopard');
    -- DHL
    INSERT INTO couriers (company_id, name, default_rate, tracking_url, is_active)
    SELECT r.id, 'DHL', 0, NULL, true
    WHERE NOT EXISTS (SELECT 1 FROM couriers WHERE company_id = r.id AND name = 'DHL');
    -- Call Courier
    INSERT INTO couriers (company_id, name, default_rate, tracking_url, is_active)
    SELECT r.id, 'Call Courier', 0, NULL, true
    WHERE NOT EXISTS (SELECT 1 FROM couriers WHERE company_id = r.id AND name = 'Call Courier');
    -- Pakistan Post
    INSERT INTO couriers (company_id, name, default_rate, tracking_url, is_active)
    SELECT r.id, 'Pakistan Post', 0, NULL, true
    WHERE NOT EXISTS (SELECT 1 FROM couriers WHERE company_id = r.id AND name = 'Pakistan Post');
  END LOOP;
END $$;
