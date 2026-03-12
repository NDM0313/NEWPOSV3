-- ============================================================================
-- WHOLESALE: courier_shipments (Step 5 — Courier Shipment Workflow)
-- ============================================================================
-- Run after: wholesale_packing_lists_and_items.sql (packing_lists must exist).
-- Flow: Packing List → Create Shipment → courier_shipments (courier, tracking, cost)
-- ============================================================================

CREATE TABLE IF NOT EXISTS courier_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  packing_list_id UUID NOT NULL REFERENCES packing_lists(id) ON DELETE CASCADE,
  courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL,
  tracking_number VARCHAR(255),
  shipment_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending | booked | dispatched | delivered
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_courier_shipments_company ON courier_shipments(company_id);
CREATE INDEX IF NOT EXISTS idx_courier_shipments_packing_list ON courier_shipments(packing_list_id);
CREATE INDEX IF NOT EXISTS idx_courier_shipments_courier ON courier_shipments(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_shipments_status ON courier_shipments(status);
COMMENT ON TABLE courier_shipments IS 'Wholesale: shipment per packing list. Courier, tracking, cost. Print: CourierSlip.';

-- RLS
ALTER TABLE courier_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courier_shipments_select ON courier_shipments;
CREATE POLICY courier_shipments_select ON courier_shipments FOR SELECT
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS courier_shipments_insert ON courier_shipments;
CREATE POLICY courier_shipments_insert ON courier_shipments FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS courier_shipments_update ON courier_shipments;
CREATE POLICY courier_shipments_update ON courier_shipments FOR UPDATE
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS courier_shipments_delete ON courier_shipments;
CREATE POLICY courier_shipments_delete ON courier_shipments FOR DELETE
  USING (company_id = get_user_company_id());
