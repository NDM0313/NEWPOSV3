-- ============================================================================
-- SALES WITH SHIPPING — View for Sales list (avoid N+1)
-- ============================================================================
-- Exposes first shipment's status per sale for the Sales table.
-- Use: SELECT * FROM sales_with_shipping WHERE id IN (...)
-- or join in app after loading sales.
-- Safe to run multiple times.
-- ============================================================================

DROP VIEW IF EXISTS sales_with_shipping;

CREATE VIEW sales_with_shipping AS
SELECT
  s.id,
  ss.shipment_status,
  ss.id AS first_shipment_id
FROM sales s
LEFT JOIN LATERAL (
  SELECT id, shipment_status
  FROM sale_shipments
  WHERE sale_id = s.id
  ORDER BY created_at ASC
  LIMIT 1
) ss ON true;

GRANT SELECT ON sales_with_shipping TO authenticated;

COMMENT ON VIEW sales_with_shipping IS 'Per-sale first shipment status for Sales list; avoids N+1 when showing shipping column.';
