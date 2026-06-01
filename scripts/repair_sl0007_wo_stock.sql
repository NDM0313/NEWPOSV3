-- Repair fabric stock for SL-0007 WO (idempotent)
SELECT public.complete_bespoke_work_order(
  'bf4c47af-0e73-470c-b837-9579f31e73f1'::uuid,
  NULL
) AS rpc_result;

SELECT id, product_id, quantity, reference_type, reference_id, notes, created_at
FROM stock_movements
WHERE reference_type = 'bespoke_work_order'
  AND reference_id = 'bf4c47af-0e73-470c-b837-9579f31e73f1'::uuid;
