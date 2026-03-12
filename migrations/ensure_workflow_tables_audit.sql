-- Audit: ensure key workflow tables exist (no-op if already created by other migrations).
-- Safe pattern: only create when missing. Run after manufacturing + wholesale migrations.

DO $$
BEGIN
  -- production_orders, production_steps, bill_of_materials: from manufacturing_bom_production_orders_steps.sql
  -- packing_lists: from wholesale_packing_lists_and_items.sql
  -- courier_shipments: from wholesale_packing_lists_courier_shipments.sql
  -- bulk_invoices: from wholesale_packing_lists_bulk_invoices.sql
  -- This file documents the required set; actual creation is in the named migrations.
  NULL;
END $$;
