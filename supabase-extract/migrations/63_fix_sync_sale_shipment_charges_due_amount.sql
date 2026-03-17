-- Issue 02: Keep sync_sale_shipment_charges as-is (due = total + shipment_charges + studio - paid).
-- App fix: when creating a sale with shipping, persist total = product-only; trigger then sets due correctly.
SELECT 1;
