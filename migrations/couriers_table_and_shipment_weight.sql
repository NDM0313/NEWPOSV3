-- ============================================================================
-- COURIERS TABLE + SHIPMENT WEIGHT (Courier Management, Weight, Future API)
-- ============================================================================
-- PART 1: sale_shipments.weight
-- PART 2/3: couriers table (dropdown source, default rate, tracking URL, API)
-- PART 9: sale_shipments.courier_master_id links to couriers (ledger via name)
-- Safe to run multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create couriers table (PART 3) — wrap so migration succeeds when not owner
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    CREATE TABLE IF NOT EXISTS couriers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      default_rate NUMERIC(15,2) DEFAULT 0,
      tracking_url TEXT,
      api_endpoint TEXT,
      api_key TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_couriers_company ON couriers(company_id);
    CREATE INDEX IF NOT EXISTS idx_couriers_active ON couriers(company_id, is_active) WHERE is_active = true;
    COMMENT ON TABLE couriers IS 'Courier companies for shipment dropdown, default rate, tracking URL, future API.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'couriers_table_and_shipment_weight: Create couriers table: %', SQLERRM;
  END;
  BEGIN
    ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS couriers_select ON couriers;
    CREATE POLICY couriers_select ON couriers FOR SELECT USING (company_id = get_user_company_id());
    DROP POLICY IF EXISTS couriers_insert ON couriers;
    CREATE POLICY couriers_insert ON couriers FOR INSERT WITH CHECK (company_id = get_user_company_id());
    DROP POLICY IF EXISTS couriers_update ON couriers;
    CREATE POLICY couriers_update ON couriers FOR UPDATE USING (company_id = get_user_company_id());
    DROP POLICY IF EXISTS couriers_delete ON couriers;
    CREATE POLICY couriers_delete ON couriers FOR DELETE USING (company_id = get_user_company_id());
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'couriers_table_and_shipment_weight: RLS/policies: %', SQLERRM;
  END;
  BEGIN
    ALTER TABLE sale_shipments ADD COLUMN IF NOT EXISTS weight NUMERIC(10,2);
    ALTER TABLE sale_shipments ADD COLUMN IF NOT EXISTS courier_master_id UUID REFERENCES couriers(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_sale_shipments_courier_master ON sale_shipments(courier_master_id) WHERE courier_master_id IS NOT NULL;
    COMMENT ON COLUMN sale_shipments.weight IS 'Weight in kg for rate calculation and labels.';
    COMMENT ON COLUMN sale_shipments.courier_master_id IS 'Courier from couriers table; accounting uses couriers.account_id when set.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'couriers_table_and_shipment_weight: sale_shipments: %', SQLERRM;
  END;
  BEGIN
    ALTER TABLE couriers ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_couriers_account_id ON couriers(account_id) WHERE account_id IS NOT NULL;
    COMMENT ON COLUMN couriers.account_id IS 'Payable account (2031, 2032…) under 2030 Courier Payable (Control). Set when courier is created via get_or_create_courier_payable_account.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'couriers_table_and_shipment_weight: couriers.account_id: %', SQLERRM;
  END;
END;
$$;
