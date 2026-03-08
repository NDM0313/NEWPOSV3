-- ============================================================================
-- SALE SHIPMENTS – table, sync to sales.shipment_charges, accountability
-- ============================================================================
-- Links shipments to a sale (sale_id). Used by Studio Sale Detail and Sale
-- Dashboard. Syncs SUM(charged_to_customer) to sales.shipment_charges.
-- ============================================================================

-- 1. Ensure sales.shipment_charges exists (for sync)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS shipment_charges NUMERIC(15,2) DEFAULT 0;
COMMENT ON COLUMN sales.shipment_charges IS 'Sum of sale_shipments.charged_to_customer for this sale. Synced by trigger.';

-- 2. sale_shipments table
CREATE TABLE IF NOT EXISTS sale_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,

  shipment_type VARCHAR(50) NOT NULL DEFAULT 'Courier', -- 'Local' | 'Courier'
  courier_name VARCHAR(255),
  shipment_status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Booked' | 'Dispatched' | 'Delivered'

  tracking_id VARCHAR(255),
  tracking_url TEXT,
  tracking_documents JSONB DEFAULT '[]'::jsonb,

  booking_date DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,

  actual_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  charged_to_customer NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'PKR',
  usd_to_pkr_rate NUMERIC(15,4),

  rider_phone VARCHAR(50),
  delivery_area VARCHAR(255),
  notes TEXT,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_shipments_sale ON sale_shipments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_shipments_company ON sale_shipments(company_id);
CREATE INDEX IF NOT EXISTS idx_sale_shipments_branch ON sale_shipments(branch_id);
CREATE INDEX IF NOT EXISTS idx_sale_shipments_status ON sale_shipments(shipment_status);
COMMENT ON TABLE sale_shipments IS 'Shipments per sale. charged_to_customer synced to sales.shipment_charges. Used by Studio and Sale Dashboard.';

-- 3. Sync sales.shipment_charges (and due_amount) when sale_shipments change
CREATE OR REPLACE FUNCTION sync_sale_shipment_charges(p_sale_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_charged_sum NUMERIC(15,2);
  v_total NUMERIC(15,2);
  v_paid NUMERIC(15,2);
  v_studio NUMERIC(15,2);
  v_due NUMERIC(15,2);
BEGIN
  IF p_sale_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(charged_to_customer), 0) INTO v_charged_sum
  FROM sale_shipments WHERE sale_id = p_sale_id;

  SELECT total, paid_amount, COALESCE(studio_charges, 0)
  INTO v_total, v_paid, v_studio
  FROM sales WHERE id = p_sale_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_total := COALESCE(v_total, 0);
  v_paid := COALESCE(v_paid, 0);
  v_due := GREATEST(0, (v_total + v_charged_sum + v_studio) - v_paid);

  UPDATE sales
  SET shipment_charges = v_charged_sum,
      due_amount = v_due,
      updated_at = NOW()
  WHERE id = p_sale_id;
END;
$$;

-- 4. Trigger on sale_shipments
CREATE OR REPLACE FUNCTION trigger_sync_sale_shipment_charges()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id UUID;
BEGIN
  v_sale_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.sale_id ELSE NEW.sale_id END;
  PERFORM sync_sale_shipment_charges(v_sale_id);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_after_sale_shipment_sync ON sale_shipments;
CREATE TRIGGER trigger_after_sale_shipment_sync
  AFTER INSERT OR UPDATE OR DELETE ON sale_shipments
  FOR EACH ROW EXECUTE PROCEDURE trigger_sync_sale_shipment_charges();

-- 5. RLS (company-scoped)
ALTER TABLE sale_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sale_shipments_select ON sale_shipments;
CREATE POLICY sale_shipments_select ON sale_shipments FOR SELECT
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS sale_shipments_insert ON sale_shipments;
CREATE POLICY sale_shipments_insert ON sale_shipments FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS sale_shipments_update ON sale_shipments;
CREATE POLICY sale_shipments_update ON sale_shipments FOR UPDATE
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS sale_shipments_delete ON sale_shipments;
CREATE POLICY sale_shipments_delete ON sale_shipments FOR DELETE
  USING (company_id = get_user_company_id());
