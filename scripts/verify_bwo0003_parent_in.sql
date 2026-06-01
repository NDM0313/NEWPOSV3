-- BWO-0003: parent CUSTOM line should be +IN; fabric (if any) stays negative
SELECT sm.quantity, sm.notes
FROM stock_movements sm
JOIN bespoke_work_orders w ON w.id = sm.reference_id
WHERE w.work_order_no = 'BWO-0003'
  AND sm.reference_type = 'bespoke_work_order'
ORDER BY sm.notes;
