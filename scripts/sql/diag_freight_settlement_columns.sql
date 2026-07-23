SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'purchases'
  AND column_name IN ('freight_settlement', 'clearance_courier_id');
