SELECT wo.id, wo.parent_sales_item_id, wo.work_order_no,
       si.id, si.product_id, si.product_name, si.sku, si.quantity,
       p.sku AS product_sku
FROM bespoke_work_orders wo
LEFT JOIN sales_items si ON si.id = wo.parent_sales_item_id
LEFT JOIN products p ON p.id = si.product_id
WHERE wo.id = 'bf4c47af-0e73-470c-b837-9579f31e73f1'::uuid;
