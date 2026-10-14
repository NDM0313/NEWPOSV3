SELECT proname, pg_get_userbyid(proowner) AS owner
FROM pg_proc
WHERE proname = 'recalc_purchase_payment_totals';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'purchases' AND column_name IN ('freight_settlement', 'clearance_courier_id');
