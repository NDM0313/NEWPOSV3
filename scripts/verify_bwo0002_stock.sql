SELECT product_id, quantity, reference_type, reference_id, notes
FROM stock_movements
WHERE reference_id = 'bf4c47af-0e73-470c-b837-9579f31e73f1'::uuid
ORDER BY created_at DESC;
