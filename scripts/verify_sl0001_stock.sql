SELECT sm.id, sm.product_id, sm.variation_id, sm.quantity, sm.notes, p.sku
FROM stock_movements sm
JOIN sales s ON s.id = sm.reference_id AND sm.reference_type = 'sale'
LEFT JOIN products p ON p.id = sm.product_id
WHERE s.invoice_no = 'SL-0001'
  AND LOWER(TRIM(sm.movement_type)) = 'sale'
ORDER BY sm.created_at;
