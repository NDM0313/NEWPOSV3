SELECT wo.id, wo.work_order_no, wo.parent_sales_item_id, wo.status, wo.sale_id,
       s.invoice_no
FROM bespoke_work_orders wo
JOIN sales s ON s.id = wo.sale_id
WHERE s.invoice_no ILIKE '%SL-0007%' OR wo.id = 'bf4c47af-0e73-470c-b837-9579f31e73f1'::uuid;

SELECT si.id, si.product_name, si.quantity, si.bespoke_parent_item_id, si.unit_price
FROM sales_items si
WHERE si.sale_id = '478e64c6-4c46-4a38-bfae-c4ee42593699'::uuid
ORDER BY si.created_at NULLS LAST, si.id;
